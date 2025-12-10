
import React, { useState, useEffect, useCallback } from 'react';
import { User, School, Module } from '../types';
import UserAvatar from './UserAvatar';
import { getAllSchools } from '../services/schoolService';
import { getAllModules, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, NEWS_FEED_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME, VISITOR_CENTER_MODULE_NAME, KIOSK_MODE_MODULE_NAME, EXPLORATION_MODULE_NAME } from '../services/moduleService';
import { DashboardIcon, ResultsIcon, GenericModuleIcon, SmartAdmissionIcon, EWalletIcon, OnlineIcon, IdCardIcon, CanteenIcon, NcheIcon, NewsIcon, HamburgerIcon, CloseIcon, MessagesIcon, IconLocation, KioskIcon, VotingIcon } from './Icons';
import NotificationBell from './NotificationBell';
import ProfilePage from './ProfilePage';
import { getHomePageContent } from '../services/homePageService';
import { heartbeat } from '../services/presenceService';

// Module Components
import SocialHubPage from './SocialHubPage';
import EWalletPage from './EWalletPage';
import { OnlineFeedPage } from './OnlineFeedPage';
import StudentNcheView from './StudentNcheView';
import ECanteenStudentPage from './ECanteenStudentPage';
import EVoteStudentPage from './EVoteStudentPage';
import MyInstituteStudentPage from './MyInstituteStudentPage';
import VisitorCenterStudentPage from './VisitorCenterStudentPage';
import KioskPage from './KioskPage';
import ExplorationPage from './ExplorationPage';
import { StudentAdmissionPortal } from './StudentPage';

interface OldStudentPageProps {
    user: User;
    onLogout: () => void;
}

export const OldStudentPage: React.FC<OldStudentPageProps> = ({ user, onLogout }) => {
    const [currentView, setCurrentView] = useState('dashboard');
    const [school, setSchool] = useState<School | null>(null);
    const [schoolName, setSchoolName] = useState('Alumni Portal');
    const [schoolLogo, setSchoolLogo] = useState('');
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);

    // Fetch School and Modules
    useEffect(() => {
        if (user.schoolId) {
            const schoolData = getAllSchools().find(s => s.id === user.schoolId);
            if (schoolData) {
                setSchool(schoolData);
                setSchoolName(schoolData.name);
                const homeContent = getHomePageContent(schoolData.id);
                setSchoolLogo(homeContent.hero.logoUrl);

                const allModules = getAllModules();
                const publishedModules = schoolData.modules
                    .filter(m => {
                        const isPublished = m.status === 'published';
                        if (!isPublished) return false;
                        
                        // Check allowed roles
                        const roles = m.allowedRoles;
                        return !roles || roles.length === 0 || roles.includes(user.role);
                    })
                    .map(m => allModules.find(mod => mod.id === m.moduleId))
                    .filter((m): m is Module => !!m);
                
                setAvailableModules(publishedModules);
            }
        }
        
        const interval = setInterval(() => {
            heartbeat(user.studentId);
        }, 5000);
        return () => clearInterval(interval);

    }, [user.schoolId, user.role, user.studentId]);

    // Navigation Items
    const navItems = [
        { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
        ...availableModules.map(m => {
            let icon = <GenericModuleIcon />;
            if (m.name === SMART_ADMISSION_MODULE_NAME) icon = <SmartAdmissionIcon />;
            if (m.name === MESSAGE_MODULE_NAME) icon = <MessagesIcon />;
            if (m.name === E_WALLET_MODULE_NAME) icon = <EWalletIcon />;
            if (m.name === ONLINE_MODULE_NAME) icon = <OnlineIcon />;
            if (m.name === SMART_STUDENT_ID_MODULE_NAME) icon = <IdCardIcon />;
            if (m.name === E_CANTEEN_MODULE_NAME) icon = <CanteenIcon />;
            if (m.name === NCHE_MODULE_NAME) icon = <NcheIcon />;
            if (m.name === KIOSK_MODE_MODULE_NAME) icon = <KioskIcon />;
            if (m.name === NEWS_FEED_MODULE_NAME) icon = <NewsIcon />;
            if (m.name === E_VOTE_MODULE_NAME) icon = <VotingIcon />;
            
            return { id: m.id, name: m.name, icon };
        })
    ];

    const renderContent = () => {
        if (currentView === 'dashboard') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in-up">
                    <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-24 h-24 rounded-full text-3xl mb-4" />
                    <h1 className="text-3xl font-bold text-cyan-400">Alumni Portal</h1>
                    <p className="text-lg text-gray-300">Welcome back, {currentUser.name}.</p>
                    <p className="text-gray-400 max-w-md">Stay connected with your alma mater. Use the sidebar to access alumni services and school updates.</p>
                </div>
            );
        }

        const activeModule = availableModules.find(m => m.id === currentView);
        if (activeModule && school) {
            switch (activeModule.name) {
                case MESSAGE_MODULE_NAME:
                    return <SocialHubPage user={currentUser} onLogout={onLogout} />;
                case E_WALLET_MODULE_NAME:
                    return <EWalletPage user={currentUser} />;
                case NEWS_FEED_MODULE_NAME:
                case ONLINE_MODULE_NAME:
                    return <OnlineFeedPage user={currentUser} onLogout={onLogout} onBackToDashboard={() => setCurrentView('dashboard')} />;
                case SMART_ADMISSION_MODULE_NAME:
                     return <StudentAdmissionPortal user={currentUser} school={school} onBack={() => setCurrentView('dashboard')} onLogout={onLogout} />;
                case E_CANTEEN_MODULE_NAME:
                    return <ECanteenStudentPage school={school} user={currentUser} />;
                case NCHE_MODULE_NAME:
                    return <StudentNcheView user={currentUser} />;
                case E_VOTE_MODULE_NAME:
                    return <EVoteStudentPage user={currentUser} school={school} />;
                case MY_INSTITUTE_MODULE_NAME:
                    return <MyInstituteStudentPage />;
                case VISITOR_CENTER_MODULE_NAME:
                    return <VisitorCenterStudentPage user={currentUser} school={school} />;
                case KIOSK_MODE_MODULE_NAME:
                     return <KioskPage user={currentUser} school={school} />;
                case EXPLORATION_MODULE_NAME:
                    return <ExplorationPage user={currentUser} />;
                default:
                    return <div className="p-8 text-center text-gray-400">Module "{activeModule.name}" content coming soon.</div>;
            }
        }

        return <div>Select a module</div>;
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
             {/* Sidebar */}
            <aside className={`bg-gray-800 shadow-xl flex flex-col transition-all duration-300 z-20 ${isSidebarExpanded ? 'w-64' : 'w-20'} hidden md:flex`}>
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                     {isSidebarExpanded ? (
                         <h1 className="text-xl font-bold text-cyan-400 truncate">{schoolName}</h1>
                     ) : (
                         <img src={schoolLogo || 'https://via.placeholder.com/40'} alt="Logo" className="w-8 h-8 rounded-full" />
                     )}
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={`w-full flex items-center p-3 transition-colors relative group ${currentView === item.id ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            title={!isSidebarExpanded ? item.name : ''}
                        >
                            <div className="flex-shrink-0 w-6 h-6 mx-auto md:mx-0 md:mr-0">
                                {item.icon}
                            </div>
                             {isSidebarExpanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">{item.name}</span>}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-700">
                    <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-700 text-gray-400">
                         <HamburgerIcon />
                    </button>
                </div>
            </aside>

             {/* Mobile Menu Overlay */}
             {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <aside className="w-64 h-full bg-gray-800 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h1 className="text-xl font-bold text-cyan-400">{schoolName}</h1>
                            <button onClick={() => setIsMobileMenuOpen(false)}><CloseIcon /></button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4 space-y-2">
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setCurrentView(item.id); setIsMobileMenuOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 transition-colors ${currentView === item.id ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    <span className="mr-3">{item.icon}</span>
                                    <span className="text-sm font-medium">{item.name}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 sm:px-6 shadow-md z-10">
                    <div className="flex items-center">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-gray-400 hover:text-white mr-2">
                            <HamburgerIcon />
                        </button>
                        <h2 className="text-lg font-semibold text-white truncate">
                            {navItems.find(i => i.id === currentView)?.name || 'Dashboard'}
                        </h2>
                    </div>

                    <div className="flex items-center space-x-4">
                        <NotificationBell userId={currentUser.studentId} />
                        <div className="relative cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                             <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-9 h-9 rounded-full border-2 border-gray-600" />
                        </div>
                        <button onClick={onLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-gray-900 relative">
                     {renderContent()}
                </main>
            </div>

            {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as User);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                />
            )}
        </div>
    );
};

export default OldStudentPage;
