
import React, { useState, useEffect, useMemo } from 'react';
import { User, School, ElectionSettings, VotingCategory, Contestant } from '../types';
import * as voteService from '../services/voteService';
import UserAvatar from './UserAvatar';
import ConfirmationModal from './ConfirmationModal';

interface EVoteStudentPageProps {
    user: User;
    school: School;
    isKiosk?: boolean;
    onVoteComplete?: () => void;
}

const EVoteStudentPage: React.FC<EVoteStudentPageProps> = ({ user, school, isKiosk, onVoteComplete }) => {
    const [settings, setSettings] = useState<ElectionSettings | null>(null);
    const [categories, setCategories] = useState<VotingCategory[]>([]);
    const [contestants, setContestants] = useState<Contestant[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [viewResultsMode, setViewResultsMode] = useState<'winners' | 'details'>('winners');
    
    // Track specific voting status for UI feedback
    const [voteStatus, setVoteStatus] = useState<'idle' | 'casting' | 'success'>('idle');

    useEffect(() => {
        const refreshData = () => {
            const settingsData = voteService.getElectionSettings(school.id);
            setSettings(settingsData);
            setCategories(voteService.getCategoriesForSchool(school.id));
            setContestants(voteService.getContestantsForSchool(school.id));
            const studentHasVoted = voteService.hasStudentVoted(user.studentId, school.id);
            setHasVoted(studentHasVoted);

            // Load draft vote on initial load only if the student has not voted yet
            if (!studentHasVoted) {
                const draft = voteService.getDraftVote(user.studentId, school.id);
                if (draft) {
                    setSelections(draft.choices);
                }
            }
        };
        
        refreshData();
        const interval = setInterval(refreshData, 2000); // Poll for live results
        return () => clearInterval(interval);
    }, [user.studentId, school.id]);

    const now = useMemo(() => Date.now(), []);
    const isElectionOver = useMemo(() => settings ? now > settings.endTime : false, [settings, now]);
    const isVotingOpen = useMemo(() => settings ? settings.isVotingOpen && now >= settings.startTime && now <= settings.endTime : false, [settings, now]);

    const handleSelectContestant = (categoryId: string, contestantId: string) => {
        if (hasVoted || voteStatus !== 'idle') return; // Prevent changing selections after voting
        setSelections(prev => ({ ...prev, [categoryId]: contestantId }));
    };

    const handleSaveChoices = () => {
        setError('');
        setSaveSuccess(false);
        if (Object.keys(selections).length !== categories.length) {
            setError('You must select a candidate for every category before saving.');
            return;
        }
        try {
            voteService.saveDraftVote(user.studentId, school.id, selections);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 5000);
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const handleCastVote = () => {
        setError('');
        
        // 1. Validate Selections
        if (Object.keys(selections).length !== categories.length) {
            setError('You must select a candidate for every category before voting.');
            return;
        }
        
        // 2. Confirm Action
        if (window.confirm("Are you sure you want to cast your final vote? This cannot be changed.")) {
             try {
                setVoteStatus('casting');
                
                // 3. Execute Vote
                voteService.castVote(user.studentId, school.id, selections);
                
                // 4. Update UI State immediately to show success on button
                setVoteStatus('success');
                // NOTE: We do NOT setHasVoted(true) here immediately. 
                // We wait for the timeout so the user sees the "Voted Successfully" button state first.
                
                // 5. Trigger Completion Callback (for Kiosk reset) or transition to results
                setTimeout(() => {
                    if (onVoteComplete) {
                        onVoteComplete();
                    } else {
                        setHasVoted(true); // Switch to results view for non-kiosk users
                    }
                }, 2000);
            } catch (err) {
                setError((err as Error).message);
                setVoteStatus('idle');
            }
        }
    };
    
    const ResultsView = () => {
        const categoriesWithResults = useMemo(() => {
            return categories.map(category => {
                const categoryContestants = contestants
                    .filter(c => c.categoryId === category.id)
                    .sort((a, b) => b.votes - a.votes);
                const categoryTotalVotes = categoryContestants.reduce((sum, c) => sum + c.votes, 0);
                const winner = categoryContestants[0] || null;

                return { ...category, contestants: categoryContestants, totalVotes: categoryTotalVotes, winner };
            }).filter(c => c.contestants.length > 0);
        }, [categories, contestants]);

        if (viewResultsMode === 'winners' && isElectionOver) {
            return (
                <div className="space-y-8 animate-fade-in-up">
                     <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-white">Election Winners</h3>
                        <button onClick={() => setViewResultsMode('details')} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">View Detailed Results</button>
                    </div>
                    {categoriesWithResults.map(({ id, title, winner }) => (
                         winner ? (
                            <div key={id} className="bg-gradient-to-br from-cyan-700 to-gray-800 p-6 rounded-lg shadow-2xl relative overflow-hidden border-2 border-cyan-400">
                                <div className="absolute inset-0 pointer-events-none fireworks-container">
                                    <div style={{ top: '20%', left: '30%', animationDelay: '0s' }}></div>
                                    <div style={{ top: '40%', left: '80%', animationDelay: '0.4s' }}></div>
                                    <div style={{ top: '70%', left: '50%', animationDelay: '0.8s' }}></div>
                                </div>
                                <h4 className="text-xl font-bold text-yellow-300 mb-2">Winner: {title}</h4>
                                <div className="flex items-center gap-4">
                                    <UserAvatar name={winner.name} avatarUrl={winner.avatarUrl} className="w-20 h-20 rounded-full flex-shrink-0 border-4 border-yellow-300" />
                                    <div>
                                        <p className="font-bold text-2xl text-white">{winner.name}</p>
                                        <p className="text-lg text-gray-300">{winner.class}</p>
                                        <p className="font-bold text-yellow-300 mt-1">{winner.votes} Votes</p>
                                    </div>
                                </div>
                            </div>
                        ) : null
                    ))}
                </div>
            );
        }

        return (
             <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-white">{isElectionOver ? "Detailed Results" : "Live Results"}</h3>
                    {isElectionOver && <button onClick={() => setViewResultsMode('winners')} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Show Winners</button>}
                </div>
                 {categoriesWithResults.map(({ id, title, contestants, totalVotes }) => (
                     <div key={id} className="bg-gray-800 p-6 rounded-lg shadow-xl">
                        <h4 className="text-xl font-bold text-cyan-400 mb-4">{title}</h4>
                        <div className="space-y-4">
                            {contestants.map(contestant => {
                                const percentage = totalVotes > 0 ? (contestant.votes / totalVotes) * 100 : 0;
                                return (
                                    <div key={contestant.id}>
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar name={contestant.name} avatarUrl={contestant.avatarUrl} className="w-10 h-10 rounded-full" />
                                                <div>
                                                    <p className="font-semibold">{contestant.name}</p>
                                                    <p className="text-xs text-gray-400">{contestant.class}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">{contestant.votes} Votes</p>
                                                <p className="text-xs font-semibold text-cyan-300">{percentage.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                                            <div className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                 ))}
            </div>
        );
    };

    if (!settings) {
        return <div>Loading election details...</div>;
    }

    if (isElectionOver || (!settings.isVotingOpen && now > settings.startTime)) {
        return <ResultsView />;
    }

    if (hasVoted && voteStatus === 'idle') {
        // Only show this immediately if we loaded the page and they already voted.
        // If they just voted (voteStatus != idle), we show the voting view with the success button first.
        return (
            <div>
                 <div className="text-center p-8 bg-gray-800 rounded-lg mb-8">
                    <h3 className="text-2xl font-bold text-green-400">
                        {voteStatus === 'success' ? "Vote Cast Successfully!" : "Thank You for Voting!"}
                    </h3>
                    <p className="text-gray-300 mt-2">Your vote has been recorded. You can watch the live results below.</p>
                </div>
                <ResultsView />
            </div>
        );
    }
    
    // Check if all categories have a selection
    const allCategoriesSelected = categories.length > 0 && Object.keys(selections).length === categories.length;

    if (isVotingOpen) {
         return (
            <div className="animate-slide-in-left-fade">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Select Your Candidates</h2>
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}
                {saveSuccess && (
                    <div className="bg-green-500/20 text-green-300 p-3 rounded-md mb-4 text-center">
                        Your choices have been saved! Proceed to a school kiosk to cast your final vote.
                    </div>
                )}
                <div className="space-y-8">
                    {categories.map(category => {
                        const categoryContestants = contestants.filter(c => c.categoryId === category.id);
                        return (
                            <div key={category.id} className="bg-gray-800 p-6 rounded-lg shadow-xl">
                                <h3 className="text-xl font-bold text-cyan-400 mb-4">{category.title}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {categoryContestants.map(contestant => (
                                        <div key={contestant.id} onClick={() => handleSelectContestant(category.id, contestant.id)} className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${selections[category.id] === contestant.id ? 'ring-4 ring-cyan-500 bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                            <div className="flex items-center gap-4">
                                                <UserAvatar name={contestant.name} avatarUrl={contestant.avatarUrl} className="w-16 h-16 rounded-full flex-shrink-0" />
                                                <div>
                                                    <p className="font-bold text-lg">{contestant.name}</p>
                                                    <p className="text-sm text-gray-400">{contestant.class}</p>
                                                    <p className="text-sm font-bold text-cyan-300 mt-1">{contestant.votes} Votes</p>
                                                </div>
                                            </div>
                                            <details className="mt-3">
                                                <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">View Manifesto</summary>
                                                <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{contestant.manifesto}</p>
                                            </details>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-8 text-center pb-8">
                    {isKiosk ? (
                         <button 
                            onClick={handleCastVote} 
                            disabled={!allCategoriesSelected || hasVoted || voteStatus !== 'idle'} 
                            className={`px-8 py-4 rounded-lg font-bold text-xl shadow-lg transform transition hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${voteStatus === 'success' ? 'bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600'}`}
                         >
                            {voteStatus === 'success' ? "Voted Successfully" : 
                             voteStatus === 'casting' ? "Submitting..." : 
                             hasVoted ? "You Have Voted" : 
                             !allCategoriesSelected ? "Select All Candidates" : 
                             "Confirm & Cast Final Vote"}
                        </button>
                    ) : (
                        <button onClick={handleSaveChoices} disabled={!allCategoriesSelected || hasVoted} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-bold text-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {hasVoted ? "You Have Voted" : "Save My Choices"}
                        </button>
                    )}
                    {!isKiosk && <p className="text-sm text-gray-400 mt-2">Go to a Kiosk to cast your final vote.</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="text-center p-8 bg-gray-800 rounded-lg">
            <h3 className="text-2xl font-bold text-yellow-400">Voting is Currently Closed</h3>
            <p className="text-gray-300 mt-2">Please check back when the voting period is open.</p>
            {settings.startTime > now && <p className="text-sm mt-4">Voting starts on: {new Date(settings.startTime).toLocaleString()}</p>}
        </div>
    );
};

export default EVoteStudentPage;
