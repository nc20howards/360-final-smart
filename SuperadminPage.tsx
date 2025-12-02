import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// FIX: Added UnebResultEntry to imports for use in the new UNEB admin components.
import { AdminUser, School, Module, User as SchoolUser, AuditLogEntry, UnebPassSlip, SchoolUserRole, ExtractedUnebSlipData, AdmissionSettings, CompletedAdmission, PinResetRequest, SchoolClass, SmartIDSettings, CustomIdField, HigherEducationInstitution, Program } from '../types';
import { getAllStudents } from '../services/studentService';
import { getAllSchools, registerSchool, deleteSchool, updateSchool } from '../services/schoolService';
import { getAllAdminUsers, createAdminUser, deleteAdminUser, updateAdminUser, assignHeadteacherToSchool } from '../services/userService';
import { getAllModules, deleteModule, HOME_PAGE_MODULE_NAME, updateModuleAndAssignments, toggleModuleAssignability } from '../services/moduleService';
import { createBroadcastNotification } from '../services/notificationService';
import { APP_TITLE } from '../constants';
import StatCard from './StatCard';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import EWalletPage from './EWalletPage';
import { getUnebServiceFeeAmount, setUnebServiceFeeAmount, isUnebVerificationEnabled, setUnebVerificationEnabled } from '../services/systemSettingsService';
import NotificationBell from './NotificationBell';
import ProfilePage from './ProfilePage';
import { heartbeat } from '../services/presenceService';
import * as ncheService from '../services/ncheService';
import ExplorationModuleManager from './ExplorationModuleManager';


// --- Reusable Icons ---
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>);
const StudentsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
const SchoolsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const ModulesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>);
const AnnounceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.584C18.354 1.84 18.663 1.5 19 1.5s.646.34 1 1.084C20.06 4.363 21 6.643 21 9c0 3.357-1.938 6.223-4.564 7.317" /></svg>);
const WalletIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>);
const UnebIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M15 13.129l-5 2.857-5-2.857V9.32l5 2.857 5-2.857v3.81z" /></svg>);
const NcheIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M6 13.5V15l4 2.286L14 15v-1.5H6z" /></svg>);
const HamburgerIcon = () => (<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExplorationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M15.05 5.05a7 7 0 10-10 10 7 7 0 0010-10zM10 16a6 6 0 110-12 6 6 0 010 12z" /><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M4.343 4.343l1.414 1.414M14.243 14.243l1.414 1.414M4.343 15.657l1.414-1.414M14.243 5.757l1.414-1.414" /></svg>);


const timeSince = (timestamp: number | undefined): string => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};


// --- Custom Module Selector Component ---
interface ModuleSelectorProps {
    allModules: Module[];
    selectedModuleIds: string[];
    onChange: (selectedIds: string[]) => void;
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({ allModules, selectedModuleIds, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCheckboxChange = (moduleId: string, isChecked: boolean) => {
        const updatedModuleIds = new Set(selectedModuleIds);
        if (isChecked) {
            updatedModuleIds.add(moduleId);
        } else {
            updatedModuleIds.delete(moduleId);
        }
        onChange(Array.from(updatedModuleIds));
    };

    const selectedModuleNames = allModules
        .filter(m => selectedModuleIds.includes(m.id))
        .map(m => m.name)
        .join(', ');

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2 text-white bg-gray-700 rounded-md text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
                <span className="truncate pr-2">
                    {selectedModuleIds.length > 0 ? selectedModuleNames : 'Select modules...'}
                </span>
                <svg className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-600 border border-gray-500 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    {allModules.filter(m => m.isAssignable).map(module => (
                        <label key={module.id} className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedModuleIds.includes(module.id)}
                                onChange={e => handleCheckboxChange(module.id, e.target.checked)}
                                className="h-4 w-4 rounded bg-gray-800 border-gray-500 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-white">{module.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Custom School Selector Component ---
interface SchoolSelectorProps {
    allSchools: School[];
    selectedSchoolIds: string[];
    onChange: (selectedIds: string[]) => void;
}

const SchoolSelector: React.FC<SchoolSelectorProps> = ({ allSchools, selectedSchoolIds, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCheckboxChange = (schoolId: string, isChecked: boolean) => {
        const updatedSchoolIds = new Set(selectedSchoolIds);
        if (isChecked) {
            updatedSchoolIds.add(schoolId);
        } else {
            updatedSchoolIds.delete(schoolId);
        }
        onChange(Array.from(updatedSchoolIds));
    };

    const selectedSchoolNames = allSchools
        .filter(s => selectedSchoolIds.includes(s.id))
        .map(s => s.name)
        .join(', ');

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2 text-white bg-gray-700 rounded-md text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
                <span className="truncate pr-2">
                    {selectedSchoolIds.length > 0 ? selectedSchoolNames : 'Select schools...'}
                </span>
                <svg className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-600 border border-gray-500 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    {allSchools.map(school => (
                        <label key={school.id} className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedSchoolIds.includes(school.id)}
                                onChange={e => handleCheckboxChange(school.id, e.target.checked)}
                                className="h-4 w-4 rounded bg-gray-800 border-gray-500 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-white">{school.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Prop interfaces for the view components ---
interface StudentsViewProps {
    // FIX: Replaced 'User' with its imported alias 'SchoolUser' to resolve 'Cannot find name' error.
    users: SchoolUser[];
    schools: School[];
}

interface SchoolsViewProps {
    activeView: 'register' | 'view';
    schools: School[];
    adminUsers: AdminUser[];
    modules: Module[];
    newSchoolName: string;
    newSchoolAddress: string;
    newSchoolModules: string[];
    error: string;
    success: string;
    onSchoolNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSchoolAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSchoolModulesChange: (selectedIds: string[]) => void;
    onSubmit: (e: React.FormEvent) => void;
    onDelete: (schoolId: string, schoolName: string) => void;
    onEdit: (school: School) => void;
}

interface UsersViewProps {
    adminUsers: AdminUser[];
    schools: School[];
    formState: {
        name: string;
        email: string;
        role: 'headteacher' | 'uneb_admin' | 'nche_admin';
        assignedSchoolId: string; // Changed from array to string
        password?: string;
        confirmPassword?: string;
    };
    error: string;
    onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    onDelete: (userId: string, userName: string) => void;
    onEdit: (user: AdminUser) => void;
    onResetPassword: (user: AdminUser) => void;
    isEmailValidationEnabled: boolean;
    onToggleEmailValidation: () => void;
}

interface ModulesViewProps {
    modules: Module[];
    schools: School[];
    onDelete: (moduleId: string, moduleName: string) => void;
    onToggleAssignable: (moduleId: string) => void;
    onManageExploration: () => void;
}

interface DashboardViewProps {
    studentsCount: number;
    schoolsCount: number;
    adminsCount: number;
    modulesCount: number;
}


// --- View components defined outside the main component to prevent re-rendering on state change ---

const DashboardView: React.FC<DashboardViewProps> = ({ studentsCount, schoolsCount, adminsCount, modulesCount }) => (
    <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="Total Students"
                value={studentsCount}
                colorClassName="bg-cyan-500"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>}
            />
            <StatCard
                title="Total Schools"
                value={schoolsCount}
                colorClassName="bg-indigo-500"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v8a1 1 0 001 1h3v-3a1 1 0 011-1h2a1 1 0 011 1v3h3a1 1 0 001-1V8a1 1 0 00-.504-.868l-7-4z" clipRule="evenodd" /></svg>}
            />
            <StatCard
                title="Admin Users"
                value={adminsCount}
                colorClassName="bg-emerald-500"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>}
            />
             <StatCard
                title="Active Modules"
                value={modulesCount}
                colorClassName="bg-amber-500"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zM5 3a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H5z" /><path d="M15 4a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2zM15 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM5 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1H5zM5 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM15 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2zM15 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" /></svg>}
            />
        </div>
    </div>
);

const StudentsView: React.FC<StudentsViewProps> = ({ users, schools }) => (
    <div>
        <div className="bg-gray-800 rounded-lg shadow-xl">
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Student ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">School</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Class</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {users.length > 0 ? (
                            users.map((student) => {
                                const schoolName = schools.find(s => s.id === student.schoolId)?.name || 'N/A';
                                return (
                                    <tr key={student.studentId} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-white">{student.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-white">{student.studentId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-white">{schoolName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-white">{student.class}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-gray-400">No students have been created yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

const SchoolsView: React.FC<SchoolsViewProps> = ({
    activeView,
    schools,
    adminUsers,
    modules,
    newSchoolName,
    newSchoolAddress,
    newSchoolModules,
    error,
    success,
    onSchoolNameChange,
    onSchoolAddressChange,
    onSchoolModulesChange,
    onSubmit,
    onDelete,
    onEdit,
}) => (
     <div>
        {activeView === 'register' && (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 animate-slide-in-left-fade">
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}
                {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-md mb-4">{success}</div>}
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="schoolName" className="block text-sm font-medium text-gray-300 mb-1">School Name</label>
                        <input id="schoolName" value={newSchoolName} onChange={onSchoolNameChange} placeholder="e.g., Northwood High" required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                    <div>
                        <label htmlFor="schoolAddress" className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                        <input id="schoolAddress" value={newSchoolAddress} onChange={onSchoolAddressChange} placeholder="e.g., 123 Education Lane, Anytown" required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                     <div>
                        <label htmlFor="schoolModules" className="block text-sm font-medium text-gray-300 mb-1">Assign Modules</label>
                        <ModuleSelector
                            allModules={modules}
                            selectedModuleIds={newSchoolModules}
                            onChange={onSchoolModulesChange}
                        />
                    </div>
                    <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">
                        Register School
                    </button>
                </form>
            </div>
        )}

        {activeView === 'view' && (
            <div className="bg-gray-800 rounded-lg shadow-xl animate-slide-in-left-fade">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">School Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Assigned Modules</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Headteacher</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {schools.length > 0 ? (
                                schools.map((school) => {
                                    const assignedHeadteacherUsers = adminUsers.filter(
                                        user => user.role === 'headteacher' && user.assignedSchoolIds.includes(school.id)
                                    );
                                    
                                    const hasMultipleHeadteachers = assignedHeadteacherUsers.length > 1;

                                    const assignedHeadteachersText = assignedHeadteacherUsers.length > 0
                                        ? assignedHeadteacherUsers.map(u => u.name).join(', ')
                                        : 'N/A';
                                    
                                    return (
                                        <tr key={school.id} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{school.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-white">
                                                {(school.modules && school.modules.length > 0) ? (
                                                    <details className="relative group">
                                                        <summary className="list-none cursor-pointer font-medium text-cyan-400 hover:underline">
                                                            {school.modules.length} Module(s)
                                                        </summary>
                                                        <div className="absolute left-0 mt-2 w-64 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20 hidden group-open:block">
                                                            <ul className="p-2 space-y-1">
                                                                {school.modules.map(({ moduleId, status }) => {
                                                                    const moduleInfo = modules.find(mod => mod.id === moduleId);
                                                                    if (!moduleInfo) return null;
                                                                    return (
                                                                        <li key={moduleId} className="px-3 py-2 text-sm text-white flex justify-between items-center bg-gray-800 rounded-md">
                                                                            <span>{moduleInfo.name}</span>
                                                                            <span className={`capitalize px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                                                status === 'published' ? 'bg-cyan-500/20 text-cyan-300' :
                                                                                status === 'active' ? 'bg-green-500/20 text-green-300' :
                                                                                'bg-yellow-500/20 text-yellow-300'
                                                                            }`}>
                                                                                {status}
                                                                            </span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </div>
                                                    </details>
                                                ) : (
                                                    <span>N/A</span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap ${hasMultipleHeadteachers ? 'text-yellow-400' : 'text-white'}`}>
                                                {assignedHeadteachersText}
                                                {hasMultipleHeadteachers && <span className="ml-2 text-xs">(Multiple)</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                                <button onClick={() => onEdit(school)} className="text-cyan-400 hover:text-cyan-300">Edit</button>
                                                <button onClick={() => onDelete(school.id, school.name)} className="text-red-500 hover:text-red-400">Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-gray-400">No schools have been registered yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
);


const UsersView: React.FC<UsersViewProps> = ({ adminUsers, schools, formState, error, onFormChange, onSubmit, onDelete, onEdit, onResetPassword, isEmailValidationEnabled, onToggleEmailValidation }) => (
    <div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 text-white">Create a New Admin User</h3>
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="name" value={formState.name} onChange={onFormChange} placeholder="Full Name" required className="p-2 bg-gray-700 rounded-md"/>
                    <input name="email" type="email" value={formState.email} onChange={onFormChange} placeholder="Email Address" required className="p-2 bg-gray-700 rounded-md"/>
                    <select name="role" value={formState.role} onChange={onFormChange} className="p-2 bg-gray-700 rounded-md">
                        <option value="headteacher">Headteacher</option>
                        <option value="uneb_admin">UNEB Admin</option>
                        <option value="nche_admin">NCHE Admin</option>
                    </select>
                    {formState.role === 'headteacher' && (
                        <select name="assignedSchoolId" value={formState.assignedSchoolId} onChange={onFormChange} className="p-2 bg-gray-700 rounded-md">
                            <option value="">Assign to a School...</option>
                            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                        </select>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="password" type="password" value={formState.password || ''} onChange={onFormChange} placeholder="Password" required className="p-2 bg-gray-700 rounded-md"/>
                    <input name="confirmPassword" type="password" value={formState.confirmPassword || ''} onChange={onFormChange} placeholder="Confirm Password" required className="p-2 bg-gray-700 rounded-md"/>
                </div>
                <PasswordStrengthIndicator password={formState.password} />
                 <div className="flex items-center space-x-3">
                    <label htmlFor="email-validation-toggle" className="text-sm font-medium text-gray-300">Enable Email Verification</label>
                    <input id="email-validation-toggle" type="checkbox" checked={isEmailValidationEnabled} onChange={onToggleEmailValidation} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"/>
                </div>
                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Create User</button>
            </form>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold p-6 text-white">Registered Admin Users</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Assigned School</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Last Login</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {adminUsers.map(user => {
                            const assignedSchool = schools.find(s => user.assignedSchoolIds.includes(s.id));
                            return (
                                <tr key={user.id} className="hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap capitalize">{user.role.replace('_', ' ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{assignedSchool?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{timeSince(user.lastLogin)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                        <button onClick={() => onEdit(user)} className="text-cyan-400 hover:text-cyan-300">Edit</button>
                                        <button onClick={() => onResetPassword(user)} className="text-yellow-400 hover:text-yellow-300">Reset Pass</button>
                                        <button onClick={() => onDelete(user.id, user.name)} className="text-red-500 hover:text-red-400">Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

const ModulesView: React.FC<ModulesViewProps> = ({ modules, schools, onDelete, onToggleAssignable, onManageExploration }) => (
    <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 flex flex-col justify-between border-2 border-cyan-500/50">
                <div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ExplorationIcon/> Exploration Module</h3>
                    <p className="text-gray-400 text-sm mb-4 h-20 overflow-y-auto">Manage the 3D and AR content available to students for immersive learning experiences.</p>
                    <p className="text-sm text-gray-400 mb-4">Status: <span className="font-bold text-white">Core System</span></p>
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onManageExploration} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-semibold">Manage Content</button>
                </div>
            </div>
            {modules.map(module => {
                const assignedSchoolsCount = schools.filter(s => s.modules.some(m => m.moduleId === module.id)).length;

                return (
                    <div key={module.id} className="bg-gray-800 rounded-lg shadow-xl p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">{module.name}</h3>
                            <p className="text-gray-400 text-sm mb-4 h-20 overflow-y-auto">{module.description}</p>
                            <p className="text-sm text-gray-400 mb-4">Assigned to: <span className="font-bold text-white">{assignedSchoolsCount} school(s)</span></p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                                <span className="font-semibold">Assignable</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={module.isAssignable ?? true}
                                        onChange={() => onToggleAssignable(module.id)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-cyan-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => onDelete(module.id, module.name)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold">Delete</button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const NcheAdminView: React.FC = () => {
    const [institutions, setInstitutions] = useState<HigherEducationInstitution[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [view, setView] = useState<'institutions' | 'programs'>('institutions');

    const refreshNcheData = useCallback(() => {
        setInstitutions(ncheService.getAllInstitutions());
        setPrograms(ncheService.getAllPrograms());
    }, []);

    useEffect(() => {
        refreshNcheData();
    }, [refreshNcheData]);
    
    return (
        <div>
            <div className="flex space-x-2 mb-6 border-b border-gray-700">
                <button
                    onClick={() => setView('institutions')}
                    className={`px-4 py-3 font-semibold transition-colors ${view === 'institutions' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Institutions
                </button>
                <button
                    onClick={() => setView('programs')}
                    className={`px-4 py-3 font-semibold transition-colors ${view === 'programs' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Programs
                </button>
            </div>

            {view === 'institutions' && (
                <div className="bg-gray-800 rounded-lg shadow-xl">
                    {/* Institution creation form can go here */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Acronym</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ownership</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {institutions.map(inst => (
                                    <tr key={inst.id}>
                                        <td className="px-6 py-4 font-medium flex items-center gap-3"><img src={inst.logoUrl} className="w-8 h-8 rounded-full bg-white p-0.5" alt={inst.name}/> {inst.name}</td>
                                        <td className="px-6 py-4">{inst.acronym}</td>
                                        <td className="px-6 py-4">{inst.type}</td>
                                        <td className="px-6 py-4">{inst.ownership}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
             {view === 'programs' && (
                <div className="bg-gray-800 rounded-lg shadow-xl">
                    {/* Program creation form can go here */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Program Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Institution</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {programs.map(prog => {
                                    const institution = institutions.find(i => i.id === prog.institutionId);
                                    return (
                                        <tr key={prog.id}>
                                            <td className="px-6 py-4 font-medium">{prog.name}</td>
                                            <td className="px-6 py-4">{institution?.acronym || 'N/A'}</td>
                                            <td className="px-6 py-4">{prog.level}</td>
                                            <td className="px-6 py-4">{prog.durationYears} yrs</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- MAIN SUPERADMIN PAGE ---
interface SuperadminPageProps {
    // FIX: Replaced 'User' with its imported alias 'SchoolUser' to resolve 'Cannot find name' error.
    user: SchoolUser;
    onLogout: () => void;
}

export const SuperadminPage: React.FC<SuperadminPageProps> = ({ user, onLogout }) => {
    // State
    const [view, setView] = useState('dashboard');
    // FIX: Replaced 'User' with its imported alias 'SchoolUser' to resolve 'Cannot find name' error.
    const [students, setStudents] = useState<SchoolUser[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);
    const [activeSchoolView, setActiveSchoolView] = useState<'register' | 'view'>('register');
    
    // State for the single modal
    const [modal, setModal] = useState<{
        type: 'deleteSchool' | 'editSchool' | 'deleteUser' | 'editUser' | 'resetPassword' | 'deleteModule' | 'announcement';
        data?: any;
    } | null>(null);

    // Form states for modals
    const [schoolForm, setSchoolForm] = useState({ id: '', name: '', address: '', modules: [] as string[], headteacherId: '' });
    const [userForm, setUserForm] = useState({ id: '', name: '', email: '', role: 'headteacher' as 'headteacher' | 'uneb_admin' | 'nche_admin', assignedSchoolId: '', password: '', confirmPassword: '' });
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });

    // New state for UNEB service fee settings
    const [unebServiceFee, setUnebServiceFee] = useState<number>(0);
    const [unebVerification, setUnebVerification] = useState<boolean>(false);

    // Form state for creating new schools (kept on main page)
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolAddress, setNewSchoolAddress] = useState('');
    const [newSchoolModules, setNewSchoolModules] = useState<string[]>([]);
    
    // For password strength
    const [password, setPassword] = useState('');
    const [isEmailValidationEnabled, setIsEmailValidationEnabled] = useState(false);


    // --- Data Fetching ---
    const refreshData = useCallback(() => {
        setStudents(getAllStudents());
        setSchools(getAllSchools());
        setAdminUsers(getAllAdminUsers());
        setModules(getAllModules());
        setUnebServiceFee(getUnebServiceFeeAmount());
        setUnebVerification(isUnebVerificationEnabled());
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        const interval = setInterval(() => {
            heartbeat(currentUser.studentId);
        }, 5000);
        return () => clearInterval(interval);
    }, [currentUser.studentId]);

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };
    
    // Handlers
    const handleSchoolFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        try {
            registerSchool({ name: newSchoolName, address: newSchoolAddress }, newSchoolModules);
            setSuccess(`School "${newSchoolName}" registered successfully.`);
            setNewSchoolName('');
            setNewSchoolAddress('');
            setNewSchoolModules([]);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const handleSchoolEdit = (school: School) => {
        const assignedHeadteacher = adminUsers.find(
            user => user.role === 'headteacher' && user.assignedSchoolIds.includes(school.id)
        );

        setSchoolForm({
            id: school.id,
            name: school.name,
            address: school.address,
            modules: school.modules.map(m => m.moduleId),
            headteacherId: assignedHeadteacher ? assignedHeadteacher.id : ''
        });
        setModal({ type: 'editSchool', data: school });
    };

    const handleSchoolEditSubmit = () => {
        clearMessages();
        try {
            const currentSchool = schools.find(s => s.id === schoolForm.id);
            if (!currentSchool) throw new Error("Could not find school to update.");
    
            // The new set of selected ASSIGNABLE module IDs from the form.
            const selectedAssignableIds = new Set(schoolForm.modules);
    
            // The existing modules assignments for the school. Guard against undefined/null.
            const existingAssignments = currentSchool.modules || [];
    
            // Use a Map to build the new, definitive list of assignments.
            // This will automatically handle any potential duplicates and makes the logic very clear.
            const finalAssignmentsMap = new Map<string, { moduleId: string; status: 'assigned' | 'active' | 'published' }>();
    
            // 1. Go through ALL master modules to decide their fate for THIS school.
            for (const module of modules) {
                const existingAssignment = existingAssignments.find(m => m.moduleId === module.id);
                
                if (module.isAssignable) {
                    // For assignable modules, their presence is determined ONLY by the form selection.
                    if (selectedAssignableIds.has(module.id)) {
                        // It's selected. Preserve its old status if it existed, otherwise default to 'assigned'.
                        const status = existingAssignment ? existingAssignment.status : 'assigned';
                        finalAssignmentsMap.set(module.id, { moduleId: module.id, status });
                    }
                    // If not in selectedAssignableIds, it's implicitly unassigned, so we do nothing.
                } else {
                    // For unassignable modules (e.g., Home Page), they must ALWAYS be preserved if they existed before.
                    if (existingAssignment) {
                        finalAssignmentsMap.set(module.id, existingAssignment);
                    }
                }
            }
    
            const updatedSchoolData: Omit<School, 'id'> = {
                name: schoolForm.name,
                address: schoolForm.address,
                modules: Array.from(finalAssignmentsMap.values()), // Convert map back to array
                isHomePagePublished: currentSchool.isHomePagePublished
            };
            
            updateSchool(schoolForm.id, updatedSchoolData);
    
            assignHeadteacherToSchool(schoolForm.id, schoolForm.headteacherId || null);
    
            setSuccess(`School "${schoolForm.name}" updated successfully.`);
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleSchoolDelete = (schoolId: string, schoolName: string) => {
        setModal({ type: 'deleteSchool', data: { schoolId, schoolName } });
    };

    const confirmSchoolDelete = (schoolId: string) => {
        clearMessages();
        try {
            deleteSchool(schoolId);
            setSuccess('School deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleUserFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        if (userForm.password !== userForm.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            createAdminUser({
                name: userForm.name,
                email: userForm.email,
                role: userForm.role,
                assignedSchoolIds: userForm.role === 'headteacher' && userForm.assignedSchoolId ? [userForm.assignedSchoolId] : [],
                password: userForm.password,
            });
            setSuccess(`User "${userForm.name}" created successfully.`);
            setUserForm({ id: '', name: '', email: '', role: 'headteacher', assignedSchoolId: '', password: '', confirmPassword: ''});
            setPassword('');
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleUserEdit = (userToEdit: AdminUser) => {
        setUserForm({
            id: userToEdit.id,
            name: userToEdit.name,
            email: userToEdit.email,
            role: userToEdit.role,
            assignedSchoolId: userToEdit.assignedSchoolIds[0] || '',
            password: '',
            confirmPassword: '',
        });
        setModal({ type: 'editUser', data: userToEdit });
    };
    
    const handleUserEditSubmit = () => {
        clearMessages();
        try {
            const originalUser = adminUsers.find(u => u.id === userForm.id);
            if (!originalUser) throw new Error("User not found for update.");

            const updatedData: Omit<AdminUser, 'id'> = {
                name: userForm.name,
                email: userForm.email,
                role: userForm.role,
                assignedSchoolIds: userForm.assignedSchoolId ? [userForm.assignedSchoolId] : [],
                password: originalUser.password
            };
            
            updateAdminUser(userForm.id, updatedData);
            setSuccess(`User "${userForm.name}" updated successfully.`);
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const handleUserDelete = (userId: string, userName: string) => {
        setModal({ type: 'deleteUser', data: { userId, userName }});
    };
    
    const confirmUserDelete = (userId: string) => {
        clearMessages();
        try {
            deleteAdminUser(userId);
            setSuccess('User deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleResetPassword = (userToReset: AdminUser) => {
        setPassword('');
        setUserForm({ id: userToReset.id, name: userToReset.name, email: userToReset.email, role: userToReset.role, assignedSchoolId: userToReset.assignedSchoolIds[0] || '', password: '', confirmPassword: '' });
        setModal({ type: 'resetPassword', data: userToReset });
    };
    
    const confirmResetPassword = () => {
        clearMessages();
        const userToUpdate = adminUsers.find(u => u.id === userForm.id);
        if (!userToUpdate) {
            setError("User not found.");
            return;
        }
        if (password.length < 6) {
            setError("New password must be at least 6 characters.");
            return;
        }
        if (password !== userForm.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        try {
            updateAdminUser(userForm.id, { ...userToUpdate, password: password });
            setSuccess(`Password for ${userForm.name} has been reset.`);
            setModal(null);
            setPassword('');
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const handleModuleDelete = (moduleId: string, moduleName: string) => {
        setModal({ type: 'deleteModule', data: { moduleId, moduleName }});
    };

    const confirmModuleDelete = (moduleId: string) => {
        clearMessages();
        try {
            deleteModule(moduleId);
            setSuccess('Module deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleModuleToggleAssignable = (moduleId: string) => {
        clearMessages();
        try {
            toggleModuleAssignability(moduleId);
            refreshData();
        } catch(err) {
            setError((err as Error).message);
        }
    };
    
    const handleAnnouncement = () => {
        setModal({ type: 'announcement' });
    };

    const handleAnnouncementSubmit = () => {
        clearMessages();
        const studentIds = students.map(s => s.studentId);
        try {
            createBroadcastNotification(announcementForm.title, announcementForm.message, studentIds);
            setSuccess('Announcement sent to all students.');
            setModal(null);
            setAnnouncementForm({ title: '', message: '' });
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const handleUnebSettingsSave = () => {
        setUnebServiceFeeAmount(unebServiceFee);
        setUnebVerificationEnabled(unebVerification);
        setSuccess("UNEB settings saved successfully.");
    };

    const availableHeadteachers = useMemo(() => {
        const schoolBeingEditedId = modal?.type === 'editSchool' ? (modal.data as School).id : null;
        return adminUsers.filter(user => 
            user.role === 'headteacher' && 
            (user.assignedSchoolIds.length === 0 || (schoolBeingEditedId && user.assignedSchoolIds.includes(schoolBeingEditedId)))
        );
    }, [adminUsers, modal]);


    const renderMainContent = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView studentsCount={students.length} schoolsCount={schools.length} adminsCount={adminUsers.length} modulesCount={modules.length} />;
            case 'students':
                return <StudentsView users={students} schools={schools} />;
            case 'schools':
                return (
                    <div>
                        <div className="flex space-x-2 mb-6 border-b border-gray-700">
                             <button
                                onClick={() => setActiveSchoolView('register')}
                                className={`px-4 py-3 font-semibold transition-colors ${activeSchoolView === 'register' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Register a New School
                            </button>
                            <button
                                onClick={() => setActiveSchoolView('view')}
                                className={`px-4 py-3 font-semibold transition-colors ${activeSchoolView === 'view' ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Registered Schools
                            </button>
                        </div>
                        <SchoolsView
                            activeView={activeSchoolView}
                            schools={schools}
                            adminUsers={adminUsers}
                            modules={modules}
                            newSchoolName={newSchoolName}
                            newSchoolAddress={newSchoolAddress}
                            newSchoolModules={newSchoolModules}
                            error={error}
                            success={success}
                            onSchoolNameChange={e => setNewSchoolName(e.target.value)}
                            onSchoolAddressChange={e => setNewSchoolAddress(e.target.value)}
                            onSchoolModulesChange={setNewSchoolModules}
                            onSubmit={handleSchoolFormSubmit}
                            onDelete={handleSchoolDelete}
                            onEdit={handleSchoolEdit}
                        />
                    </div>
                );
            case 'users':
                return <UsersView
                    adminUsers={adminUsers}
                    schools={schools}
                    formState={userForm}
                    error={error}
                    onFormChange={(e) => {
                        const { name, value } = e.target;
                        setUserForm(prev => ({...prev, [name]: value}));
                        if (name === 'password') setPassword(value);
                    }}
                    onSubmit={handleUserFormSubmit}
                    onDelete={handleUserDelete}
                    onEdit={handleUserEdit}
                    onResetPassword={handleResetPassword}
                    isEmailValidationEnabled={isEmailValidationEnabled}
                    onToggleEmailValidation={() => setIsEmailValidationEnabled(!isEmailValidationEnabled)}
                />;
            case 'modules':
                return <ModulesView 
                    modules={modules} 
                    schools={schools} 
                    onDelete={handleModuleDelete}
                    onToggleAssignable={handleModuleToggleAssignable}
                    onManageExploration={() => setView('exploration_manager')} 
                />;
            case 'announcements':
                return (
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                        <h3 className="text-xl font-bold mb-4 text-white">Send Announcement</h3>
                        <form onSubmit={e => { e.preventDefault(); handleAnnouncement(); }} className="space-y-4">
                            <input value={announcementForm.title} onChange={e => setAnnouncementForm({...announcementForm, title: e.target.value})} placeholder="Title" required className="w-full p-2 bg-gray-700 rounded-md"/>
                            <textarea value={announcementForm.message} onChange={e => setAnnouncementForm({...announcementForm, message: e.target.value})} placeholder="Message" required rows={5} className="w-full p-2 bg-gray-700 rounded-md"/>
                            <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Send to All Students</button>
                        </form>
                    </div>
                );
            case 'wallet':
                return <EWalletPage user={user} />;
            case 'uneb_settings':
                return (
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                        <h3 className="text-xl font-bold mb-4 text-white">UNEB Service Settings</h3>
                        {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4">{success}</div>}
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input type="checkbox" checked={unebVerification} onChange={e => setUnebVerification(e.target.checked)} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-600 border-gray-500 rounded focus:ring-cyan-500"/>
                                    <span>Enable Automatic UNEB Result Verification</span>
                                </label>
                                <p className="text-sm text-gray-400 mt-1 pl-8">If enabled, the system will check self-submitted results against the UNEB database during Smart Admission.</p>
                            </div>
                            <div>
                                <label htmlFor="uneb-fee" className="block text-sm font-medium text-gray-300 mb-1">UNEB Service Fee (UGX)</label>
                                <input id="uneb-fee" type="number" value={unebServiceFee} onChange={e => setUnebServiceFee(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-gray-700 rounded-md"/>
                                <p className="text-sm text-gray-400 mt-1">This fee is deducted from the student's admission fee payment and distributed when UNEB verification is enabled.</p>
                            </div>
                            <button onClick={handleUnebSettingsSave} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Settings</button>
                        </div>
                    </div>
                );
            case 'nche_management':
                return <NcheAdminView />;
            case 'exploration_manager':
                return <ExplorationModuleManager />;
            default: return null;
        }
    };

    const navLinks = [
        { name: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard' },
        { name: 'Manage Students', icon: <StudentsIcon />, view: 'students' },
        { name: 'Manage Schools', icon: <SchoolsIcon />, view: 'schools' },
        { name: 'Manage Users', icon: <UsersIcon />, view: 'users' },
        { name: 'Manage Modules', icon: <ModulesIcon />, view: 'modules' },
        { name: 'Announcements', icon: <AnnounceIcon />, view: 'announcements' },
        { name: 'E-Wallet', icon: <WalletIcon />, view: 'wallet' },
        { name: 'UNEB Settings', icon: <UnebIcon />, view: 'uneb_settings' },
        { name: 'NCHE Management', icon: <NcheIcon />, view: 'nche_management' },
    ];
    
    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <aside className={`bg-gray-800 p-4 flex-col justify-between transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} hidden lg:flex`}>
                <div>
                    <div className="flex items-center justify-center mb-8 h-10">
                         {!isSidebarCollapsed && <h1 className="text-xl font-bold text-cyan-400">{APP_TITLE}</h1>}
                    </div>
                     <nav className="space-y-2">
                         {navLinks.map(link => (
                             <button key={link.view} onClick={() => setView(link.view)} title={link.name}
                                className={`w-full flex items-center space-x-4 p-3 rounded-lg transition-colors ${view === link.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                                 {link.icon}
                                 {!isSidebarCollapsed && <span>{link.name}</span>}
                            </button>
                         ))}
                    </nav>
                </div>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-800 border-l border-gray-700 shadow-md">
                    <div className="flex items-center space-x-4">
                        <button className="lg:hidden p-1 text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}><HamburgerIcon /></button>
                        <button className="hidden lg:block p-1 text-gray-400 hover:text-white" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}><HamburgerIcon /></button>
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationBell userId={user.studentId} />
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <img src={currentUser.avatarUrl || `https://i.pravatar.cc/150?u=${currentUser.studentId}`} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"/>
                            <div>
                                <p className="font-semibold">{currentUser.name}</p>
                                <p className="text-sm text-gray-400 capitalize">{currentUser.role}</p>
                            </div>
                        </div>
                        <button onClick={onLogout} className="p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto border-l border-gray-700">
                    <div className="container mx-auto">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 capitalize">{view.replace(/_/g, ' ')}</h2>
                        {renderMainContent()}
                    </div>
                </main>
            </div>
            
            {isMobileMenuOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <aside className="fixed top-0 left-0 h-full w-64 bg-gray-800 shadow-xl z-50 p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-cyan-400">{APP_TITLE}</h2>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon /></button>
                        </div>
                         <nav className="space-y-2">
                             {navLinks.map(link => (
                                <button key={link.view} onClick={() => { setView(link.view); setIsMobileMenuOpen(false); }}
                                    className={`w-full flex items-center space-x-4 p-3 rounded-lg transition-colors ${view === link.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                                    {link.icon}
                                    <span>{link.name}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>
                </div>
            )}

            {modal?.type === 'editSchool' && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4 text-white">Edit School: {modal.data.name}</h3>
                        <form onSubmit={e => { e.preventDefault(); handleSchoolEditSubmit(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">School Name</label>
                                <input value={schoolForm.name} onChange={e => setSchoolForm({...schoolForm, name: e.target.value})} required className="w-full p-2 bg-gray-700 rounded-md"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                                <input value={schoolForm.address} onChange={e => setSchoolForm({...schoolForm, address: e.target.value})} required className="w-full p-2 bg-gray-700 rounded-md"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Assign Modules</label>
                                <ModuleSelector
                                    allModules={modules}
                                    selectedModuleIds={schoolForm.modules}
                                    onChange={(selectedIds) => setSchoolForm({...schoolForm, modules: selectedIds})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Assign Headteacher</label>
                                <select
                                    value={schoolForm.headteacherId}
                                    onChange={e => setSchoolForm({...schoolForm, headteacherId: e.target.value})}
                                    className="w-full p-2 bg-gray-700 rounded-md"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {availableHeadteachers.map(ht => (
                                        <option key={ht.id} value={ht.id}>{ht.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-4 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as SchoolUser);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                />
            )}
        </div>
    );
};
