import React, { useState, useRef, useEffect } from 'react';
import { User, CanteenOrder, VoteRecord, School, DraftVoteRecord } from '../types';
import * as canteenService from '../services/canteenService';
import * as voteService from '../services/voteService';
import * as studentService from '../services/studentService';
import BarcodeScanner from './BarcodeScanner';
import UserAvatar from './UserAvatar';
import PinStrengthIndicator from './PinStrengthIndicator';

// Icons
const HamburgerIcon = () => (<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const QrCodeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>);
const VoteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const CanteenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.5A1.5 1.5 0 013.5 3h1.53a1.5 1.5 0 011.42 1.049l.343.857a.5.5 0 00.47.344h4.474a.5.5 0 00.47-.344l.343-.857A1.5 1.5 0 0113.97 3H15.5A1.5 1.5 0 0117 4.5V5h-.5a.5.5 0 000 1h.5v1.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 7.5V5h.5a.5.5 0 000-1H2V4.5zM3.5 4a.5.5 0 00-.5.5V5h13V4.5a.5.5 0 00-.5-.5h-1.03a.5.5 0 00-.47.349l-.344.856a1.5 1.5 0 01-1.42 1.045H7.234a1.5 1.5 0 01-1.42-1.045l-.343-.856A.5.5 0 005.03 4H3.5zM2 12v3.5A1.5 1.5 0 003.5 17h13a1.5 1.5 0 001.5-1.5V12h-16zm1.5.5a.5.5 0 01.5-.5h12a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-12a.5.5 0 01-.5-.5v-3z"/></svg>;
const LockClosedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>);
const LockOpenIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 116 0v2h2V7a5 5 0 00-5-5z" /></svg>);


interface KioskViewProps {
    schoolId: string;
}

// --- Sub-component: Canteen Kiosk ---
const CanteenKioskView: React.FC<KioskViewProps> = ({ schoolId }) => {
    const [studentId, setStudentId] = useState('');
    const [order, setOrder] = useState<CanteenOrder | null>(null);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const [isScanning, setIsScanning] = useState(false);

    const handleCheck = () => {
        setFeedback({ message: '', type: '' });
        setOrder(null);
        if (!studentId.trim()) return;

        // Attempt to resolve student ID from potential barcode
        const resolvedId = studentService.extractStudentIdFromIdentifier(studentId, schoolId) || studentId;

        const foundOrder = canteenService.getOrderForAttendanceCheck(resolvedId, schoolId);
        if (foundOrder) {
            setOrder(foundOrder);
        } else {
            const student = studentService.getSchoolUsersBySchoolIds([schoolId]).find(u => u.studentId === resolvedId);
            if (student) {
                 setFeedback({ message: `No pending delivery found for ${student?.name || resolvedId} at this time.`, type: 'error' });
            } else {
                 setFeedback({ message: "Student ID not found.", type: 'error' });
            }
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        // FIX: Ensure decodedText is treated as a string.
        setStudentId(String(decodedText));
        setIsScanning(false);
        // Auto-trigger check after scan
        setTimeout(() => {
             // We can't call handleCheck directly due to closure on old state, so we'll rely on a useEffect or user tap.
             // For simplicity in this flow, we just set the ID.
        }, 100);
    };

    const handleSignIn = () => {
        if (!order) return;
        try {
            canteenService.signInForCanteenAttendance(order.id);
            setFeedback({ message: `${order.studentName} has been signed in. The carrier has been notified.`, type: 'success' });
            setOrder(null);
            setStudentId('');
        } catch (e) {
            setFeedback({ message: (e as Error).message, type: 'error' });
        }
    };

    return (
        <div className="max-w-md mx-auto w-full bg-gray-800 p-6 rounded-xl shadow-2xl">
            {isScanning && (
                <BarcodeScanner 
                    onScanSuccess={handleScanSuccess} 
                    onScanError={(e: Error) => console.error(e)} 
                    onClose={() => setIsScanning(false)} 
                />
            )}
            
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 mb-3">
                    <CanteenIcon />
                </div>
                <h2 className="text-2xl font-bold text-white">Canteen Attendance</h2>
                <p className="text-gray-400 text-sm">Scan ID to confirm your table reservation.</p>
            </div>

            <div className="space-y-4">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        placeholder="Student ID" 
                        className="w-full p-3 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                    <button onClick={() => setIsScanning(true)} className="p-3 bg-gray-600 rounded-lg hover:bg-gray-500">
                        <QrCodeIcon />
                    </button>
                </div>
                <button onClick={handleCheck} className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-bold text-white transition-colors">
                    Check Status
                </button>
            </div>

            {feedback.message && (
                <div className={`mt-6 p-4 rounded-lg text-center ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {feedback.message}
                </div>
            )}

            {order && (
                <div className="mt-6 bg-gray-700/50 p-4 rounded-lg border border-cyan-500/30 animate-fade-in-up">
                    <p className="text-sm text-gray-400">Student</p>
                    <p className="font-bold text-lg text-white mb-2">{order.studentName}</p>
                    <p className="text-sm text-gray-400">Assigned Seat</p>
                    <p className="font-bold text-xl text-cyan-400 mb-4">Table {order.assignedTable}</p>
                    <button onClick={handleSignIn} className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white shadow-lg">
                        Confirm Attendance
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Sub-component: E-Vote Kiosk ---
const EVoteKioskView: React.FC<KioskViewProps> = ({ schoolId }) => {
    const [studentId, setStudentId] = useState('');
    const [contestants, setContestants] = useState<any[]>([]); // To map IDs to Names
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const [isScanning, setIsScanning] = useState(false);
    const [draftToConfirm, setDraftToConfirm] = useState<DraftVoteRecord | null>(null);
    const [isCasting, setIsCasting] = useState(false);

    useEffect(() => {
        setContestants(voteService.getContestantsForSchool(schoolId));
    }, [schoolId]);

    const handleCheckVote = () => {
        setFeedback({ message: '', type: '' });
        setDraftToConfirm(null);
        if (!studentId.trim()) return;

        const resolvedId = studentService.extractStudentIdFromIdentifier(studentId, schoolId) || studentId;
        
        // 1. Check if already voted
        const finalVote = voteService.getStudentVoteRecord(resolvedId, schoolId);
        if (finalVote) {
            setFeedback({ message: `Vote already recorded for Student ID ${resolvedId}.`, type: 'success' });
            return;
        }

        // 2. If not, check for a draft vote
        const draftVote = voteService.getDraftVote(resolvedId, schoolId);
        if (draftVote) {
            setDraftToConfirm(draftVote);
            return;
        }

        // 3. If neither, show message to pre-select
        const student = studentService.getSchoolUsersBySchoolIds([schoolId]).find(u => u.studentId === resolvedId);
        if (student) {
             setFeedback({ message: `Welcome, ${student.name}. Please select your candidates on the 360 Smart School app first, then scan your ID here to cast your vote.`, type: 'error' });
        } else {
             setFeedback({ message: "Student ID not found.", type: 'error' });
        }
    };

    const handleConfirmAndCastVote = async () => {
        if (!draftToConfirm) return;

        setIsCasting(true);
        setFeedback({ message: 'Casting your vote securely...', type: 'info' });

        try {
            await new Promise(res => setTimeout(res, 1500)); // Simulate network latency
            voteService.castVote(draftToConfirm.studentId, schoolId, draftToConfirm.choices);
            setDraftToConfirm(null);
            setStudentId(''); // Clear input
            setFeedback({ message: 'Your vote has been successfully cast! Thank You for participating.', type: 'success' });
        } catch(e) {
            setFeedback({ message: (e as Error).message, type: 'error' });
        } finally {
            setIsCasting(false);
        }
    };

    // FIX: Use 'any' to allow unknown from BarcodeScanner and cast to string inside
    const handleScanSuccess = (text: any) => {
        setStudentId(String(text));
        setIsScanning(false);
    };

    const getCandidateName = (contestantId: string) => {
        return contestants.find(c => c.id === contestantId)?.name || "Unknown Candidate";
    };
    const getCategoryTitle = (categoryId: string) => {
        const categories = voteService.getCategoriesForSchool(schoolId);
        return categories.find(c => c.id === categoryId)?.title || "Unknown Category";
    };

    return (
        <div className="max-w-md mx-auto w-full bg-gray-800 p-6 rounded-xl shadow-2xl">
             {isScanning && (
                <BarcodeScanner 
                    onScanSuccess={handleScanSuccess} 
                    onScanError={(e: Error) => console.error(e)} 
                    onClose={() => setIsScanning(false)} 
                />
            )}

            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-3">
                    <VoteIcon />
                </div>
                <h2 className="text-2xl font-bold text-white">Verify & Cast Vote</h2>
                <p className="text-gray-400 text-sm">Scan ID to confirm your saved ballot.</p>
            </div>

            <div className="space-y-4">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        placeholder="Student ID" 
                        className="w-full p-3 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={() => setIsScanning(true)} className="p-3 bg-gray-600 rounded-lg hover:bg-gray-500">
                        <QrCodeIcon />
                    </button>
                </div>
                <button onClick={handleCheckVote} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-white transition-colors">
                    Check Ballot
                </button>
            </div>

             {feedback.message && (
                <div className={`mt-6 p-4 rounded-lg text-center ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : feedback.type === 'info' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-red-500/20 text-red-300'}`}>
                    {feedback.message}
                </div>
            )}
            
            {/* Removed the display of draftToConfirm content to preserve privacy */}
            {draftToConfirm && !isCasting && (
                <div className="mt-6 animate-fade-in-up">
                    <p className="text-xl font-bold text-center text-cyan-400 mb-4">You have a saved ballot. Confirm to cast your vote.</p>
                    <p className="text-xs text-yellow-400 text-center mt-4">This action is final and cannot be undone.</p>
                    <button 
                        onClick={handleConfirmAndCastVote}
                        disabled={isCasting}
                        className="w-full py-3 mt-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white transition-colors disabled:bg-gray-500"
                    >
                        {isCasting ? 'Casting...' : 'Confirm & Cast Final Vote'}
                    </button>
                </div>
            )}
        </div>
    );
};


interface ExplorationPageProps {
    user: User;
    school?: School;
    onKioskLockChange?: (isLocked: boolean) => void;
}

const ExplorationPage: React.FC<ExplorationPageProps> = ({ user, school: propSchool, onKioskLockChange }) => {
    const [activeView, setActiveView] = useState<'home' | 'evote' | 'ecanteen'>('home');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Locking mechanism state
    const [isLocked, setIsLocked] = useState(false);
    const [lockPin, setLockPin] = useState('');
    const [unlockPin, setUnlockPin] = useState('');
    const [showLockModal, setShowLockModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [error, setError] = useState('');

    // Derive school ID. If propSchool is passed (e.g. from StudentPage), use it.
    // Otherwise, try to derive from user (e.g. if Admin is previewing).
    const schoolId = propSchool?.id || user.schoolId || (user as any).assignedSchoolIds?.[0];

    useEffect(() => {
        if (isLocked) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isLocked]);

    if (!schoolId) {
        return <div className="p-8 text-center text-red-400">Error: Kiosk is not assigned to a school.</div>;
    }

    const handleSetLock = () => {
        if (lockPin.length !== 4) {
            setError("PIN must be 4 digits.");
            return;
        }
        setIsLocked(true);
        onKioskLockChange?.(true);
        setShowLockModal(false);
        setError('');
    };

    const handleUnlock = () => {
        if (unlockPin === lockPin) {
            setIsLocked(false);
            onKioskLockChange?.(false);
            setShowUnlockModal(false);
            setUnlockPin('');
            setLockPin(''); // Reset lock PIN on unlock
            setError('');
        } else {
            setError("Incorrect PIN.");
        }
    };

    return (
        <div className="h-full relative bg-gray-900 flex flex-col overflow-hidden font-sans">
            {/* Lock Setup Modal */}
            {showLockModal && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[10000] p-4 animate-fade-in-up">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-sm w-full text-center">
                        <h3 className="text-xl font-bold text-white mb-2">Set Kiosk Lock</h3>
                        <p className="text-gray-400 text-sm mb-4">Enter a 4-digit PIN to lock the interface. You will need this PIN to unlock it.</p>
                        <input 
                            type="password" 
                            value={lockPin} 
                            onChange={e => setLockPin(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                            className="w-full p-3 bg-gray-700 rounded-lg text-center text-2xl tracking-[1em] mb-2"
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                        <div className="flex gap-2 justify-center">
                            <button onClick={() => setShowLockModal(false)} className="px-4 py-2 bg-gray-600 rounded-md">Cancel</button>
                            <button onClick={handleSetLock} className="px-4 py-2 bg-indigo-600 rounded-md font-bold">Lock Interface</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Modal */}
            {showUnlockModal && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[10001] p-4 animate-fade-in-up">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-sm w-full text-center shadow-2xl border border-red-500/50">
                        <h3 className="text-xl font-bold text-white mb-2">Unlock Kiosk</h3>
                        <p className="text-gray-400 text-sm mb-4">Enter the session PIN to unlock.</p>
                        <input 
                            type="password" 
                            value={unlockPin} 
                            onChange={e => setUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                            className="w-full p-3 bg-gray-700 rounded-lg text-center text-2xl tracking-[1em] mb-2"
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                        <div className="flex gap-2 justify-center">
                            <button onClick={() => { setShowUnlockModal(false); setError(''); setUnlockPin(''); }} className="px-4 py-2 bg-gray-600 rounded-md">Cancel</button>
                            <button onClick={handleUnlock} className="px-4 py-2 bg-red-600 rounded-md font-bold">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Headers - Only show if NOT locked */}
            {!isLocked && (
                <header className="p-4 flex items-center justify-between bg-gray-800 shadow-md z-20">
                    <button onClick={() => setIsMenuOpen(true)} className="text-white hover:text-cyan-400 transition-colors">
                        <HamburgerIcon />
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-wider">SMART KIOSK</h1>
                    {activeView !== 'home' ? (
                         <button 
                            onClick={() => { setLockPin(''); setError(''); setShowLockModal(true); }} 
                            className="flex items-center gap-1 px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full border border-indigo-500 hover:bg-indigo-900 transition-colors text-sm"
                        >
                             <LockClosedIcon />
                             <span className="hidden sm:inline">Lock Interface</span>
                         </button>
                    ) : <div className="w-8"></div>}
                </header>
            )}

            {/* Sidebar Navigation - Only show if NOT locked */}
            {!isLocked && (
                <div className={`fixed inset-0 z-30 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
                    <nav className="relative w-64 h-full bg-gray-800 shadow-2xl flex flex-col p-6">
                        <div className="flex justify-end mb-8">
                            <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <button 
                                onClick={() => { setActiveView('home'); setIsMenuOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeView === 'home' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                Home
                            </button>
                            <button 
                                onClick={() => { setActiveView('evote'); setIsMenuOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors flex items-center gap-3 ${activeView === 'evote' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                <VoteIcon /> E-Vote Check
                            </button>
                            <button 
                                onClick={() => { setActiveView('ecanteen'); setIsMenuOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors flex items-center gap-3 ${activeView === 'ecanteen' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                <CanteenIcon /> E-Canteen Check-In
                            </button>
                        </div>

                        <div className="mt-auto text-center text-gray-500 text-xs">
                            <p>School ID: {schoolId}</p>
                            <p>Kiosk Mode Active</p>
                        </div>
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center relative ${isLocked ? 'bg-black' : ''}`}>
                {/* Background Decoration - Only if NOT locked to minimize distraction */}
                {!isLocked && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
                    </div>
                )}
                
                {/* Locked State Unlock Button */}
                {isLocked && (
                    <button 
                        onClick={() => { setUnlockPin(''); setError(''); setShowUnlockModal(true); }}
                        className="absolute top-4 right-4 p-2 bg-gray-800/50 hover:bg-red-600/80 text-white rounded-full z-50 opacity-30 hover:opacity-100 transition-opacity"
                        title="Unlock Interface"
                    >
                        <LockOpenIcon />
                    </button>
                )}

                <div className="relative w-full max-w-3xl">
                    {activeView === 'home' && (
                        <div className="text-center animate-fade-in-up">
                            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">Welcome to the Smart Kiosk</h2>
                            <p className="text-gray-300 text-lg mb-12">Please select a service from the menu to begin.</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <button onClick={() => setActiveView('evote')} className="p-6 bg-gray-800 rounded-xl hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 transition-all group">
                                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400 group-hover:scale-110 transition-transform">
                                        <VoteIcon />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Verify Vote</h3>
                                    <p className="text-sm text-gray-400 mt-2">Check your election ballot status</p>
                                </button>

                                <button onClick={() => setActiveView('ecanteen')} className="p-6 bg-gray-800 rounded-xl hover:bg-gray-700 border border-gray-700 hover:border-teal-500 transition-all group">
                                    <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-teal-400 group-hover:scale-110 transition-transform">
                                        <CanteenIcon />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Canteen Attendance</h3>
                                    <p className="text-sm text-gray-400 mt-2">Sign in for your meal delivery</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeView === 'evote' && <EVoteKioskView schoolId={schoolId} />}
                    
                    {activeView === 'ecanteen' && <CanteenKioskView schoolId={schoolId} />}
                </div>
            </main>
        </div>
    );
};

export default ExplorationPage;
