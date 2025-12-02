
import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import { StudentPage } from './components/StudentPage';
import { SuperadminPage } from './components/SuperadminPage';
import { AdminPage } from './components/AdminPage';
import SchoolLandingPage from './components/SchoolLandingPage';
import { checkSession, logout } from './services/authService';
import { User, AdminUser, School } from './types';
import { seedInitialData } from './services/seedService';
import { getAllSchools } from './services/schoolService';
import Chat from './components/Chat';
import ForcePasswordChange from './components/ForcePasswordChange';
import { TeacherPage } from './components/TeacherPage';
import NewUserFlow from './components/NewUserFlow';
import ConfirmationModal from './components/ConfirmationModal';
import { StudentAdmissionPortal } from './components/StudentAdmissionPortal';


// Type guard to differentiate between User (student/superadmin) and AdminUser
const isStudentOrSuperadmin = (user: User | AdminUser): user is User => {
    // FIX: Changed 'studentId' in user to 'id' in user to correctly differentiate AdminUser.
    return 'studentId' in user;
};

const App = () => {
    const [user, setUser] = useState<User | AdminUser | null>(null);
    const [isSessionChecked, setIsSessionChecked] = useState(false);
    const [showLandingPageForSchool, setShowLandingPageForSchool] = useState<School | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'auth' | 'newUser'>('auth');

    // Logout confirmation state
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

    const handleLoginSuccess = (loggedInUser: User | AdminUser) => {
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
    };

    const handlePasswordChangeSuccess = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
    };
    
    const handleProceedToDashboard = () => {
        setShowLandingPageForSchool(null);
    };

    // Initiates the logout process by showing the confirmation modal
    const handleLogoutRequest = (showNewUserFlow: boolean = false) => {
        setPendingLogoutFlow(showNewUserFlow);
        setIsLogoutModalOpen(true);
    };

    // Executes the actual logout logic
    const confirmLogout = () => {
        logout();
        setUser(null);
        setShowLandingPageForSchool(null);
        setViewMode(pendingLogoutFlow ? 'newUser' : 'auth');
        setIsLogoutModalOpen(false);
    };

    const cancelLogout = () => {
        setIsLogoutModalOpen(false);
    };
    
    if (!isSessionChecked) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>;
    }

    if (!user) {
        if (viewMode === 'newUser') {
            return <NewUserFlow onShowLogin={() => setViewMode('auth')} onLoginSuccess={handleLoginSuccess} />;
        }
        return <Auth onLoginSuccess={handleLoginSuccess} onNewUser={() => setViewMode('newUser')} />;
    }

    if (isStudentOrSuperadmin(user) && user.mustChangePassword) {
        return <ForcePasswordChange user={user} onSuccess={handlePasswordChangeSuccess} />;
    }

    if (showLandingPageForSchool) {
        return <SchoolLandingPage school={showLandingPageForSchool} onProceed={handleProceedToDashboard} />;
    }

    const isStudentView = isStudentOrSuperadmin(user) && user.role === 'student';

    const renderPage = () => {
        if (isStudentOrSuperadmin(user)) {
            if (user.role === 'superadmin') {
                return <SuperadminPage user={user} onLogout={() => handleLogoutRequest()} />;
            }
            
            if (user.role === 'teacher') {
                return <TeacherPage user={user} onLogout={() => handleLogoutRequest()} />;
            }

            return <StudentPage user={user} onLogout={handleLogoutRequest} />;
        } else {
            return <AdminPage user={user} onLogout={() => handleLogoutRequest()} />;
        }
    };

    return (
        <>
            {renderPage()}
            {isStudentView && (
                <>
                    {isChatOpen && (
                        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-[calc(100%-2rem)] sm:w-full max-w-md h-[75vh] sm:h-[600px] z-[101] animate-slide-in-right">
                            <Chat user={user} onClose={() => setIsChatOpen(false)} />
                        </div>
                    )}
                    {!isChatOpen && (
                         <button
                            onClick={() => setIsChatOpen(true)}
                            className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-cyan-700 transition-transform transform hover:scale-110 z-[100] animate-pulse-custom"
                            title="Open AI Assistant"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.874 8.874 0 01-4.444-1.225L2.25 17.56a.75.75 0 01-.486-1.369l2.42-1.729A8.962 8.962 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.75 10a6.25 6.25 0 1112.5 0 6.25 6.25 0 01-12.5 0z" clipRule="evenodd" /></svg>
                        </button>
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