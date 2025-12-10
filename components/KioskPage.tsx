
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, School, CanteenOrder } from '../types';
import * as voteService from '../services/voteService';
import * as canteenService from '../services/canteenService';
import * as visitorService from '../services/visitorService';
import * as apiService from '../services/apiService';
import * as kioskService from '../services/kioskService';
import { getSchoolUsersBySchoolIds } from '../services/studentService';
import EVoteStudentPage from './EVoteStudentPage';
import { HomeIcon, VisitorIcon, CanteenIcon, VotingIcon, CloseIcon, HamburgerIcon, QrCodeIcon, SparklesIcon } from './Icons';
import UserAvatar from './UserAvatar';
import BarcodeScanner from './BarcodeScanner';

interface KioskPageProps {
    user: User;
    school: School;
}

type KioskView = 'home' | 'e-vote' | 'canteen-attendance' | 'visitor-checkin' | 'qr-hub';

// Additional Icons for Kiosk
const LockClosedIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const LockOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>;
const SwitchCameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.695v4.992h-4.992" /></svg>;

const ADMIN_DEFAULT_PASSWORD = "admin";

// Helper to validate and extract ID from scanned code (handling Smart ID JSON)
const parseAndValidateScannedCode = (code: string, currentSchoolId: string): string => {
    try {
        const parsed = JSON.parse(code);
        // Check if it's a Smart ID object
        if (parsed && typeof parsed === 'object') {
            // Validate School ID if present in the QR
            if ('schoolId' in parsed) {
                if (parsed.schoolId !== currentSchoolId) {
                     throw new Error(`Invalid Card: This ID belongs to a different school.`);
                }
                return parsed.studentId || '';
            }
        }
    } catch (e) {
        // Not JSON, assume plain text ID (Legacy barcode)
    }
    return code; // Return original string if not JSON or if schoolId validation passed
};

const KioskPage: React.FC<KioskPageProps> = ({ user, school }) => {
    const [view, setView] = useState<KioskView>('home');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [autoFillId, setAutoFillId] = useState('');
    
    // -- Locking Logic States --
    const [isLocked, setIsLocked] = useState(false);
    const [lockConfirmation, setLockConfirmation] = useState<{ targetView: KioskView, label: string } | null>(null);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');

    const handleNavClick = (newView: KioskView, label: string) => {
        if (isLocked) return; // Prevent navigation if locked

        // Clear autofill unless we are staying within a flow that needs it
        setAutoFillId('');

        if (newView === 'home') {
            setView('home');
            setIsSidebarExpanded(false);
        } else {
            // Trigger Lock Confirmation
            setLockConfirmation({ targetView: newView, label });
            setIsSidebarExpanded(false);
        }
    };

    const handleHubNavigate = (targetView: KioskView, studentId: string) => {
        setAutoFillId(studentId);
        setView(targetView);
    };

    const handleBackToHub = () => {
        setView('qr-hub');
        // We keep autoFillId briefly so the user context isn't lost immediately if they misclicked, 
        // but typically navigating back to hub resets the flow.
        // Let's reset it to ensure clean state when they scan again.
        setAutoFillId('');
    };

    const confirmLock = () => {
        if (lockConfirmation) {
            setView(lockConfirmation.targetView);
            setIsLocked(true);
            setLockConfirmation(null);
        }
    };

    const cancelLock = () => {
        setLockConfirmation(null);
    };

    const initiateUnlock = () => {
        setShowUnlockModal(true);
        setPasswordInput('');
        setAuthError('');
    };

    const handleUnlockSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === ADMIN_DEFAULT_PASSWORD) {
            setIsLocked(false);
            setShowUnlockModal(false);
            setView('home'); // Return to home on unlock
            setAutoFillId('');
        } else {
            setAuthError("Incorrect password.");
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'qr-hub':
                return <QRHubView school={school} onNavigate={handleHubNavigate} />;
            case 'e-vote':
                return <EVoteKioskView school={school} initialId={autoFillId} onBack={autoFillId ? handleBackToHub : undefined} />;
            case 'canteen-attendance':
                return <CanteenKioskView school={school} initialId={autoFillId} onBack={autoFillId ? handleBackToHub : undefined} />;
            case 'visitor-checkin':
                return <VisitorKioskView schoolId={school.id} onReturnToHome={() => { /* Navigation handled by admin unlock */ }} />;
            case 'home':
            default:
                return (
                    <div className="text-center animate-fade-in-up">
                        <h1 className="text-4xl font-bold text-white mb-4">Welcome to the Kiosk</h1>
                        <p className="text-gray-400 text-lg mb-8">Please select a service to enter Kiosk Mode.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-4">
                             <button onClick={() => handleNavClick('qr-hub', 'QR Code Hub')} className="p-6 bg-gray-800 hover:bg-gray-700 rounded-xl flex flex-col items-center gap-4 border-2 border-cyan-500/50 hover:border-cyan-400 transition-all hover:-translate-y-1 hover:shadow-lg group">
                                <div className="p-4 bg-cyan-500/20 rounded-full text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors"><QrCodeIcon /></div>
                                <span className="font-bold text-lg">QR Code Hub</span>
                                <span className="text-xs text-gray-400">Scan once for all tasks</span>
                             </button>
                             <button onClick={() => handleNavClick('e-vote', 'E-Voting')} className="p-6 bg-gray-800 hover:bg-gray-700 rounded-xl flex flex-col items-center gap-4 border border-gray-700 transition-all hover:-translate-y-1 hover:shadow-lg group">
                                <div className="p-4 bg-purple-500/20 rounded-full text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors"><VotingIcon /></div>
                                <span className="font-bold text-lg">E-Voting</span>
                             </button>
                             <button onClick={() => handleNavClick('canteen-attendance', 'Canteen Check-in')} className="p-6 bg-gray-800 hover:bg-gray-700 rounded-xl flex flex-col items-center gap-4 border border-gray-700 transition-all hover:-translate-y-1 hover:shadow-lg group">
                                <div className="p-4 bg-green-500/20 rounded-full text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors"><CanteenIcon /></div>
                                <span className="font-bold text-lg">Canteen Check-in</span>
                             </button>
                             <button onClick={() => handleNavClick('visitor-checkin', 'Visitor Access')} className="p-6 bg-gray-800 hover:bg-gray-700 rounded-xl flex flex-col items-center gap-4 border border-gray-700 transition-all hover:-translate-y-1 hover:shadow-lg group">
                                <div className="p-4 bg-orange-500/20 rounded-full text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors"><VisitorIcon /></div>
                                <span className="font-bold text-lg">Visitor Access</span>
                             </button>
                        </div>
                    </div>
                );
        }
    };

    const NavItem = ({ id, label, icon }: { id: KioskView, label: string, icon: React.ReactNode }) => (
        <button 
            onClick={() => handleNavClick(id, label)} 
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${view === id ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
            title={!isSidebarExpanded ? label : ''}
        >
            <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center ${!isSidebarExpanded ? 'mx-auto' : ''}`}>{icon}</span>
            <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{label}</span>
        </button>
    );

    return (
        <div className={`flex bg-gray-900 text-white overflow-hidden transition-all duration-300 ${isLocked ? 'fixed inset-0 z-[9999] h-screen w-screen rounded-none' : 'h-full rounded-lg relative'}`}>
            
            {/* --- CONFIRM LOCK MODAL --- */}
            {lockConfirmation && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border-2 border-cyan-500 shadow-2xl">
                        <div className="w-16 h-16 bg-cyan-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LockClosedIcon />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Enter Kiosk Mode?</h3>
                        <p className="text-gray-300 mb-6">
                            You are about to enter <strong>{lockConfirmation.label}</strong>. 
                            The interface will be locked to this feature until an admin unlocks it.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={cancelLock} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">Cancel</button>
                            <button onClick={confirmLock} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold shadow-lg">Confirm & Lock</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- UNLOCK MODAL --- */}
            {showUnlockModal && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full border border-red-500/30 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Admin Unlock</h3>
                            <button onClick={() => setShowUnlockModal(false)} className="text-gray-400 hover:text-white"><CloseIcon/></button>
                        </div>
                        <form onSubmit={handleUnlockSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                <input 
                                    type="password" 
                                    autoFocus
                                    value={passwordInput} 
                                    onChange={(e) => { setPasswordInput(e.target.value); setAuthError(''); }}
                                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                                    placeholder="Enter admin password"
                                />
                                {authError && <p className="text-red-400 text-xs mt-2">{authError}</p>}
                            </div>
                            <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">
                                Unlock Kiosk
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- SIDEBAR (Hidden when locked) --- */}
            {!isLocked && (
                <nav className={`bg-gray-800 flex flex-col border-r border-gray-700 transition-all duration-300 ease-in-out z-20 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
                    <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700 flex-shrink-0">
                        <h2 className={`text-xl font-bold text-cyan-400 truncate transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>Kiosk</h2>
                        <button 
                            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} 
                            className={`p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors ${!isSidebarExpanded ? 'mx-auto' : ''}`}
                            aria-label={isSidebarExpanded ? "Collapse menu" : "Expand menu"}
                        >
                            <HamburgerIcon/>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        <NavItem id="home" label="Home" icon={<HomeIcon/>} />
                        <NavItem id="qr-hub" label="QR Code" icon={<QrCodeIcon/>} />
                        <NavItem id="e-vote" label="E-Vote" icon={<VotingIcon/>} />
                        <NavItem id="canteen-attendance" label="Canteen Attendance" icon={<CanteenIcon/>} />
                        <NavItem id="visitor-checkin" label="Visitor Check-in" icon={<VisitorIcon/>} />
                    </div>
                </nav>
            )}

            <main className="flex-1 relative overflow-hidden bg-gray-900 flex flex-col">
                
                {/* --- FLOATING ADMIN UNLOCK BUTTON (Visible only when locked) --- */}
                {isLocked && (
                    <button 
                        onClick={initiateUnlock}
                        className="absolute top-4 right-4 z-50 p-3 bg-black/30 hover:bg-red-600 text-white/50 hover:text-white rounded-full transition-all duration-300 backdrop-blur-sm shadow-lg border border-white/5"
                        title="Admin Unlock"
                        aria-label="Unlock Kiosk"
                    >
                        <LockClosedIcon />
                    </button>
                )}

                <div className="flex-1 relative overflow-auto p-8 flex items-center justify-center">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

// --- QR Hub View ---
const QRHubView: React.FC<{ school: School, onNavigate: (view: KioskView, id: string) => void }> = ({ school, onNavigate }) => {
    const [step, setStep] = useState<'start' | 'scanning' | 'results'>('start');
    const [scannedId, setScannedId] = useState('');
    const [tasks, setTasks] = useState<{ type: string, label: string, detail: string, icon: React.ReactNode, action: () => void, priority: 'high' | 'normal' }[]>([]);
    const [studentName, setStudentName] = useState('');
    const [scanError, setScanError] = useState('');

    const handleScanSuccess = (code: string) => {
        setScanError('');
        
        let id = '';
        try {
            id = parseAndValidateScannedCode(code, school.id);
        } catch (e) {
            setScanError((e as Error).message);
            setStep('start');
            return;
        }

        if (!id) return;

        // Verify user exists first
        const schoolStudents = getSchoolUsersBySchoolIds([school.id]);
        const student = schoolStudents.find(s => s.studentId.toLowerCase() === id.toLowerCase());
        
        if (!student) {
            setScanError(`Student ID "${id}" not found in this school.`);
            setStep('start');
            return;
        }

        setScannedId(student.studentId);
        setStudentName(student.name);
        
        const detectedTasks = [];

        // Check 1: Pending Votes
        const draftVote = voteService.getDraftVote(student.studentId, school.id);
        const hasVoted = voteService.hasStudentVoted(student.studentId, school.id);
        const electionSettings = voteService.getElectionSettings(school.id);
        const isVotingOpen = electionSettings.isVotingOpen && Date.now() >= electionSettings.startTime && Date.now() <= electionSettings.endTime;

        if (isVotingOpen && !hasVoted) {
            if (draftVote) {
                detectedTasks.push({
                    type: 'vote',
                    label: 'Cast Saved Vote',
                    detail: 'You have a draft vote waiting to be submitted.',
                    icon: <VotingIcon />,
                    action: () => onNavigate('e-vote', student.studentId),
                    priority: 'high'
                });
            } else {
                 detectedTasks.push({
                    type: 'vote',
                    label: 'Vote Now',
                    detail: 'Voting is open. Cast your vote.',
                    icon: <VotingIcon />,
                    action: () => onNavigate('e-vote', student.studentId),
                    priority: 'normal'
                });
            }
        }

        // Check 2: Canteen Attendance
        const activeOrder = canteenService.getOrderForAttendanceCheck(student.studentId, school.id);
        if (activeOrder) {
             detectedTasks.push({
                type: 'canteen',
                label: 'Canteen Sign-In',
                detail: `Order #${activeOrder.id.slice(-6)} is ready for check-in.`,
                icon: <CanteenIcon />,
                action: () => onNavigate('canteen-attendance', student.studentId),
                priority: 'high'
            });
        }

        // Check 3: Visitor Access (Generic Shortcut)
        detectedTasks.push({
            type: 'visitor',
            label: 'Visitor Access',
            detail: 'Manage visitors or check in a guest.',
            icon: <VisitorIcon />,
            action: () => onNavigate('visitor-checkin', ''),
            priority: 'normal'
        });

        setTasks(detectedTasks as any);
        setStep('results');
    };

    const handleStartScan = () => {
        setScanError('');
        setStep('scanning');
    };

    const handleCancelScan = () => {
        setStep('start');
        setScanError('');
    };

    const handleReset = () => {
        setScannedId('');
        setTasks([]);
        setStudentName('');
        setScanError('');
        setStep('start');
    };

    return (
        <div className="w-full max-w-4xl mx-auto text-center animate-fade-in-up">
            {step === 'start' && (
                 <div className="flex flex-col items-center justify-center py-12 space-y-8">
                    <div className="w-32 h-32 bg-gray-700/50 rounded-full flex items-center justify-center border-4 border-gray-600">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-white mb-2">QR Code Hub</h2>
                        <p className="text-gray-400 max-w-sm mx-auto">Scan your Student ID to instantly access voting, canteen, and more.</p>
                    </div>
                    {scanError && <p className="p-3 bg-red-500/20 text-red-300 rounded-lg">{scanError}</p>}
                    
                    <div className="flex flex-col gap-4 w-full max-w-xs">
                        <button 
                            onClick={handleStartScan}
                            className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-xl shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
                        >
                            <span>Start Scanning</span>
                        </button>
                        <div className="relative">
                             <input 
                                placeholder="Or enter ID manually" 
                                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white focus:border-cyan-500 outline-none text-center"
                                onKeyDown={(e) => { if(e.key === 'Enter') handleScanSuccess((e.target as HTMLInputElement).value) }}
                             />
                        </div>
                    </div>
                </div>
            )}

            {step === 'scanning' && (
                <div className="max-w-md mx-auto">
                    <BarcodeScanner 
                        onScanSuccess={handleScanSuccess}
                        onScanError={(err) => console.warn(err)}
                        onClose={handleCancelScan}
                    />
                    <div className="mt-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-2">Scanning...</h2>
                        <p className="text-gray-400">Align your QR code within the frame.</p>
                        <button 
                            onClick={handleCancelScan}
                            className="mt-6 px-8 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {step === 'results' && (
                <div className="bg-gray-800 rounded-xl p-8 shadow-2xl relative">
                    <button onClick={handleReset} className="absolute top-4 left-4 text-gray-400 hover:text-white flex items-center gap-1">
                        &larr; Scan Another
                    </button>
                    
                    <div className="flex flex-col items-center mb-8">
                         <UserAvatar name={studentName} className="w-24 h-24 rounded-full text-3xl border-4 border-gray-700 mb-4"/>
                         <h2 className="text-3xl font-bold text-white">Hello, {studentName}!</h2>
                         <p className="text-gray-400">Here is what you can do right now:</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        {tasks.map((task, idx) => (
                            <button 
                                key={idx} 
                                onClick={task.action}
                                className={`p-6 rounded-xl flex items-start gap-4 transition-all hover:-translate-y-1 shadow-lg group ${task.priority === 'high' ? 'bg-gradient-to-br from-cyan-900 to-gray-900 border border-cyan-500/50 hover:border-cyan-400' : 'bg-gray-700 hover:bg-gray-600'}`}
                            >
                                <div className={`p-3 rounded-full ${task.priority === 'high' ? 'bg-cyan-500 text-white' : 'bg-gray-600 text-gray-300 group-hover:text-white'}`}>
                                    {task.icon}
                                </div>
                                <div>
                                    <h4 className={`text-lg font-bold ${task.priority === 'high' ? 'text-cyan-300' : 'text-white'}`}>{task.label}</h4>
                                    <p className="text-sm text-gray-400 mt-1">{task.detail}</p>
                                    {task.priority === 'high' && <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase rounded-full">Action Required</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                    {tasks.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <p>No specific tasks found for you right now.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const EVoteKioskView: React.FC<{ school: School, initialId?: string, onBack?: () => void }> = ({ school, initialId, onBack }) => {
    const [studentId, setStudentId] = useState(initialId || '');
    const [verifiedStudent, setVerifiedStudent] = useState<User | null>(null);
    const [error, setError] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    // Auto-verify if initialId is provided
    useEffect(() => {
        if (initialId) {
            verifyStudent(initialId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialId]);

    const verifyStudent = (idToVerify: string) => {
        setError('');
        
        let trimmedId = idToVerify.trim();
        try {
            // Apply new validation logic here too
            trimmedId = parseAndValidateScannedCode(trimmedId, school.id);
        } catch (e) {
            setError((e as Error).message);
            return;
        }

        if (!trimmedId) {
            setError('Please enter a Student ID.');
            return;
        }

        // Verify student existence against school records
        const schoolStudents = getSchoolUsersBySchoolIds([school.id]);
        const foundStudent = schoolStudents.find(s => s.studentId.toLowerCase() === trimmedId.toLowerCase() && s.role === 'student');

        if (!foundStudent) {
            setError('Student ID not found in this school\'s records.');
            setVerifiedStudent(null);
            return;
        }

        const voteRecord = voteService.getStudentVoteRecord(foundStudent.studentId, school.id);
        if (voteRecord) {
            setError('This Student ID has already been used to vote.');
            setVerifiedStudent(null);
            return;
        }

        setVerifiedStudent(foundStudent);
        setStudentId(foundStudent.studentId); // Sync input if scanned
    };
    
    const handleVoteComplete = () => {
        kioskService.logKioskAction(school.id, 'voting', `Vote cast by ${verifiedStudent?.name || studentId}`, verifiedStudent?.studentId, verifiedStudent?.name);
        // Reset state after a delay to allow next student
        setTimeout(() => {
             setVerifiedStudent(null);
             setStudentId('');
             if (onBack) onBack(); // Automatically return to hub if in that flow
        }, 5000);
    };

    if (verifiedStudent) {
        return <EVoteStudentPage user={verifiedStudent} school={school} isKiosk={true} onVoteComplete={handleVoteComplete} />;
    }

    return (
        <div className="w-full max-w-md text-center animate-fade-in-up relative">
             {onBack && (
                <div className="w-full flex justify-start mb-4">
                    <button onClick={onBack} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                        &larr; Back
                    </button>
                </div>
            )}
            {isScanning && (
                <BarcodeScanner 
                    onScanSuccess={(code) => {
                        setIsScanning(false);
                        verifyStudent(code);
                    }}
                    onScanError={(err) => console.warn(err)}
                    // Simply closing the scanner returns to the main view (EVoteKioskView)
                    onClose={() => setIsScanning(false)}
                />
            )}
            <div className="mb-6 flex justify-center">
                <div className="p-4 bg-cyan-500/20 rounded-full text-cyan-400"><VotingIcon /></div>
            </div>
            <h2 className="text-2xl font-bold mb-4">E-Voting Station</h2>
            <p className="text-gray-400 mb-6">Scan or enter your Student ID to access your ballot.</p>
            {error && <p className="text-red-400 mb-4 bg-red-500/10 p-2 rounded">{error}</p>}
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <input 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        placeholder="Enter Student ID" 
                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:border-cyan-500 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => { if(e.key === 'Enter') verifyStudent(studentId); }}
                    />
                    <button 
                        onClick={() => setIsScanning(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white"
                        title="Scan Barcode"
                    >
                        <QrCodeIcon />
                    </button>
                </div>
                <button onClick={() => verifyStudent(studentId)} className="px-6 py-2 bg-cyan-600 rounded-md font-semibold hover:bg-cyan-700 transition-colors">Verify</button>
            </div>
        </div>
    );
};

const CanteenKioskView: React.FC<{ school: School, initialId?: string, onBack?: () => void }> = ({ school, initialId, onBack }) => {
    const [studentId, setStudentId] = useState(initialId || '');
    const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error', text: string } | null>({ type: 'info', text: 'Scan or enter your Student ID to sign in for your meal slot.' });
    const [isScanning, setIsScanning] = useState(false);

    // Auto-verify if initialId is provided
    useEffect(() => {
        if (initialId) {
            signInStudent(initialId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialId]);

    const signInStudent = (idToSignIn: string) => {
        setMessage(null);
        
        let trimmedId = idToSignIn.trim();
        try {
            // Apply new validation logic here too
             trimmedId = parseAndValidateScannedCode(trimmedId, school.id);
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
            return;
        }

        if (!trimmedId) {
            setMessage({ type: 'error', text: 'Please enter a Student ID.' });
            return;
        }
        try {
            // Check if student exists in school first
            const schoolStudents = getSchoolUsersBySchoolIds([school.id]);
            const foundStudent = schoolStudents.find(s => s.studentId.toLowerCase() === trimmedId.toLowerCase());
            
            if (!foundStudent) {
                 setMessage({ type: 'error', text: 'Student ID not found in school records.' });
                 return;
            }

            const currentOrder = canteenService.getOrderForAttendanceCheck(foundStudent.studentId, school.id);
            if (!currentOrder) {
                setMessage({ type: 'error', text: 'No active meal slot found for this Student ID at this time.' });
                return;
            }
            canteenService.signInForCanteenAttendance(currentOrder.id);
            kioskService.logKioskAction(school.id, 'canteen', `Canteen sign-in: ${currentOrder.studentName}`, foundStudent.studentId, currentOrder.studentName, { orderId: currentOrder.id, table: currentOrder.assignedTable });
            setMessage({ type: 'success', text: `Success! Your table is ${currentOrder.assignedTable}. Please proceed. A carrier has been notified.` });
            setStudentId('');
            
            if (onBack) {
                 // Slight delay to read success message before navigating back
                 setTimeout(onBack, 4000);
            }

        } catch (err) {
            setMessage({ type: 'error', text: (err as Error).message });
        }
    };
    
    return (
        <div className="w-full max-w-md text-center animate-fade-in-up relative">
             {onBack && (
                <div className="w-full flex justify-start mb-4">
                    <button onClick={onBack} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                        &larr; Back
                    </button>
                </div>
            )}
            {isScanning && (
                <BarcodeScanner 
                    onScanSuccess={(code) => {
                        setIsScanning(false);
                        setStudentId(code);
                        signInStudent(code);
                    }}
                    onScanError={(err) => console.warn(err)}
                    // Simply closing the scanner returns to the main view (CanteenKioskView)
                    onClose={() => setIsScanning(false)}
                />
            )}
            <div className="mb-6 flex justify-center">
                <div className="p-4 bg-green-500/20 rounded-full text-green-400"><CanteenIcon /></div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Canteen Attendance</h2>
            {message && <p className={`mb-6 p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : message.type === 'error' ? 'bg-red-500/20 text-red-300' : 'text-gray-400'}`}>{message.text}</p>}
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <input 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        placeholder="Enter Student ID" 
                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:border-green-500 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => { if(e.key === 'Enter') signInStudent(studentId); }}
                    />
                    <button 
                        onClick={() => setIsScanning(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white"
                        title="Scan Barcode"
                    >
                        <QrCodeIcon />
                    </button>
                </div>
                <button onClick={() => signInStudent(studentId)} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors text-white">Sign In</button>
            </div>
        </div>
    );
};

// This is a simplified version of the VisitorCenterPage's check-in logic, adapted for the Kiosk.
const VisitorKioskView: React.FC<{ schoolId: string; onReturnToHome: () => void }> = ({ schoolId, onReturnToHome }) => {
    const [step, setStep] = useState<'start' | 'camera_id' | 'camera_selfie' | 'form' | 'success'>('start');
    const [capturedIdPhoto, setCapturedIdPhoto] = useState<string | null>(null);
    const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState({ name: '', idNumber: '', reasonForVisit: '' });
    const [isDetailsEditable, setIsDetailsEditable] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ matchConfidence: 'High' | 'Medium' | 'Low'; isMatch: boolean } | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [backgroundRemovalStatus, setBackgroundRemovalStatus] = useState<string | null>(null);

    // Camera device management
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
    
    // Alignment State
    const [isAligned, setIsAligned] = useState(false);
    const [isCheckingAlignment, setIsCheckingAlignment] = useState(false);
    const alignmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Initial enumeration
    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevs = devices.filter(d => d.kind === 'videoinput');
            setVideoDevices(videoDevs);
        });
    }, []);

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const startCamera = async (isSelfie: boolean, deviceId?: string) => {
        stopCamera();

        try {
            // Priority: specific deviceId -> default facingMode
            const constraints = deviceId 
                ? { video: { deviceId: { exact: deviceId } } }
                : { video: { facingMode: isSelfie ? 'user' : 'environment' } };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setFormError('');
            setIsAligned(false);
        } catch (err) {
            setFormError("Could not access camera. Please grant permission.");
        }
    };

    useEffect(() => {
        if (step === 'camera_id' || step === 'camera_selfie') {
            const isSelfie = step === 'camera_selfie';
            
            if (videoDevices.length > 0) {
                 // If devices are loaded, try to use the selected one
                 const deviceId = videoDevices[selectedDeviceIndex]?.deviceId;
                 startCamera(isSelfie, deviceId);
            } else {
                 // Fallback if device enumeration hasn't finished or failed
                 startCamera(isSelfie);
            }
        } else {
            stopCamera();
        }
        
        return () => {
            stopCamera();
            if (alignmentTimeoutRef.current) clearTimeout(alignmentTimeoutRef.current);
        };
    }, [step, selectedDeviceIndex, videoDevices]);
    
    const handleSwitchCamera = () => {
        if (videoDevices.length < 2) return;
        
        const nextIndex = (selectedDeviceIndex + 1) % videoDevices.length;
        setSelectedDeviceIndex(nextIndex);
        // The useEffect will pick up the index change and restart the camera
    };
    
    const handleCheckAlignment = () => {
        if (isCheckingAlignment) return;
        setIsCheckingAlignment(true);
        // Simulate checking alignment
        alignmentTimeoutRef.current = setTimeout(() => {
            setIsAligned(true);
            setIsCheckingAlignment(false);
        }, 1500);
    };

    const handleCapture = async () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const photoUrl = canvas.toDataURL('image/jpeg');
            const base64Data = photoUrl.split(',')[1];
            
            setBackgroundRemovalStatus("Removing background...");

            try {
                const processedImage = await apiService.removeImageBackground(base64Data, 'image/jpeg');
                
                if (step === 'camera_id') {
                    setCapturedIdPhoto(processedImage);
                    setStep('camera_selfie');
                } else if (step === 'camera_selfie') {
                    setCapturedSelfie(processedImage);
                    processVerification(processedImage);
                }
            } catch (error) {
                console.error("Background removal error, using original:", error);
                 if (step === 'camera_id') {
                    setCapturedIdPhoto(photoUrl);
                    setStep('camera_selfie');
                } else if (step === 'camera_selfie') {
                    setCapturedSelfie(photoUrl);
                    processVerification(photoUrl);
                }
            } finally {
                 setBackgroundRemovalStatus(null);
                 setIsAligned(false);
            }
        }
    };
    
    const handleCancel = () => {
        stopCamera();
        setStep('start');
        setCapturedIdPhoto(null);
        setCapturedSelfie(null);
        setFormData({ name: '', idNumber: '', reasonForVisit: '' });
        setVerificationResult(null);
        setIsDetailsEditable(false);
        setFormError('');
        setIsProcessing(false);
        setIsAligned(false);
        setIsCheckingAlignment(false);
        if (alignmentTimeoutRef.current) {
            clearTimeout(alignmentTimeoutRef.current);
            alignmentTimeoutRef.current = null;
        }
        setBackgroundRemovalStatus(null);
    };

    const processVerification = async (selfieUrl: string) => {
        if (!capturedIdPhoto) return;
        setIsProcessing(true);
        setStep('form');
        const idBase64 = capturedIdPhoto.split(',')[1];
        const selfieBase64 = selfieUrl.split(',')[1];
        try {
            const result = await apiService.verifyVisitorIdentity(idBase64, selfieBase64);
            setFormData(prev => ({ ...prev, name: result.name, idNumber: result.idNumber }));
            setVerificationResult({ matchConfidence: result.matchConfidence, isMatch: result.isMatch });
            if (!result.name && !result.idNumber) {
                setFormError("Could not extract details. Please enter manually.");
                setIsDetailsEditable(true);
            }
        } catch (err) {
            setFormError((err as Error).message);
            setIsDetailsEditable(true);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSignIn = () => {
        if (!capturedIdPhoto || !formData.name.trim() || !formData.idNumber.trim() || !formData.reasonForVisit.trim()) {
            setFormError("All fields are required.");
            return;
        }
        visitorService.addVisitor(schoolId, {
            name: formData.name,
            idNumber: formData.idNumber,
            idPhotoUrl: capturedIdPhoto,
            reasonForVisit: formData.reasonForVisit,
            matchConfidence: verificationResult?.matchConfidence,
            isVerifiedMatch: verificationResult?.isMatch
        });
        kioskService.logKioskAction(schoolId, 'visitor', `Visitor check-in: ${formData.name}`, undefined, formData.name, { reason: formData.reasonForVisit });
        setStep('success');
    };

    // UI for the visitor check-in flow... this can be quite large.
    return (
        <div className="w-full max-w-3xl bg-gray-800 p-6 rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                 <div className="text-center flex-grow pr-8 relative">
                    <h2 className="text-2xl font-bold text-white">Visitor Self-Service</h2>
                </div>
                {step !== 'start' && step !== 'success' && (
                     <button onClick={handleCancel} className="px-3 py-1 text-sm bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white rounded transition-colors">
                        Cancel
                     </button>
                )}
            </div>

            {step === 'start' && (
                <div className="flex flex-col items-center justify-center h-full py-12 space-y-8 animate-fade-in-up">
                    <div className="w-32 h-32 bg-gray-700/50 rounded-full flex items-center justify-center border-4 border-gray-600">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h3 className="text-3xl font-bold text-white mb-2">Welcome Visitor</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">
                            Please verify your identity to proceed with check-in.
                        </p>
                    </div>
                    <button 
                        onClick={() => setStep('camera_id')}
                        className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-xl shadow-xl transition-all transform hover:scale-105 flex items-center gap-3"
                    >
                        <span>Start Verification</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            )}

            {(step === 'camera_id' || step === 'camera_selfie') && 
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-bold">{step === 'camera_id' ? "Step 1: Scan ID Card" : "Step 2: Verification Selfie"}</h3>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700">
                         <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                         {step === 'camera_id' && <div className="absolute inset-0 border-4 border-dashed border-cyan-500/50 m-12 rounded-lg pointer-events-none"></div>}
                         
                         {videoDevices.length > 1 && (
                            <button 
                                onClick={handleSwitchCamera} 
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
                                title="Switch Camera"
                            >
                                <SwitchCameraIcon />
                            </button>
                         )}
                         
                         {/* Alignment Guide */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div 
                                className={`
                                    ${step === 'camera_id' ? 'w-[85%] h-[80%]' : 'w-[200px] h-[250px] rounded-full'} 
                                    border-2 transition-colors duration-300
                                    ${isAligned ? 'border-green-500 border-solid shadow-[0_0_20px_rgba(34,197,94,0.5)]' : step === 'camera_id' ? 'border-dashed border-cyan-500/50' : 'border-dashed border-yellow-500/50'}
                                `}
                            >
                                 {isAligned && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                        <svg className="w-16 h-16 text-green-500 drop-shadow-lg animate-fade-in-up" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {backgroundRemovalStatus && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-cyan-400 font-semibold animate-pulse">{backgroundRemovalStatus}</p>
                            </div>
                        )}
                    </div>
                    {formError && <p className="text-red-400">{formError}</p>}
                    
                    <div className="flex justify-center gap-4">
                         {isCheckingAlignment ? (
                            <button disabled className="px-8 py-3 bg-yellow-600 text-white rounded-lg font-bold shadow-lg animate-pulse cursor-wait">Checking Alignment...</button>
                         ) : isAligned ? (
                            <button onClick={handleCapture} disabled={!!backgroundRemovalStatus} className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white shadow-lg animate-bounce">
                                {step === 'camera_id' ? "Capture ID" : "Verify"}
                            </button>
                         ) : (
                            <button onClick={handleCheckAlignment} disabled={!!backgroundRemovalStatus} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-bold text-white shadow-lg">Check Alignment</button>
                         )}
                         <button onClick={handleCancel} disabled={!!backgroundRemovalStatus} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg transition-all transform active:scale-95 disabled:opacity-50">
                            Cancel
                        </button>
                    </div>
                </div>
            }
            {step === 'form' && (isProcessing ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-cyan-400">Verifying Identity...</p>
                </div>
            ) : ( 
                <div className="space-y-4">
                    <h3 className="text-xl font-bold">Confirm Details</h3>
                    {verificationResult && (
                        <div className={`p-3 rounded-lg ${verificationResult.isMatch ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                            Match: {verificationResult.isMatch ? 'Confirmed' : 'Warning'} (Confidence: {verificationResult.matchConfidence})
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-gray-400">Name</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} readOnly={!isDetailsEditable} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:border-cyan-500"/>
                    </div>
                    <div>
                         <label className="text-xs text-gray-400">ID Number</label>
                         <input value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} readOnly={!isDetailsEditable} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:border-cyan-500"/>
                    </div>
                    {!isDetailsEditable && <button onClick={() => setIsDetailsEditable(true)} className="text-cyan-400 text-sm hover:underline">Correct Details</button>}
                    <div>
                         <label className="text-xs text-gray-400">Reason for Visit</label>
                         <input value={formData.reasonForVisit} onChange={e => setFormData({...formData, reasonForVisit: e.target.value})} placeholder="Reason for Visit" className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:border-cyan-500"/>
                    </div>
                    <button onClick={handleSignIn} className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-bold text-white shadow-md mt-4">Sign In</button>
                </div>
            ))}
            {step === 'success' && 
                <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-green-400">Check-In Complete!</h3>
                    <p className="text-gray-300 mt-2">Welcome, {formData.name}.</p>
                    {/* Return to Home is usually handled by a timeout in kiosk mode */}
                    <button onClick={() => { setStep('start'); setCapturedIdPhoto(null); setFormData({name: '', idNumber: '', reasonForVisit: ''}); setIsAligned(false); }} className="mt-8 px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Reset</button>
                </div>
            }
        </div>
    );
};


export default KioskPage;
