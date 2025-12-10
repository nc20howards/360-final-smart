
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { School } from '../types';
import { getAllSchools } from '../services/schoolService';
import { getHomePageContent } from '../services/homePageService';
import { transcribeAudioWithGoogle, findSchoolByNameWithAI } from '../services/apiService';
import UserAvatar from './UserAvatar';
import MapView from './MapView';

const SchoolDirectory: React.FC = () => {
    const [allSchools, setAllSchools] = useState<School[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [feedback, setFeedback] = useState('Search for a school by name or address.');
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        setAllSchools(getAllSchools());
    }, []);

    const filteredSchools = useMemo(() => {
        if (!searchTerm) return allSchools;
        const lowercasedTerm = searchTerm.toLowerCase();
        return allSchools.filter(school => 
            school.name.toLowerCase().includes(lowercasedTerm) || 
            school.address.toLowerCase().includes(lowercasedTerm)
        );
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
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setFeedback('Processing your request...');
                try {
                    const transcript = await transcribeAudioWithGoogle(audioBlob);
                    setFeedback(`I heard "${transcript}". Finding the best match...`);
                    const schoolNames = allSchools.map(s => s.name);
                    const matchedSchoolName = await findSchoolByNameWithAI(transcript, schoolNames);
                    if (matchedSchoolName) {
                        setSearchTerm(matchedSchoolName);
                        setFeedback(`Found "${matchedSchoolName}".`);
                    } else {
                        setFeedback(`Could not find a school matching "${transcript}". Please try again.`);
                    }
                } catch (error) {
                    console.error("Voice search error:", error);
                    setFeedback('Sorry, I had trouble understanding that. Please try again.');
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setFeedback('Listening... Tap the button again when you are done speaking.');
        } catch (error) {
            console.error("Mic access error:", error);
            setFeedback('Could not access your microphone. Please grant permission and try again.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                <p className="text-gray-300 text-sm mb-2">{feedback}</p>
                <div className="flex items-center gap-2">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Type school name or address..."
                        className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    />
                    <button
                        onClick={handleVoiceSearch}
                        className={`p-3 rounded-lg transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-cyan-600 hover:bg-cyan-700'}`}
                        aria-label={isRecording ? 'Stop recording' : 'Start voice search'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSchools.map(school => {
                    const homeContent = getHomePageContent(school.id);
                    return (
                        <div key={school.id} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
                            <div className="p-4 flex items-center gap-4 cursor-pointer flex-grow" onClick={() => setSelectedSchool(school)}>
                                <UserAvatar name={school.name} avatarUrl={homeContent.hero.logoUrl} className="w-16 h-16 rounded-full flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-lg text-white">{school.name}</h3>
                                    <p className="text-sm text-gray-400 line-clamp-2">{school.address}</p>
                                </div>
                            </div>
                            <div className="bg-gray-700/50 px-4 py-3 flex justify-between items-center border-t border-gray-700">
                                <span className="text-xs text-gray-500">{school.modules.length} Modules</span>
                                <button onClick={() => setSelectedSchool(school)} className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    View Map
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filteredSchools.length === 0 && (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <p className="text-gray-400 font-semibold">No schools found.</p>
                </div>
            )}

            {/* Map Modal */}
            {selectedSchool && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[150] p-4" onClick={() => setSelectedSchool(null)}>
                    <div className="bg-gray-800 w-full max-w-4xl h-[80vh] rounded-lg overflow-hidden relative flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-700">
                             <div className="flex items-center gap-3">
                                <UserAvatar name={selectedSchool.name} avatarUrl={getHomePageContent(selectedSchool.id).hero.logoUrl} className="w-8 h-8 rounded-full border border-gray-600" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">{selectedSchool.name}</h3>
                                    <p className="text-xs text-gray-400 hidden sm:block">ID: {selectedSchool.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSchool(null)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 relative bg-black">
                             <MapView query={`${selectedSchool.name}, ${selectedSchool.address}`} className="w-full h-full" />
                        </div>
                        <div className="p-4 bg-gray-900 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                             <p className="text-gray-300 text-sm"><span className="font-semibold text-white">Address:</span> {selectedSchool.address}</p>
                             <div className="flex gap-2">
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedSchool.name}, ${selectedSchool.address}`)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-md transition-colors"
                                >
                                    Open in Google Maps
                                </a>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchoolDirectory;
