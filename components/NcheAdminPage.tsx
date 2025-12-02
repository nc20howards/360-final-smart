import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminUser, HigherEducationInstitution, Program } from '../types';
import { APP_TITLE } from '../constants';
import * as ncheService from '../services/ncheService';
import NotificationBell from './NotificationBell';
import ProfilePage from './ProfilePage';

const NcheIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25278C12 6.25278 6.75 3.75 4.5 5.25334C2.25 6.75668 2.25 12.0075 2.25 12.0075C2.25 12.0075 4.5 17.2583 6.75 18.7616C9 20.265 12 17.7622 12 17.7622M12 6.25278C12 6.25278 17.25 3.75 19.5 5.25334C21.75 6.75668 21.75 12.0075 21.75 12.0075C21.75 12.0075 19.5 17.2583 17.25 18.7616C15 20.265 12 17.7622 12 17.7622M12 6.25278V17.7622" /><path d="M9 12L6.75 10.5" strokeLinecap="round"/><path d="M15 12L17.25 10.5" strokeLinecap="round"/></svg>);
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;


interface NcheAdminPageProps {
    user: AdminUser;
    onLogout: () => void;
}

const NcheAdminPage: React.FC<NcheAdminPageProps> = ({ user, onLogout }) => {
    const [view, setView] = useState<'institutions' | 'programs'>('institutions');
    const [institutions, setInstitutions] = useState<HigherEducationInstitution[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: React.ReactNode } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);

    const institutionCsvTemplate = "data:text/csv;charset=utf-8," + encodeURIComponent("name,acronym,type,ownership,logoUrl\nMakerere University,MAK,University,Public,https://example.com/logo.png");
    const programCsvTemplate = "data:text/csv;charset=utf-8," + encodeURIComponent("institutionAcronym,ncheCode,name,faculty,durationYears,level,principalPasses,subsidiaryPasses,essentialSubjects,minPoints,uceRequirements\nMAK,MAK-CS,Bachelor of Science in Computer Science,Computing,3,Bachelors,2,1,Mathematics:C|Physics:D,45,\"5 Credits in English, Maths\"");


    const refreshData = useCallback(() => {
        setInstitutions(ncheService.getAllInstitutions());
        setPrograms(ncheService.getAllPrograms());
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setFeedback(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target?.result as string;
            let result;
            try {
                if (view === 'institutions') {
                    result = ncheService.bulkCreateInstitutionsFromCSV(csvText);
                } else {
                    result = ncheService.bulkCreateProgramsFromCSV(csvText);
                }
                
                if (result.errorCount > 0) {
                    setFeedback({ type: 'error', message: (
                        <>
                            <p>Processing complete with {result.errorCount} errors:</p>
                            <ul className="list-disc list-inside text-xs mt-2 max-h-40 overflow-y-auto">
                                {result.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                                {result.errors.length > 10 && <li>...and {result.errors.length - 10} more.</li>}
                            </ul>
                        </>
                    ) });
                } else {
                    setFeedback({ type: 'success', message: `${result.successCount} ${view} imported successfully!` });
                }
                refreshData();
            } catch (err) {
                setFeedback({ type: 'error', message: `An unexpected error occurred: ${(err as Error).message}` });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
             {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as AdminUser);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                />
            )}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-800 border-l border-gray-700 shadow-md">
                    <div className="flex items-center space-x-4">
                        <NcheIcon />
                        <h1 className="text-xl font-bold text-cyan-400">{APP_TITLE} - NCHE Portal</h1>
                    </div>
                     <div className="flex items-center space-x-4">
                        <NotificationBell userId={user.id} />
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <img src={currentUser.avatarUrl || `https://i.pravatar.cc/150?u=${currentUser.id}`} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"/>
                            <div>
                                <p className="font-semibold">{currentUser.name}</p>
                                <p className="text-sm text-gray-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <button onClick={onLogout} className="p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto border-l border-gray-700">
                    <div className="flex space-x-2 mb-6 border-b border-gray-700">
                        <button onClick={() => setView('institutions')} className={`px-4 py-3 font-semibold transition-colors ${view === 'institutions' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}>
                            Manage Institutions
                        </button>
                        <button onClick={() => setView('programs')} className={`px-4 py-3 font-semibold transition-colors ${view === 'programs' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}>
                            Manage Programs
                        </button>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-6">
                        <h3 className="text-xl font-bold mb-2">Upload {view === 'institutions' ? 'Institutions' : 'Programs'} Data</h3>
                        <p className="text-sm text-gray-400 mb-4">Upload a CSV file to add or update multiple {view} at once. Make sure your file matches the template format.</p>
                        {feedback && (
                            <div className={`p-3 rounded-md mb-4 text-sm ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                {feedback.message}
                            </div>
                        )}
                        <div className="flex items-center space-x-4">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:bg-gray-500">
                                <UploadIcon /> {isProcessing ? 'Processing...' : 'Upload CSV'}
                            </button>
                            <a href={view === 'institutions' ? institutionCsvTemplate : programCsvTemplate} download={view === 'institutions' ? 'institutions_template.csv' : 'programs_template.csv'} className="text-sm text-cyan-400 hover:underline">
                                Download Template
                            </a>
                        </div>
                    </div>

                    {view === 'institutions' && (
                        <div className="bg-gray-800 rounded-lg shadow-xl overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Acronym</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Ownership</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {institutions.map(inst => (
                                        <tr key={inst.id} className="hover:bg-gray-700/50">
                                            <td className="px-6 py-4 flex items-center gap-3"><img src={inst.logoUrl} className="w-8 h-8 rounded-full bg-white p-0.5" alt={inst.name}/> {inst.name}</td>
                                            <td className="px-6 py-4">{inst.acronym}</td>
                                            <td className="px-6 py-4">{inst.type}</td>
                                            <td className="px-6 py-4">{inst.ownership}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {institutions.length === 0 && <p className="text-center py-8 text-gray-400">No institutions found.</p>}
                        </div>
                    )}

                     {view === 'programs' && (
                        <div className="bg-gray-800 rounded-lg shadow-xl overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Program Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Institution</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Level</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {programs.map(prog => {
                                        const institution = institutions.find(i => i.id === prog.institutionId);
                                        return (
                                            <tr key={prog.id} className="hover:bg-gray-700/50">
                                                <td className="px-6 py-4">{prog.name}</td>
                                                <td className="px-6 py-4">{institution?.acronym || 'N/A'}</td>
                                                <td className="px-6 py-4">{prog.level}</td>
                                                <td className="px-6 py-4">{prog.durationYears} yrs</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {programs.length === 0 && <p className="text-center py-8 text-gray-400">No programs found.</p>}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default NcheAdminPage;
