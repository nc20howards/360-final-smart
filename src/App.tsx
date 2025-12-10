
import React, { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import SchoolLandingPage from './components/SchoolLandingPage';
import { checkSession, logout } from './services/authService';
import { User, AdminUser, School } from './types';
import { seedInitialData } from './services/seedService';
import { getAllSchools } from './services/schoolService';
import Chat from './components/Chat';
import ConfirmationModal from './components/ConfirmationModal';

// Type guard to differentiate between User (student/superadmin) and AdminUser
const isStudentOrSuperadmin = (user: User | AdminUser): user is User => {
    return 'studentId' in user;
};

// --- Lazy Loaded Components ---
const Auth = lazy(() => import('./components/Auth'));
const StudentPage = lazy(() => import('./components/StudentPage'));
const SuperadminPage = lazy(() => import('./components/SuperadminPage').then(module => ({ default: module.SuperadminPage })));
// Updated AdminPage import to use default export
const AdminPage = lazy(() => import('./components/AdminPage'));
const ForcePasswordChange = lazy(() => import('./components/ForcePasswordChange'));
const TeacherPage = lazy(() => import('./components/TeacherPage').then(module => ({ default: module.TeacherPage })));
const NewUserFlow = lazy(() => import('./components/NewUserFlow'));
const ECanteenSellerPage = lazy(() => import('./components/ECanteenSellerPage'));
const CarrierPage = lazy(() => import('./components/CarrierPage'));
const ParentPage = lazy(() => import('./components/ParentPage').then(module => ({ default: module.ParentPage })));
const OldStudentPage = lazy(() => import('./components/OldStudentPage').then(module => ({ default: module.OldStudentPage })));


const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

// --- Draggable Chat Button Component ---
const DraggableChatButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const [pos, setPos] = useState<{ x: number, y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const timerRef = useRef<any>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Initialize position on mount to bottom right to prevent jump on first drag
    useEffect(() => {
        const updateInitialPos = () => {
            if (!pos) {
                const initialX = window.innerWidth - 80; // approx right-8 (2rem) + width
                const initialY = window.innerHeight - 80; // approx bottom-8 (2rem) + height
                // We don't setPos here to keep CSS positioning responsive until dragged,
                // but this logic is ready if we needed absolute positioning from start.
            }
        };
        window.addEventListener('resize', updateInitialPos);
        return () => window.removeEventListener('resize', updateInitialPos);
    }, [pos]);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation(); // Prevent event bubbling
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        
        setIsPressed(true);
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Long press detection (300ms) to switch to drag mode
        timerRef.current = setTimeout(() => {
            setIsDragging(true);
            btn.setPointerCapture(e.pointerId);
        }, 300);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (isDragging) {
            e.preventDefault();
            let newX = e.clientX - dragOffset.current.x;
            let newY = e.clientY - dragOffset.current.y;

            // Boundary constraints
            const maxX = window.innerWidth - 64; // button width
            const maxY = window.innerHeight - 64; // button height
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            setPos({ x: newX, y: newY });
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (isDragging) {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
        } else {
            // If we weren't dragging, treat it as a click
            if (isPressed) {
                onClick();
            }
        }
        setIsPressed(false);
    };
    
    // Double click to reset position (Optional helpful feature)
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPos(null); // Reset to default CSS position
    };

    const style: React.CSSProperties = pos ? {
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        bottom: 'auto',
        right: 'auto',
        touchAction: 'none', // Critical for dragging on touch devices
        zIndex: 100,
        transform: isDragging ? 'scale(1.1)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.1s',
    } : {
        // Default Tailwind classes handles this, but inline styles override if set
        touchAction: 'none',
        zIndex: 100,
    };

    return (
        <button
            ref={buttonRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-cyan-700 transition-transform ${!pos ? 'animate-pulse-custom' : ''}`}
            style={style}
            title="Open AI Assistant (Hold to Drag, Double-click to Reset)"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.874 8.874 0 01-4.444-1.225L2.25 17.56a.75.75 0 01-.486-1.369l2.42-1.729A8.962 8.962 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.75 10a6.25 6.25 0 1112.5 0 6.25 6.25 0 01-12.5 0z" clipRule="evenodd" />
            </svg>
        </button>
    );
};

const App = () => {
    const [user, setUser] = useState<User | AdminUser | null>(null);
    const [isSessionChecked, setIsSessionChecked] = useState(false);
    const [showLandingPageForSchool, setShowLandingPageForSchool] = useState<School | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'auth' | 'newUser'>('auth');
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [pendingLogoutFlow, setPendingLogoutFlow] = useState(false);

    useEffect(() => {
        seedInitialData();
        try {
            const sessionUser = checkSession();
            if (sessionUser) {
                setUser(sessionUser);
            }
        } catch (error) {
            console.error("Error checking session:", error);
        } finally {
            setIsSessionChecked(true);
        }
    }, []);

    const handleLoginSuccess = useCallback((loggedInUser: User | AdminUser) => {
        let userSchoolId: string | null = null;
        if ('schoolId' in loggedInUser && loggedInUser.schoolId) {
            userSchoolId = loggedInUser.schoolId;
        } else if ('assignedSchoolIds' in loggedInUser && loggedInUser.assignedSchoolIds.length > 0) {
            userSchoolId = loggedInUser.assignedSchoolIds[0];
        }

        if (userSchoolId && (!isStudentOrSuperadmin(loggedInUser) || loggedInUser.accountStatus !== 'temporary')) {
            const schools = getAllSchools();
            const school = schools.find(s => s.id === userSchoolId);
            if (school && school.isHomePagePublished) {
                setUser(loggedInUser);
                setShowLandingPageForSchool(school);
                return;
            }
        }
        
        setUser(loggedInUser);
        setViewMode('auth');
    }, []);

    const handlePasswordChangeSuccess = useCallback((updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
    }, []);
    
    const handleProceedToDashboard = useCallback(() => {
        setShowLandingPageForSchool(null);
    }, []);

    const handleLogoutRequest = useCallback((showNewUserFlow: boolean = false) => {
        setPendingLogoutFlow(showNewUserFlow);
        setIsLogoutModalOpen(true);
    }, []);
    
    const confirmLogout = useCallback(() => {
        logout();
        setUser(null);
        setShowLandingPageForSchool(null);
        setViewMode(pendingLogoutFlow ? 'newUser' : 'auth');
        setIsLogoutModalOpen(false);
    }, [pendingLogoutFlow]);

    const cancelLogout = useCallback(() => {
        setIsLogoutModalOpen(false);
    }, []);

    const renderPage = useCallback(() => {
        if (isStudentOrSuperadmin(user)) { // This is for 'User' type
            const schoolUser = user as User; // Cast for clarity
            const school = schoolUser.schoolId ? getAllSchools().find(s => s.id === schoolUser.schoolId) : null;

            switch(schoolUser.role) {
                case 'superadmin':
                    return <SuperadminPage user={schoolUser} onLogout={() => handleLogoutRequest()} />;
                
                case 'teacher':
                case 'head_of_department':
                case 'deputy_headteacher':
                    return <TeacherPage user={schoolUser} onLogout={() => handleLogoutRequest()} />;
                
                case 'canteen_seller':
                    if (!school) return <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">Error: School not found for canteen seller.</div>;
                    return <ECanteenSellerPage user={schoolUser} school={school} onLogout={() => handleLogoutRequest()} />;

                case 'carrier':
                    if (!school) return <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">Error: School not found for carrier.</div>;
                    return <CarrierPage user={schoolUser} school={school} onLogout={() => handleLogoutRequest()} />;

                case 'parent':
                    return <ParentPage user={schoolUser} onLogout={() => handleLogoutRequest()} />;
                
                case 'old_student':
                    return <OldStudentPage user={schoolUser} onLogout={() => handleLogoutRequest()} />;
                
                case 'student':
                default:
                    return <StudentPage user={schoolUser} onLogout={handleLogoutRequest} />;
            }
        } else { // This is for 'AdminUser' type
            return <AdminPage user={user} onLogout={() => handleLogoutRequest()} />;
        }
    }, [user, handleLogoutRequest]);
    
    if (!isSessionChecked) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return (
            <Suspense fallback={<LoadingSpinner />}>
                {viewMode === 'newUser' ? (
                    <NewUserFlow onShowLogin={() => setViewMode('auth')} onLoginSuccess={handleLoginSuccess} />
                ) : (
                    <Auth onLoginSuccess={handleLoginSuccess} onNewUser={() => setViewMode('newUser')} />
                )}
            </Suspense>
        );
    }

    if (isStudentOrSuperadmin(user) && user.mustChangePassword) {
        return (
            <Suspense fallback={<LoadingSpinner />}>
                <ForcePasswordChange user={user} onSuccess={handlePasswordChangeSuccess} />
            </Suspense>
        );
    }

    if (showLandingPageForSchool) {
        return (
            <Suspense fallback={<LoadingSpinner />}>
                <SchoolLandingPage school={showLandingPageForSchool} onProceed={handleProceedToDashboard} />
            </Suspense>
        );
    }

    const isStudentView = isStudentOrSuperadmin(user) && user.role === 'student';

    return (
        <>
            <Suspense fallback={<LoadingSpinner />}>
                {renderPage()}
            </Suspense>
            {isStudentView && (
                <>
                    {isChatOpen && (
                        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-[calc(100%-2rem)] sm:w-full max-w-md h-[75vh] sm:h-[600px] z-[101] animate-slide-in-right">
                            <Chat user={user} onClose={() => setIsChatOpen(false)} />
                        </div>
                    )}
                    {!isChatOpen && (
                        <DraggableChatButton onClick={() => setIsChatOpen(true)} />
                    )}
                </>
            )}
            <ConfirmationModal 
                isOpen={isLogoutModalOpen}
                title="Confirm Logout"
                message={<p>Are you sure you want to log out of your account?</p>}
                onConfirm={confirmLogout}
                onCancel={cancelLogout}
                confirmText="Logout"
                confirmButtonVariant="danger"
            />
        </>
    );
};

export default App;
