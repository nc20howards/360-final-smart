
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ConversationEntry } from '../types';
import { getAIResponse } from '../services/apiService';
import { addMessage, getHistory, clearHistory, updateMessageFeedback } from '../services/dbService';
import { AI_ASSISTANT_NAME } from '../constants';
import AIAvatar from './AIAvatar';
import ConfirmationModal from './ConfirmationModal';
import { getAllSchools } from '../services/schoolService';

interface ChatProps {
    user: User;
    onClose?: () => void;
}

const Chat: React.FC<ChatProps> = ({ user, onClose }) => {
    const [history, setHistory] = useState<ConversationEntry[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const systemInstruction = useMemo(() => {
        const schoolName = user.schoolId ? getAllSchools().find(s => s.id === user.schoolId)?.name : 'N/A';

        let academicSummary = 'No academic records available.';
        
        // Prioritize UNEB results if available
        if (user.unebPassSlip) {
            const slip = user.unebPassSlip;
            const subjectSummary = slip.subjects.map(s => `- ${s.name}: ${s.grade}`).join('\n');
            academicSummary = `Latest UNEB Results (${slip.level} - ${slip.year}):\n` +
                              `Result: ${slip.result || 'N/A'}\n` +
                              `Aggregate: ${slip.aggregate || 'N/A'}\n` +
                              `Subjects and Grades:\n${subjectSummary}`;
        } 
        // Otherwise, use the latest internal exam result
        else if (user.internalExams && user.internalExams.length > 0) {
            const latestExam = [...user.internalExams].sort((a, b) => b.term.localeCompare(a.term))[0];
            const allSubjects = latestExam.subjects
                .map(s => `- ${s.name}: ${s.score}% (${s.grade})`)
                .join('\n');
            
            academicSummary = `Latest School Exam (${latestExam.term}):\n` +
                              `Average Score: ${latestExam.average.toFixed(1)}%\n` +
                              `Class Position: ${latestExam.classPosition}\n` +
                              `Subjects and Performance:\n${allSubjects}`;
        }

        return `You are ${AI_ASSISTANT_NAME}, a friendly, intelligent, and personalized AI assistant for a student.

Your capabilities:
1. Answer general knowledge questions on any topic.
2. Provide information about the student based on the data provided below.
3. Remember the context of the current conversation.

When asked about the student, use the following information. Do not make up information if it is not provided. Do not mention that this data was provided to you in a prompt; just answer naturally as if you know it.

**Student Information:**
- Name: ${user.name}
- Student ID: ${user.studentId}
- School: ${schoolName}
- Class: ${user.class || 'N/A'}${user.stream ? ` / ${user.stream}` : ''}
- Email: ${user.email || 'N/A'}
- Bio: ${user.bio || 'Not provided'}

**Academic Summary:**
${academicSummary}

Always be helpful, encouraging, and concise in your responses.
`;
    }, [user]);

    useEffect(() => {
        const loadHistory = async () => {
            if (!user.studentId) return;
            try {
                const savedHistory = await getHistory(user.studentId);
                setHistory(savedHistory);
            } catch (error) {
                console.error("Failed to load conversation history:", error);
            }
        };
        loadHistory();
    }, [user.studentId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isLoading]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const userQuery = userInput.trim();
        const tempId = `temp_${Date.now()}`;

        // Add user query and a placeholder for the AI response immediately
        setHistory(prev => [...prev, { id: tempId, userId: user.studentId, userQuery, aiResponse: '', timestamp: new Date(), feedback: null }]);
        setUserInput('');
        setIsLoading(true);

        try {
            // Pass current history for context, excluding the temporary placeholder
            const contextHistory = history.filter(h => typeof h.id === 'number');

            const finalResponse = await getAIResponse(userQuery, systemInstruction, (chunk) => {
                setHistory(prev =>
                    prev.map(entry =>
                        entry.id === tempId
                            ? { ...entry, aiResponse: entry.aiResponse + chunk }
                            : entry
                    )
                );
            }, contextHistory);

            // Once streaming is complete, save the final response to the database
            const newId = await addMessage({ userId: user.studentId, userQuery, aiResponse: finalResponse, timestamp: new Date() });

            // Update the temporary entry with the final one from the database
            setHistory(prev =>
                prev.map(entry =>
                    entry.id === tempId
                        ? { ...entry, id: newId, aiResponse: finalResponse }
                        : entry
                )
            );

        } catch (error) {
            console.error("Failed to get AI response:", error);
            const errorMessage = "Sorry, I couldn't get a response. Please check your connection and try again.";
            setHistory(prev =>
                prev.map(entry =>
                    entry.id === tempId
                        ? { ...entry, aiResponse: errorMessage }
                        : entry
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmClear = async () => {
        try {
            await clearHistory(user.studentId);
            setHistory([]);
        } catch (error) {
            console.error("Failed to clear history:", error);
        } finally {
            setIsConfirmModalOpen(false);
        }
    };

    const handleClearHistory = () => {
        setIsConfirmModalOpen(true);
    };

    const handleFeedback = async (id: number | string, feedbackType: 'up' | 'down') => {
        if (typeof id !== 'number') return; // Only allow feedback on saved messages

        const currentEntry = history.find(entry => entry.id === id);
        const newFeedback = currentEntry?.feedback === feedbackType ? null : feedbackType;

        // Optimistically update UI
        setHistory(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, feedback: newFeedback } : entry
            )
        );

        try {
            await updateMessageFeedback(id, newFeedback);
        } catch (error) {
            console.error("Failed to save feedback:", error);
            // Revert UI on error
            setHistory(prev =>
                prev.map(entry =>
                    entry.id === id ? { ...entry, feedback: currentEntry?.feedback } : entry
                )
            );
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                title="Clear Conversation"
                message={<p>Are you sure you want to permanently delete your conversation history? This action cannot be undone.</p>}
                onConfirm={handleConfirmClear}
                onCancel={() => setIsConfirmModalOpen(false)}
                confirmText="Delete"
                confirmButtonVariant="danger"
            />
            <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">{AI_ASSISTANT_NAME}</h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleClearHistory}
                            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                            title="Clear Conversation"
                            disabled={history.length === 0}
                            aria-label="Clear conversation history"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors"
                                title="Close Chat"
                                aria-label="Close chat panel"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-6">
                        {history.map((entry, index) => (
                            <React.Fragment key={entry.id}>
                                {/* User Query */}
                                <div className="flex justify-end animate-slide-in-right">
                                    <div className="bg-cyan-500 shadow-md rounded-lg p-3 max-w-lg">
                                        <p className="whitespace-pre-wrap text-white">{entry.userQuery}</p>
                                    </div>
                                </div>
                                {/* AI Response */}
                                <div className="animate-slide-in-left-fade">
                                    <div className="flex items-start space-x-3">
                                        <AIAvatar status={isLoading && index === history.length - 1 ? 'thinking' : 'idle'} />
                                        <div className="bg-gray-700 shadow-md border border-gray-600/50 rounded-lg p-3 max-w-lg">
                                            {entry.aiResponse ? (
                                                <p className="whitespace-pre-wrap text-white">{entry.aiResponse}</p>
                                            ) : (
                                                <div className="flex items-end space-x-1.5 h-5">
                                                    <div className="w-2 h-2 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0s' }}></div>
                                                    <div className="w-2 h-2 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }}></div>
                                                    <div className="w-2 h-2 bg-cyan-200 rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Feedback Icons */}
                                    {entry.aiResponse && typeof entry.id === 'number' && (
                                        <div className="flex justify-start pl-14 mt-2 space-x-2">
                                            <button
                                                onClick={() => handleFeedback(entry.id!, 'up')}
                                                className={`p-1 rounded-full transition-colors ${entry.feedback === 'up' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                                                title="Helpful"
                                                aria-label="Mark response as helpful"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleFeedback(entry.id!, 'down')}
                                                className={`p-1 rounded-full transition-colors ${entry.feedback === 'down' ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                                                title="Not Helpful"
                                                aria-label="Mark response as not helpful"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.642a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l2.4-3.6a4 4 0 00.8-2.4z" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </main>

                <footer className="p-4 border-t border-gray-700">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask me anything..."
                            className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="p-3 bg-cyan-600 rounded-full text-white hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            disabled={isLoading || !userInput.trim()}
                            title="Send Message"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" transform="rotate(90 12 12)" />
                            </svg>
                        </button>
                    </form>
                </footer>
            </div>
        </>
    );
};

export default Chat;
