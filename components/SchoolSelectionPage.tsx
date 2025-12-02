
import React, { useState, useEffect, useMemo } from 'react';
import { School } from '../types';
import { getAllSchools } from '../services/schoolService';
import { transcribeAudioWithGoogle, findSchoolByNameWithAI } from '../services/apiService';

interface SchoolSelectionPageProps {
    onSchoolSelected: (school: School) => void;
    onBackToLogin: () => void;
}

const SchoolSelectionPage: React.FC<SchoolSelectionPageProps> = ({ onSchoolSelected, onBackToLogin }) => {
    const [allSchools, setAllSchools] = useState<School[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [feedback, setFeedback] = useState('Search for a school by name or use the voice assistant.');
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);

    useEffect(() => {
        setAllSchools(getAllSchools());
    }, []);

    const filteredSchools = useMemo(() => {
        if (!searchTerm) return allSchools;
        return allSchools.filter(school => school.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allSchools, searchTerm]);

    const handleVoiceSearch = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            const audioChunks: Blob[] = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                setFeedback('Processing your request...');
                try {
                    const transcript = await transcribeAudioWithGoogle(audioBlob);
                    setFeedback(`Searching for "${transcript}"...`);
                    const schoolNames = allSchools.map(s => s.name);
                    const matchedSchoolName = await findSchoolByNameWithAI(transcript, schoolNames);
                    if (matchedSchoolName) {
                        setSearchTerm(matchedSchoolName);
                        setFeedback(`Found "${matchedSchoolName}". Select it to continue.`);
                    } else {
                        setFeedback(`Could not find a school matching "${transcript}". Please try again.`);
                    }
                } catch (error) {
                    setFeedback('Sorry, I had trouble understanding that. Please try again.');
                }
                 stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setFeedback('Listening... Tap the button again when you are done speaking.');
        } catch (error) {
            setFeedback('Could not access your microphone. Please grant permission and try again.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
            <div className="w-full max-w-lg text-center">
                <h1 className="text-3xl font-bold text-cyan-400 mb-2">Select a School</h1>
                <p className="text-gray-400 mb-6">{feedback}</p>
                
                <div className="flex items-center gap-2 mb-4">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Type school name..."
                        className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                     <button
                        onClick={handleVoiceSearch}
                        className={`p-3 rounded-lg transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-cyan-600 hover:bg-cyan-700'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                </div>

                <div className="bg-gray-800 rounded-lg max-h-80 overflow-y-auto">
                    {filteredSchools.length > 0 ? (
                        filteredSchools.map(school => (
                            <div 
                                key={school.id} 
                                onClick={() => onSchoolSelected(school)}
                                className="p-4 text-left border-b border-gray-700 cursor-pointer hover:bg-gray-700"
                            >
                                <p className="font-semibold">{school.name}</p>
                                <p className="text-sm text-gray-400">{school.address}</p>
                            </div>
                        ))
                    ) : (
                        <p className="p-4 text-gray-500">No schools found.</p>
                    )}
                </div>

                 <button onClick={onBackToLogin} className="mt-6 text-cyan-400 hover:underline">
                    &larr; Back to Login
                </button>
            </div>
        </div>
    );
};

export default SchoolSelectionPage;
