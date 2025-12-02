
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loginUser, checkSession, unifiedLogin } from '../services/authService';
import { User, AdminUser } from '../types';
import { transcribeAudioWithGoogle, isAffirmative, translateText } from '../services/apiService';
import { APP_TITLE, APP_DESCRIPTION, AI_ASSISTANT_NAME } from '../constants';
import { GoogleGenAI, Chat } from '@google/genai';

// --- Initialize GenAI Client ---
const genAIClient = new GoogleGenAI({ apiKey: process.env.API_KEY! });


// --- Component Props ---
interface AuthProps {
    onLoginSuccess: (user: User | AdminUser) => void;
    onNewUser: () => void;
    initialIdentifier?: string;
}

type InputMode = 'voice' | 'text';
type VoiceStatus = 'idle' | 'detecting' | 'recording' | 'transcribing';

const VAD_VOLUME_THRESHOLD = 20; // Sensitivity for voice detection
const VAD_SILENCE_TIMEOUT = 3500; // ms of silence before stopping recording
const MAX_LOGIN_ATTEMPTS = 2;

// --- Hardcoded System Prompt for Conversational AI ---
const CONVERSATIONAL_SYSTEM_INSTRUCTION = `
You are ${AI_ASSISTANT_NAME}, a friendly, natural, and intelligent AI assistant for the 360 Smart School platform.

Your primary goal is to help students log in. You can also hold a friendly conversation about any other topic.

**Conversation Flow:**
1.  Start by greeting the user and asking for their Student ID to log in. You can also offer to just chat.
2.  If they provide an ID, you will attempt the login.
3.  If the user asks to switch to typing, you will switch the interface.

**NEW: LANGUAGE DETECTION**
- If the user's message is NOT in English, your primary task is language detection.
- You MUST respond with a specific JSON object for the frontend to handle this action.

**CRITICAL INSTRUCTION: ACTION RESPONSE FORMAT**
When an action is required, you MUST respond with a JSON object. The frontend code relies on this specific format to complete the action.

The JSON object must have two keys:
- \`response\`: A string containing the friendly message to be spoken to the user.
- \`action\`: An object describing the action to be taken.

**Action Types:**
- \`LOGIN_ATTEMPT\`: When a user provides a student ID to attempt a login.
    - \`action\`: \`{ "type": "LOGIN_ATTEMPT", "studentId": "..." }\`
- \`SWITCH_TO_TEXT\`: When a user asks to switch to typing, use the manual form, or says they forgot their ID.
    - \`action\`: \`{ "type": "SWITCH_TO_TEXT" }\`
- \`LANGUAGE_DETECTED\`: When you detect a language other than English.
    - \`response\`: The confirmation question IN THE DETECTED LANGUAGE.
    - \`action\`: \`{ "type": "LANGUAGE_DETECTED", "language": "...", "langCode": "..." }\` (Use standard BCP 47 language codes like "fr-FR", "es-ES").

**Example Scenarios:**

*   **Login Example (English):**
    *   User: "My student ID is S001"
    *   You: \`{"response": "Thanks! Let me check that ID for you.", "action": {"type": "LOGIN_ATTEMPT", "studentId": "S001"}}\`

*   **Language Detection Example (French):**
    *   User: "Bonjour, mon numéro d'étudiant est S002"
    *   You: \`{"response": "J'ai détecté que vous parlez français. Voulez-vous continuer en français ?", "action": {"type": "LANGUAGE_DETECTED", "language": "French", "langCode": "fr-FR"}}\`

*   **Language Detection Example (Spanish):**
    *   User: "Hola, mi ID es S003"
    *   You: \`{"response": "He detectado que hablas español. ¿Quieres continuar en español?", "action": {"type": "LANGUAGE_DETECTED", "language": "Spanish", "langCode": "es-ES"}}\`
`;


const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onNewUser, initialIdentifier = '' }) => {
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [displayText, setDisplayText] = useState('Click "Start Session" to begin.');
    const [inputMode, setInputMode] = useState<InputMode>('voice');
    const [error, setError] = useState('');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [conversationActive, setConversationActive] = useState(false);
    
    // State for unified login form
    const [identifier, setIdentifier] = useState(initialIdentifier);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // --- Refs for audio processing ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadLoopRef = useRef<number | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const chatRef = useRef<Chat | null>(null);
    
    const speechQueueRef = useRef<{ text: string; langCode: string; onEnd?: () => void }[]>([]);
    const isPlayingRef = useRef<boolean>(false);
    const conversationActiveRef = useRef<boolean>(conversationActive);
    const typingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const processSpeechQueueImpl = useRef<(() => void) | null>(null);
    const loginAttemptsRef = useRef(0);
    const pendingLanguageSwitchRef = useRef<{ name: string; code: string } | null>(null);
    const [currentLang, setCurrentLang] = useState({ name: 'English', code: 'en-US' });


    useEffect(() => {
        conversationActiveRef.current = conversationActive;
    }, [conversationActive]);
    
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
        };
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    useEffect(() => {
        if (initialIdentifier) {
            setConversationActive(true);
            setInputMode('text');
        }
    }, [initialIdentifier]);

    useEffect(() => {
        processSpeechQueueImpl.current = () => {
            if (isPlayingRef.current || speechQueueRef.current.length === 0) {
                return;
            }

            isPlayingRef.current = true;
            setIsSpeaking(true);

            const speechObject = speechQueueRef.current.shift()!;
            const { text: textToSpeak, langCode, onEnd: customOnEnd } = speechObject;
            
            setDisplayText('');
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = langCode;

            if (voices.length > 0) {
                // Find the best voice for the requested language
                const langPrefix = langCode.split('-')[0];
                const perfectMatch = voices.find(v => v.lang === langCode);
                const languageMatch = voices.find(v => v.lang.startsWith(langPrefix));
                const preferredVoice = perfectMatch || languageMatch;

                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }
            }

            if (typingIntervalRef.current) {
                clearTimeout(typingIntervalRef.current);
            }

            const sentences = textToSpeak.split(/(?<=[.!?])\s+/).filter(Boolean);
            let sentenceIndex = 0;
            const wordsPerMinute = 150; 

            const displayNextSentence = () => {
                if (sentenceIndex < sentences.length) {
                    const sentence = sentences[sentenceIndex].trim();
                    if (!sentence) {
                        sentenceIndex++;
                        displayNextSentence();
                        return;
                    }
            
                    setDisplayText(sentence);
                    sentenceIndex++;
            
                    const wordCount = sentence.split(/\s+/).length;
                    const duration = (wordCount / wordsPerMinute) * 60 * 1000;
                    const buffer = 250; 
            
                    typingIntervalRef.current = setTimeout(displayNextSentence, duration + buffer);
                } else {
                    typingIntervalRef.current = null;
                }
            };
            
            utterance.onstart = () => {
                displayNextSentence();
            };

            utterance.onend = () => {
                if (typingIntervalRef.current) {
                    clearTimeout(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                }
                
                setTimeout(() => {
                    if (!isPlayingRef.current && conversationActiveRef.current) {
                        setDisplayText('');
                    }
                }, 750);
                
                isPlayingRef.current = false;
                setIsSpeaking(false);

                if (customOnEnd) {
                    customOnEnd();
                }
                
                if (speechQueueRef.current.length > 0) {
                    processSpeechQueueImpl.current?.();
                } else {
                    if (conversationActiveRef.current) {
                        setVoiceStatus('detecting');
                    }
                }
            };

            utterance.onerror = (event) => {
                if (typingIntervalRef.current) {
                    clearTimeout(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                }
                
                if (event.error !== 'interrupted') {
                    console.error("SpeechSynthesis Error:", event.error);
                }
                setDisplayText(''); 
                isPlayingRef.current = false;
                setIsSpeaking(false);
                processSpeechQueueImpl.current?.();
            };

            window.speechSynthesis.speak(utterance);
        };
    }, [voices]);

    const processSpeechQueue = useCallback(() => {
        processSpeechQueueImpl.current?.();
    }, []);

    const speak = useCallback((text: string, langCode: string = currentLang.code, onEnd?: () => void) => {
        if (!text.trim()) return;
        speechQueueRef.current.push({ text: text.replace(/\*\*/g, ''), langCode, onEnd });
        if (!isPlayingRef.current) {
            processSpeechQueue();
        }
    }, [processSpeechQueue, currentLang.code]);
    

    const stopVAD = useCallback(() => {
        if (vadLoopRef.current) {
            cancelAnimationFrame(vadLoopRef.current);
            vadLoopRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (voiceStatus !== 'recording' && voiceStatus !== 'transcribing') {
            setVoiceStatus('idle');
        }
    }, [voiceStatus]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        stopVAD();
    }, [stopVAD]);
    
    const startRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setVoiceStatus('recording');
        }
    }, []);
    
    const handleLoginAttempt = useCallback((studentId: string) => {
        const user = loginUser(studentId);
        if (user) {
            loginAttemptsRef.current = 0; // Reset on success
            const onLoginEnd = () => {
                setConversationActive(false);
                onLoginSuccess(user);
            };
            speak(`Welcome back, ${user.name}! Logging you in now.`);
        } else {
            loginAttemptsRef.current += 1;
            if (loginAttemptsRef.current >= MAX_LOGIN_ATTEMPTS) {
                const onSwitchToEnd = () => {
                    setInputMode('text');
                    loginAttemptsRef.current = 0; // Reset for the next time
                };
                speak("I'm still having trouble finding that ID. Let's switch to typing for you to log in with your password.", currentLang.code, onSwitchToEnd);
                return;
            }
            speak("I couldn't find a user with that ID. Please try again or switch to typing to log in with a password.");
        }
    }, [onLoginSuccess, speak, currentLang.code]);

    const processTranscript = useCallback(async (transcript: string) => {
        if (!transcript) {
            if (conversationActiveRef.current) {
                setVoiceStatus('detecting');
            }
            return;
        }

        // Handle language switch confirmation
        if (pendingLanguageSwitchRef.current) {
            const isYes = await isAffirmative(transcript);
            const { name, code } = pendingLanguageSwitchRef.current;
            pendingLanguageSwitchRef.current = null;

            if (isYes) {
                setCurrentLang({ name, code });
                const translatedPrompt = await translateText(CONVERSATIONAL_SYSTEM_INSTRUCTION, name);
                chatRef.current = genAIClient.chats.create({
                    model: 'gemini-flash-lite-latest',
                    config: { systemInstruction: translatedPrompt }
                });
                const confirmationText = await translateText(`Okay, let's continue in ${name}. Please state your Student ID.`, name);
                speak(confirmationText, code);
            } else {
                speak("Okay, we'll continue in English. Please state your Student ID.", 'en-US');
            }
            return;
        }
        
        if (!chatRef.current) return;
        
        try {
            const result = await chatRef.current.sendMessage({ message: transcript });
            const aiResponseText = result.text;
            
            try {
                const jsonMatch = aiResponseText.match(/(\{[\s\S]*\})/);
                
                if (jsonMatch && jsonMatch[0]) {
                    const cleanedJsonText = jsonMatch[0];
                    const parsedResponse = JSON.parse(cleanedJsonText);
                    
                    if (parsedResponse.action && parsedResponse.response) {
                        if (parsedResponse.action.type === 'LOGIN_ATTEMPT') {
                            speak(parsedResponse.response);
                            handleLoginAttempt(parsedResponse.action.studentId);
                        } else if (parsedResponse.action.type === 'SWITCH_TO_TEXT') {
                            const onSwitchEnd = () => setInputMode('text');
                            speak(parsedResponse.response, currentLang.code, onSwitchEnd);
                        } else if (parsedResponse.action.type === 'LANGUAGE_DETECTED') {
                            const { language, langCode } = parsedResponse.action;
                            pendingLanguageSwitchRef.current = { name: language, code: langCode };
                            speak(parsedResponse.response, langCode);
                        } else {
                            speak(aiResponseText);
                        }
                    } else {
                        speak(aiResponseText);
                    }
                } else {
                    speak(aiResponseText);
                }
            } catch (e) {
                console.error("Failed to parse AI response as JSON:", e);
                speak(aiResponseText);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : 'AI response failed.';
            console.error("Error processing AI response:", error);
            
            if (message.includes('429') || message.toLowerCase().includes('resource_exhausted')) {
                const friendlyMessage = "I'm a bit busy right now and can't think. Please ask again in a moment.";
                speak(friendlyMessage);
            } else {
                speak("I'm sorry, I encountered an error. Please try again.");
            }
            
            if (conversationActiveRef.current) {
                setVoiceStatus('detecting');
            }
        }

    }, [speak, handleLoginAttempt, currentLang.code]);

    const setupAudio = useCallback(async (): Promise<boolean> => {
        try {
            if (audioStreamRef.current) return true;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];

                if (audioBlob.size < 1024) { 
                    if (conversationActiveRef.current) {
                        setVoiceStatus('detecting'); 
                    }
                    return; 
                }

                setVoiceStatus('transcribing');

                try {
                    const transcript = await transcribeAudioWithGoogle(audioBlob);
                    processTranscript(transcript);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Transcription failed.';
                    console.error("Transcription/API error:", err);

                    if (
                        message.includes('API key not valid') ||
                        message.includes('API_KEY_INVALID') ||
                        message.includes('permission to access')
                    ) {
                        setError("Voice service is not configured correctly. Please check API key in environment variables and use typing.");
                        setInputMode('text');
                        setConversationActive(false);
                        setVoiceStatus('idle');
                        speak("The voice recognition service isn't set up correctly. I'm switching to text mode.");
                    } else if (message.includes('429') || message.toLowerCase().includes('resource_exhausted')) {
                        const friendlyMessage = "The voice service is currently busy. Please wait a moment before trying again.";
                        setError(friendlyMessage);
                        speak(friendlyMessage);
                        if (conversationActiveRef.current) {
                            setVoiceStatus('detecting');
                        } else {
                            setVoiceStatus('idle');
                        }
                    } else {
                        setError(message);
                        speak("Sorry, I had trouble understanding that. Please try again.");
                         if (conversationActiveRef.current) {
                            setVoiceStatus('detecting');
                        }
                    }
                }
            };

            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = context;
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            analyserRef.current = analyser;
            return true;

        } catch (err) {
            console.error("Error setting up audio:", err);
            if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                 setError("Microphone access was denied. To use voice features, please enable microphone permissions in your browser's site settings and try again.");
            } else {
                setError("Could not access your microphone. Please ensure it's connected and not in use by another application.");
            }
            setInputMode('text');
            return false;
        }
    }, [processTranscript, speak]);


    const startVAD = useCallback(() => {
        if (!analyserRef.current || !audioContextRef.current) return;
        if (vadLoopRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            if (volume > VAD_VOLUME_THRESHOLD) {
                if (mediaRecorderRef.current?.state === 'inactive') {
                    startRecording();
                }
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
            } else {
                if (mediaRecorderRef.current?.state === 'recording' && !silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        stopRecording();
                    }, VAD_SILENCE_TIMEOUT);
                }
            }
            vadLoopRef.current = requestAnimationFrame(loop);
        };
        loop();
    }, [startRecording, stopRecording]);

    useEffect(() => {
        return () => {
            if (vadLoopRef.current) {
                cancelAnimationFrame(vadLoopRef.current);
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
             if (typingIntervalRef.current) {
                clearTimeout(typingIntervalRef.current);
            }
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(track => track.stop());
                audioStreamRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            window.speechSynthesis.cancel();
            speechQueueRef.current = [];
            isPlayingRef.current = false;
        };
    }, []); 


    useEffect(() => {
        if ((voiceStatus === 'detecting' || voiceStatus === 'recording') && conversationActive && !isSpeaking) {
            startVAD();
        } else {
            stopVAD();
        }
    }, [voiceStatus, conversationActive, isSpeaking, startVAD, stopVAD]);

    useEffect(() => {
        if (!conversationActive) {
             setDisplayText('Click "Start Session" to begin.');
             return;
        }

    }, [conversationActive, voiceStatus, isSpeaking]);

    const handleStartSession = async () => {
        setError(''); 
        loginAttemptsRef.current = 0; 
        pendingLanguageSwitchRef.current = null;
        setCurrentLang({ name: 'English', code: 'en-US' });
    
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                if (permissionStatus.state === 'denied') {
                    setError("Microphone permission is blocked. To use voice login, please go to your browser's site settings and allow microphone access for this page.");
                    setInputMode('text');
                    setConversationActive(true); 
                    return;
                }
            } catch (err) {
                console.warn("Could not query microphone permission:", err);
            }
        }
        
        const audioReady = await setupAudio();
    
        if (!audioReady) {
            setConversationActive(true); 
            return;
        }
        
        chatRef.current = genAIClient.chats.create({
            model: 'gemini-flash-lite-latest',
            config: {
                systemInstruction: CONVERSATIONAL_SYSTEM_INSTRUCTION
            }
        });
    
        setConversationActive(true);
        const welcomeMessage = `Hello! I'm the ${AI_ASSISTANT_NAME}. Please say your Student ID to log in, or we can just chat.`;
        speak(welcomeMessage, 'en-US');
    };
    
    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const user = unifiedLogin(identifier, password);
            if (user) {
                onLoginSuccess(user);
            } else {
                setError("Invalid credentials. Please check your ID/Email and password.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        }
    };

    if (!conversationActive) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans text-center">
                 <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2">{APP_TITLE}</h1>
                 <p className="text-base sm:text-lg text-gray-300 mb-8">{APP_DESCRIPTION}</p>
                 <button 
                    onClick={handleStartSession}
                    className="px-8 py-4 bg-cyan-600 hover:bg-cyan-700 rounded-full text-white font-semibold transition-colors text-lg sm:text-xl shadow-lg"
                 >
                     Start Voice Session
                 </button>
                 <button onClick={() => { setConversationActive(true); setInputMode('text'); }} className="mt-6 text-cyan-400 hover:underline">
                    Or, use typing instead
                 </button>
             </div>
        );
    }
    
    const micButtonClasses = `relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48 rounded-full cursor-pointer transition-all duration-300 ${isSpeaking ? 'animate-ripple' : ''}`;
    let micButtonBgClass = 'bg-cyan-700';
    if(voiceStatus === 'recording') micButtonBgClass = 'bg-red-500 animate-pulse-custom';
    else if (voiceStatus === 'detecting') micButtonBgClass = 'bg-cyan-500 animate-pulse-custom';


    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
            <div className="w-full max-w-md text-center">
                 <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400 mb-2">{APP_TITLE}</h1>
                </header>
            
                {inputMode === 'voice' ? (
                     <div className="flex flex-col items-center justify-center">
                        <div className={`${micButtonClasses} ${micButtonBgClass}`}>
                            <svg className="w-20 h-20 sm:w-24 sm:h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <p className="mt-8 text-lg sm:text-xl text-gray-300 h-12">{displayText}</p>
                        {error && <p className="mt-4 text-red-400">{error}</p>}
                        <button onClick={() => setInputMode('text')} className="mt-6 text-cyan-400 hover:underline">
                            Switch to Typing
                        </button>
                    </div>
                ) : (
                    <main className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full">
                        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
                        
                        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}
                        
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                            <input 
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                placeholder="Student ID or Email" 
                                required 
                                className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" 
                            />
                            <div className="relative">
                                <input 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="Password" 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400 pr-10" 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">
                                    Login
                                </button>
                                <button type="button" onClick={onNewUser} className="w-full py-2 border border-cyan-600 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-md font-semibold transition-colors">
                                    New User
                                </button>
                            </div>
                        </form>

                         <button onClick={() => setInputMode('voice')} className="mt-8 text-cyan-400 hover:underline">
                            Switch to Voice
                        </button>
                    </main>
                )}
            </div>
        </div>
    );
};

export default Auth;
