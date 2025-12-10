
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// FIX: Added UnebResultEntry to imports for use in the new UNEB admin components.
import { AdminUser, School, Module, User as SchoolUser, AuditLogEntry, UnebPassSlip, SchoolUserRole, ExtractedUnebSlipData, AdmissionSettings, CompletedAdmission, PinResetRequest, SchoolClass, SmartIDSettings, CustomIdField, HigherEducationInstitution, Program, UnebLogoSettings } from '../types';
import { getAllSchoolUsers, getAllStudents } from '../services/studentService';
import { getAllSchools, registerSchool, deleteSchool, updateSchool } from '../services/schoolService';
import { getAllAdminUsers, createAdminUser, deleteAdminUser, updateAdminUser, assignHeadteacherToSchool, resetAdminUserPassword } from '../services/userService';
import { getAllModules, deleteModule, HOME_PAGE_MODULE_NAME, toggleModuleAssignability, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, STUDENT_TRANSFER_MODULE_NAME, NEWS_FEED_MODULE_NAME, EXPLORATION_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME } from '../services/moduleService';
import { createBroadcastNotification } from '../services/notificationService';
import { APP_TITLE } from '../constants';
import StatCard from './StatCard';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import EWalletPage from './EWalletPage';
import { getUnebServiceFeeAmount, setUnebServiceFeeAmount, isUnebVerificationEnabled, setUnebVerificationEnabled, getUnebLogoSettings, saveUnebLogoSettings } from '../services/systemSettingsService';
import NotificationBell from './NotificationBell';
import ProfilePage from './ProfilePage';
import { heartbeat, isOnline } from '../services/presenceService';
import * as ncheService from '../services/ncheService';
import ExplorationModuleManager from './ExplorationModuleManager';
import UserAvatar from './UserAvatar';
import ConfirmationModal from './ConfirmationModal';
import MyInstituteAdminPage from './MyInstituteAdminPage';
import SchoolDirectory from './SchoolDirectory';
import { getAllLogs } from '../services/auditLogService';

// Make TypeScript aware of the globally loaded Chart.js library
declare var Chart: any;


// --- Reusable Icons ---
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>);
const StudentsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
const SchoolsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const ModulesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>);
const AnnounceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.584C18.354 1.84 18.663 1.5 19 1.5s.646.34 1 1.084C20.06 4.363 21 6.643 21 9c0 3.357-1.938 6.223-4.564 7.317" /></svg>);
const WalletIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>);
const UnebIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M15 13.129l-5 2.857-5-2.857V9.32l5 2.857 5-2.857v3.81z" /></svg>);
const NcheIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M6 13.5V15l4 2.286L14 15v-1.5H6z" /></svg>);
const HamburgerIcon = () => (<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExplorationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M15.05 5.05a7 7 0 10-10 10 7 7 0 0010-10zM10 16a6 6 0 110-12 6 6 0 010 12z" /><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M4.343 4.343l1.414 1.414M14.243 14.243l1.414 1.414M4.343 15.657l1.414-1.414M14.243 5.757l1.414-1.414" /></svg>);
const DirectoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const ReportIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);
const ActivityIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>);
const CpuChipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M9 5a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2H9z" /></svg>;
const MemoryChipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h6a2 2 0 012 2v4m-6-6v1.5a3 3 0 003 3v0a3 3 0 003-3V3m-3 0h-3m-6 18H5a2 2 0 01-2-2v-4m6 6h6a2 2 0 002-2v-4m-6 6v-1.5a3 3 0 013-3v0a3 3 0 013 3V21m-3 0h-3" /></svg>;
const HardDriveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm-1 4h16m-8-2v8" /></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CheckCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const ExclamationCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
const BellAlertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const UsersGroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const ShieldCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.917L12 23l9-2.083A12.02 12.02 0 0017.618 5.984z" /></svg>;
const CodeBracketIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
const ExclamationTriangleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;


const timeSince = (timestamp: number | undefined): string => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
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


// --- View Interfaces ---
interface DashboardViewProps {
    studentsCount: number;
    schoolsCount: number;
    adminsCount: number;
    modulesCount: number;
}

interface StudentsViewProps {
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


// --- View Components (Restored) ---

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
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zM5 3a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H5z" /><path d="M15 4a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2zM15 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2h-2zM5 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 00-1-1H5zM5 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2H5zM15 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 00-1-1h-2zM15 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2h-2z" /></svg>}
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">ID</th>
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
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-cyan-400 font-bold">{school.id}</td>
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


// --- Chart Component ---
const ChartComponent: React.FC<{ chartData: any, chartOptions: any, type: 'line' | 'bar' }> = ({ chartData, chartOptions, type }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                 chartInstance.current = new Chart(ctx, {
                    type: type,
                    data: chartData,
                    options: chartOptions,
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [chartData, chartOptions, type]);

    return <canvas ref={chartRef}></canvas>;
};


const SystemReportView: React.FC<{ schools: School[], modules: Module[] }> = ({ schools, modules }) => {
    const [pageLoad, setPageLoad] = useState([110]);
    const [loginTime, setLoginTime] = useState([240]);
    const [dataFetch, setDataFetch] = useState([75]);
    const [cpu, setCpu] = useState([25]);
    const [ram, setRam] = useState([55]);
    const [uptime, setUptime] = useState('0d 0h 0m 0s');
    const startTime = useRef(Date.now());
    const [apiResponseTime, setApiResponseTime] = useState(90);
    const [apiRequests, setApiRequests] = useState({ total: 1000, failed: 5 });
    const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

    const [onlineUsers, setOnlineUsers] = useState([0]);
    const [dailyActivity, setDailyActivity] = useState(0);
    const [failedLogins, setFailedLogins] = useState(3);
    const [blockedThreats, setBlockedThreats] = useState(1);
    const [suspiciousLogs, setSuspiciousLogs] = useState<AuditLogEntry[]>([]);
    const allSchoolUsers = useMemo(() => getAllSchoolUsers(), []);

    const MAX_DATA_POINTS = 20;

    const updateDataArray = (setter: React.Dispatch<React.SetStateAction<number[]>>, value: number) => {
        setter(prev => [...prev, value].slice(-MAX_DATA_POINTS));
    };

    useEffect(() => {
        const interval = setInterval(() => {
            updateDataArray(setPageLoad, Math.max(80, Math.round(pageLoad[pageLoad.length-1] + (Math.random() - 0.5) * 10)));
            updateDataArray(setLoginTime, Math.max(200, Math.round(loginTime[loginTime.length-1] + (Math.random() - 0.5) * 20)));
            updateDataArray(setDataFetch, Math.max(50, Math.round(dataFetch[dataFetch.length-1] + (Math.random() - 0.5) * 8)));
            updateDataArray(setCpu, Math.round(Math.min(100, Math.max(10, cpu[cpu.length-1] + (Math.random() - 0.5) * 5))));
            updateDataArray(setRam, Math.round(Math.min(100, Math.max(40, ram[ram.length-1] + (Math.random() - 0.4) * 3))));
            updateDataArray(setOnlineUsers, allSchoolUsers.filter(u => isOnline(u.studentId)).length + Math.floor(Math.random() * 5));

            setApiResponseTime(a => Math.round(Math.max(70, a + (Math.random() - 0.5) * 15)));
            setApiRequests(prev => ({ total: prev.total + Math.floor(Math.random() * 20), failed: prev.failed + (Math.random() < 0.02 ? 1 : 0) }));

            const now = Date.now();
            const diff = now - startTime.current;
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setUptime(`${d}d ${h}h ${m}m ${s}s`);

            const allLogs = getAllLogs();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            setDailyActivity(allLogs.filter(log => log.timestamp > oneDayAgo).length);
            
            setRecentLogs(allLogs.slice(0, 5));
            setFailedLogins(prev => Math.max(0, Math.round(prev + (Math.random() - 0.5) * 2)));
            if (Math.random() < 0.1) setBlockedThreats(prev => prev + 1);
            setSuspiciousLogs(allLogs.filter(log => log.action.includes('FAIL') && !log.action.includes('LOGIN')).slice(0, 3));

        }, 2500);

        return () => clearInterval(interval);
    }, [allSchoolUsers, cpu, dataFetch, loginTime, pageLoad, ram, onlineUsers]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
        layout: { padding: { top: 5, bottom: 5, left: 5, right: 5 } }
    };

    const getChartData = (data: number[], color: string) => ({
        labels: data.map(() => ''),
        datasets: [{ data, borderColor: color, backgroundColor: `${color}33`, fill: true }]
    });

    const apiSuccessRate = apiRequests.total > 0 ? ((apiRequests.total - apiRequests.failed) / apiRequests.total) * 100 : 100;
    const ProgressBar: React.FC<{ value: number; colorClass: string }> = ({ value, colorClass }) => (<div className="w-full bg-gray-700 rounded-full h-2.5"><div className={`${colorClass} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${value}%` }}></div></div>);
    const getBarColor = (value: number) => value > 85 ? 'bg-red-500' : value > 65 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in-up">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-2">System Speed (ms)</h3><div className="h-24"><ChartComponent type="line" chartData={getChartData(pageLoad, '#38bdf8')} chartOptions={chartOptions} /></div><div className="flex justify-between items-baseline mt-2"><span className="text-gray-400">Avg. Page Load</span><span className="font-bold text-cyan-400">{pageLoad[pageLoad.length-1]}ms</span></div><div className="flex justify-between items-baseline"><span className="text-gray-400">Avg. Login Time</span><span className="font-bold text-cyan-400">{loginTime[loginTime.length-1]}ms</span></div><div className="flex justify-between items-baseline"><span className="text-gray-400">Avg. Data Fetch</span><span className="font-bold text-cyan-400">{dataFetch[dataFetch.length-1]}ms</span></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-2">Server Health (%)</h3><div className="h-24"><ChartComponent type="line" chartData={getChartData(ram, '#818cf8')} chartOptions={chartOptions} /></div><div><div className="flex justify-between text-sm mb-1"><span className="text-gray-400 flex items-center gap-2"><CpuChipIcon /> CPU Usage</span><span className="font-bold">{cpu[cpu.length-1]}%</span></div><ProgressBar value={cpu[cpu.length-1]} colorClass={getBarColor(cpu[cpu.length-1])} /></div><div className="mt-2"><div className="flex justify-between text-sm mb-1"><span className="text-gray-400 flex items-center gap-2"><MemoryChipIcon /> RAM Usage</span><span className="font-bold">{ram[ram.length-1]}%</span></div><ProgressBar value={ram[ram.length-1]} colorClass={getBarColor(ram[ram.length-1])} /></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-4">API Performance</h3><div className="space-y-4"><div className="flex justify-between items-baseline"><span className="text-gray-400">Avg. Response Time</span><span className="font-bold text-cyan-400">{apiResponseTime}ms</span></div><div><div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Success Rate</span><span className={`font-bold ${apiSuccessRate > 98 ? 'text-green-400' : 'text-yellow-400'}`}>{apiSuccessRate.toFixed(2)}%</span></div><ProgressBar value={apiSuccessRate} colorClass={apiSuccessRate > 98 ? 'bg-green-500' : 'bg-yellow-500'} /></div><div className="border-t border-gray-700 pt-3 mt-3 grid grid-cols-2 gap-4 text-center"><div><p className="text-2xl font-bold text-white">{apiRequests.total.toLocaleString()}</p><p className="text-xs text-gray-400 uppercase">Total Calls</p></div><div><p className="text-2xl font-bold text-red-500">{apiRequests.failed.toLocaleString()}</p><p className="text-xs text-gray-400 uppercase">Failed Calls</p></div></div></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-2 flex items-center gap-2"><UsersGroupIcon /> User Load & Traffic</h3><div className="h-24"><ChartComponent type="line" chartData={getChartData(onlineUsers, '#fbbf24')} chartOptions={chartOptions} /></div><div className="grid grid-cols-2 gap-4 text-center mt-2"><div><p className="text-3xl font-bold text-cyan-400">{onlineUsers[onlineUsers.length-1]}</p><p className="text-xs text-gray-400 uppercase">Users Online</p></div><div><p className="text-3xl font-bold text-cyan-400">{dailyActivity.toLocaleString()}</p><p className="text-xs text-gray-400 uppercase">Activity (24h)</p></div></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2"><ShieldCheckIcon /> Security Monitoring</h3><div className="grid grid-cols-2 gap-4 text-center mb-4"><div><p className="text-3xl font-bold text-yellow-400">{failedLogins}</p><p className="text-xs text-gray-400 uppercase">Failed Logins (1h)</p></div><div><p className="text-3xl font-bold text-red-500">{blockedThreats}</p><p className="text-xs text-gray-400 uppercase">Blocked Threats</p></div></div><div><h4 className="text-sm font-semibold text-gray-400 mb-2">Recent Suspicious Activity</h4><div className="space-y-2 text-xs">{suspiciousLogs.length > 0 ? suspiciousLogs.map(log => (<div key={log.id} className="flex items-center gap-2 bg-red-500/10 p-1.5 rounded-md"><ExclamationTriangleIcon className="text-red-400 flex-shrink-0" /><p className="truncate"><span className="font-semibold text-red-300">{log.action.replace(/_/g, ' ')}</span> by {log.userName}</p></div>)) : <p className="text-gray-500 italic">No suspicious activity.</p>}</div></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2"><CodeBracketIcon /> Resource Optimization</h3><div className="space-y-4"><div className="border-t border-gray-700 pt-3"> <h4 className="text-sm font-semibold text-gray-400 mb-2">Slow Data Access Patterns</h4><ul className="text-xs space-y-1 text-gray-300"><li className="flex justify-between"><span>Full Log Aggregation</span> <span className="text-red-400">Slow (210ms)</span></li><li className="flex justify-between"><span>Live Presence Scan</span> <span className="text-green-400">Fast (15ms)</span></li></ul></div></div></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg xl:col-span-3"><h3 className="font-bold text-lg text-white mb-4">Recent System Events & Errors</h3><div className="space-y-3">{recentLogs.map(log => {const isError = log.action.toLowerCase().includes('fail') || log.action.toLowerCase().includes('error');return (<div key={log.id} className={`flex items-start gap-3 p-2 rounded-md ${isError ? 'bg-red-500/10' : 'bg-gray-700/50'}`}><div className={`flex-shrink-0 mt-1 ${isError ? 'text-red-400' : 'text-cyan-400'}`}>{isError ? <ExclamationCircleIcon /> : <CheckCircleIcon />}</div><div className="flex-grow"><div className="flex justify-between items-start"><p className={`font-semibold text-sm ${isError ? 'text-red-300' : 'text-gray-200'}`}>{log.action.replace(/_/g, ' ')}</p><span className="text-xs text-gray-500">{timeSince(log.timestamp)}</span></div><p className="text-xs text-gray-400">User: {log.userName} ({log.userId})</p></div></div>)})}</div></div>
        </div>
    );
};


const LiveActivityView: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [filterText, setFilterText] = useState('');
    const [filterSchool, setFilterSchool] = useState<string>('all');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [allSchools, setAllSchools] = useState<School[]>([]);

    useEffect(() => {
        const fetchLogs = () => {
            setLogs(getAllLogs());
        };
        setAllSchools(getAllSchools());
        fetchLogs();
        const interval = setInterval(fetchLogs, 2500); // Poll slightly faster for live feel
        return () => clearInterval(interval);
    }, []);

    const allRoles = useMemo(() => {
        const roles = new Set<string>();
        // Add roles from existing users
        getAllSchoolUsers().forEach(u => roles.add(u.role));
        getAllAdminUsers().forEach(u => roles.add(u.role));
        // Ensure common roles exist even if no user has them yet
        ['student', 'teacher', 'headteacher', 'parent', 'admin'].forEach(r => roles.add(r));
        return Array.from(roles);
    }, []);

    const getModuleFromAction = (action: string) => {
        const lowerAction = action.toLowerCase();
        if (lowerAction.includes('login')) return { name: 'Auth', color: 'bg-blue-500/20 text-blue-300' };
        if (lowerAction.includes('canteen')) return { name: 'Canteen', color: 'bg-green-500/20 text-green-300' };
        if (lowerAction.includes('vote') || lowerAction.includes('election')) return { name: 'E-Vote', color: 'bg-purple-500/20 text-purple-300' };
        if (lowerAction.includes('transfer')) return { name: 'Transfer', color: 'bg-yellow-500/20 text-yellow-300' };
        if (lowerAction.includes('fee') || lowerAction.includes('payment') || lowerAction.includes('wallet')) return { name: 'E-Wallet', color: 'bg-emerald-500/20 text-emerald-300' };
        if (lowerAction.includes('visitor')) return { name: 'Visitor', color: 'bg-orange-500/20 text-orange-300' };
        if (lowerAction.includes('admission')) return { name: 'Admission', color: 'bg-cyan-500/20 text-cyan-300' };
        return { name: 'General', color: 'bg-gray-500/20 text-gray-300' };
    };

    const filteredLogs = useMemo(() => {
        const lowerFilterText = filterText.toLowerCase();
        return logs.filter(log => {
            const textMatch = filterText === '' || 
                log.userName.toLowerCase().includes(lowerFilterText) ||
                log.action.toLowerCase().includes(lowerFilterText) ||
                log.userId.toLowerCase().includes(lowerFilterText);

            // Updated School Filtering Logic
            // We now rely on the schoolId property added to the AuditLogEntry in auditLogService
            const schoolMatch = filterSchool === 'all' || (log.schoolId === filterSchool);
            
            // Updated Role Filtering Logic
            // We need to look up the user again to check the role, as it's not stored on the log entry directly to save space/sync
            let roleMatch = true;
            if (filterRole !== 'all') {
                const student = getAllSchoolUsers().find(u => u.studentId === log.userId);
                const admin = getAllAdminUsers().find(u => u.id === log.userId);
                const userRole = student?.role || admin?.role;
                roleMatch = userRole === filterRole;
            }

            return textMatch && schoolMatch && roleMatch;
        });
    }, [logs, filterText, filterSchool, filterRole]);
    

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg">
                <input 
                    type="text" 
                    placeholder="Filter by user, ID, or action..." 
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="bg-gray-700 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                 <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="bg-gray-700 text-white px-4 py-2 rounded-md">
                    <option value="all">All Schools</option>
                    {allSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-gray-700 text-white px-4 py-2 rounded-md">
                    <option value="all">All Roles</option>
                    {allRoles.map(role => <option key={role} value={role} className="capitalize">{typeof role === 'string' ? role.replace(/_/g, ' ') : ''}</option>)}
                </select>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                {filteredLogs.length > 0 ? (
                    <div className="divide-y divide-gray-700">
                        {filteredLogs.map(log => {
                            const moduleInfo = getModuleFromAction(log.action);
                            return (
                                <div key={log.id} className="p-4 hover:bg-gray-700/50 transition-colors flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        <UserAvatar name={log.userName} className="w-10 h-10 rounded-full" />
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-white">{log.userName}</p>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${moduleInfo.color}`}>
                                                    {moduleInfo.name}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 whitespace-nowrap">{timeSince(log.timestamp)}</span>
                                        </div>
                                        <p className="text-sm text-gray-300 font-medium">{log.action.replace(/_/g, ' ')}</p>
                                        {log.details && Object.keys(log.details).length > 0 && (
                                            <p className="text-xs text-gray-500 mt-1 truncate max-w-xl">
                                                {JSON.stringify(log.details).replace(/[{}"]/g, '').replace(/:/g, ': ').replace(/,/g, ', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        No activity logs found for the current filters.
                    </div>
                )}
            </div>
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
    const [unebLogoSettings, setUnebLogoSettings] = useState<UnebLogoSettings>({ url: '', size: 48 });

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
        setUnebLogoSettings(getUnebLogoSettings());
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
    
    // --- Handlers (Memoized with useCallback) ---
    const handleSchoolFormSubmit = useCallback((e: React.FormEvent) => {
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
    }, [newSchoolName, newSchoolAddress, newSchoolModules, refreshData]);
    
    const handleSchoolEdit = useCallback((school: School) => {
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
    }, [adminUsers]);

    const handleSchoolEditSubmit = useCallback(() => {
        clearMessages();
        try {
            const currentSchool = schools.find(s => s.id === schoolForm.id);
            if (!currentSchool) throw new Error("Could not find school to update.");
    
            const selectedAssignableIds = new Set(schoolForm.modules);
            const existingAssignments = currentSchool.modules || [];
            const finalAssignmentsMap = new Map<string, { moduleId: string; status: 'assigned' | 'active' | 'published' }>();
    
            for (const module of modules) {
                const existingAssignment = existingAssignments.find(m => m.moduleId === module.id);
                if (module.isAssignable) {
                    if (selectedAssignableIds.has(module.id)) {
                        const status = existingAssignment ? existingAssignment.status : 'assigned';
                        finalAssignmentsMap.set(module.id, { moduleId: module.id, status });
                    }
                } else {
                    if (existingAssignment) {
                        finalAssignmentsMap.set(module.id, existingAssignment);
                    }
                }
            }
    
            const updatedSchoolData: Omit<School, 'id'> = {
                name: schoolForm.name,
                address: schoolForm.address,
                modules: Array.from(finalAssignmentsMap.values()),
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
    }, [schoolForm, schools, modules, refreshData]);

    const handleSchoolDelete = useCallback((schoolId: string, schoolName: string) => {
        setModal({ type: 'deleteSchool', data: { schoolId, schoolName } });
    }, []);

    const confirmSchoolDelete = useCallback((schoolId: string) => {
        clearMessages();
        try {
            deleteSchool(schoolId);
            setSuccess('School deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [refreshData]);

    const handleUserFormSubmit = useCallback((e: React.FormEvent) => {
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
    }, [userForm, refreshData]);

    const handleUserEdit = useCallback((userToEdit: AdminUser) => {
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
    }, []);
    
    const handleUserEditSubmit = useCallback(() => {
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
    }, [userForm, adminUsers, refreshData]);
    
    const handleUserDelete = useCallback((userId: string, userName: string) => {
        setModal({ type: 'deleteUser', data: { userId, userName }});
    }, []);
    
    const confirmUserDelete = useCallback((userId: string) => {
        clearMessages();
        try {
            deleteAdminUser(userId);
            setSuccess('User deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [refreshData]);

    const handleResetPassword = useCallback((userToReset: AdminUser) => {
        setPassword('');
        setUserForm({ id: userToReset.id, name: userToReset.name, email: userToReset.email, role: userToReset.role, assignedSchoolId: userToReset.assignedSchoolIds[0] || '', password: '', confirmPassword: '' });
        setModal({ type: 'resetPassword', data: userToReset });
    }, []);
    
    const confirmResetPassword = useCallback(() => {
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
            resetAdminUserPassword(userForm.id, password);
            setSuccess(`Password for ${userForm.name} has been reset.`);
            setModal(null);
            setPassword('');
        } catch (err) {
            setError((err as Error).message);
        }
    }, [adminUsers, userForm, password]);
    
    const handleModuleDelete = useCallback((moduleId: string, moduleName: string) => {
        setModal({ type: 'deleteModule', data: { moduleId, moduleName }});
    }, []);

    const confirmModuleDelete = useCallback((moduleId: string) => {
        clearMessages();
        try {
            deleteModule(moduleId);
            setSuccess('Module deleted successfully.');
            setModal(null);
            refreshData();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [refreshData]);

    const handleModuleToggleAssignable = useCallback((moduleId: string) => {
        clearMessages();
        try {
            toggleModuleAssignability(moduleId);
            refreshData();
        } catch(err) {
            setError((err as Error).message);
        }
    }, [refreshData]);
    
    const handleAnnouncement = useCallback(() => {
        setModal({ type: 'announcement' });
    }, []);

    const handleAnnouncementSubmit = useCallback(() => {
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
    }, [students, announcementForm]);
    
    const handleUnebSettingsSave = useCallback(() => {
        setUnebServiceFeeAmount(unebServiceFee);
        setUnebVerificationEnabled(unebVerification);
        saveUnebLogoSettings(unebLogoSettings);
        setSuccess("UNEB settings saved successfully.");
    }, [unebServiceFee, unebVerification, unebLogoSettings]);

    const availableHeadteachers = useMemo(() => {
        const schoolBeingEditedId = modal?.type === 'editSchool' ? (modal.data as School).id : null;
        return adminUsers.filter(user => 
            user.role === 'headteacher' && 
            (user.assignedSchoolIds.length === 0 || (schoolBeingEditedId && user.assignedSchoolIds.includes(schoolBeingEditedId)))
        );
    }, [adminUsers, modal]);

    const renderMainContent = useCallback(() => {
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
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Official Logo URL</label>
                                <input value={unebLogoSettings.url} onChange={e => setUnebLogoSettings(prev => ({ ...prev, url: e.target.value }))} className="w-full px-3 py-2 bg-gray-700 rounded-md"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Logo Size (pixels)</label>
                                <input type="number" value={unebLogoSettings.size} onChange={e => setUnebLogoSettings(prev => ({...prev, size: parseInt(e.target.value, 10)}))} className="w-full px-3 py-2 bg-gray-700 rounded-md"/>
                            </div>
                            <button onClick={handleUnebSettingsSave} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Settings</button>
                        </div>
                    </div>
                );
            case 'nche_management':
                return <NcheAdminView />;
            case 'exploration_manager':
                return <ExplorationModuleManager />;
            case 'system_report':
                return <SystemReportView schools={schools} modules={modules} />;
            case 'live_activity':
                return <LiveActivityView />;
            case 'school_directory':
                return <SchoolDirectory />;
            default: return null;
        }
    }, [view, students, schools, adminUsers, modules, error, success, activeSchoolView, newSchoolName, newSchoolAddress, newSchoolModules, userForm, password, isEmailValidationEnabled, announcementForm, unebServiceFee, unebVerification, unebLogoSettings, handleSchoolFormSubmit, handleSchoolDelete, handleSchoolEdit, handleUserFormSubmit, handleUserDelete, handleUserEdit, handleResetPassword, handleModuleDelete, handleModuleToggleAssignable, handleAnnouncement, handleUnebSettingsSave]);

    const navLinks = useMemo(() => [
        { name: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard' },
        { name: 'Manage Students', icon: <StudentsIcon />, view: 'students' },
        { name: 'Manage Schools', icon: <SchoolsIcon />, view: 'schools' },
        { name: 'Manage Users', icon: <UsersIcon />, view: 'users' },
        { name: 'Manage Modules', icon: <ModulesIcon />, view: 'modules' },
        { name: 'System Reports', icon: <ReportIcon />, view: 'system_report' },
        { name: 'Live Activity', icon: <ActivityIcon />, view: 'live_activity' },
        { name: 'Announcements', icon: <AnnounceIcon />, view: 'announcements' },
        { name: 'E-Wallet', icon: <WalletIcon />, view: 'wallet' },
        { name: 'UNEB Settings', icon: <UnebIcon />, view: 'uneb_settings' },
        { name: 'NCHE Management', icon: <NcheIcon />, view: 'nche_management' },
        { name: 'School Directory', icon: <DirectoryIcon/>, view: 'school_directory' },
    ], []);
    
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
                                className={`w-full flex items-center space-x-4 p-3 rounded-lg transition-colors ${view === link.view ? 'bg-cyan-600 hover:bg-cyan-500' : 'hover:bg-gray-700'}`}>
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
                        <NotificationBell userId={user.id} />
                         <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"/>
                            <div>
                                <p className="font-semibold">{currentUser.name}</p>
                                <p className="text-sm text-gray-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <button onClick={onLogout} className="p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
            
            {/* All modals are rendered here... */}
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

            {/* School Editor Modal */}
            {modal?.type === 'editSchool' && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4 text-white">Edit School: {modal.data.name}</h3>
                        <form onSubmit={e => { e.preventDefault(); handleSchoolEditSubmit(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">School Name</label>
                                <input value={schoolForm.name} onChange={e => setSchoolForm({...schoolForm, name: e.target.value})} required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                                <input value={schoolForm.address} onChange={e => setSchoolForm({...schoolForm, address: e.target.value})} required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
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
                                    className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {availableHeadteachers.map(ht => (
                                        <option key={ht.id} value={ht.id}>{ht.name} ({ht.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-4 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* User Editor Modal */}
            {modal?.type === 'editUser' && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4 text-white">Edit User: {modal.data.name}</h3>
                        <form onSubmit={e => { e.preventDefault(); handleUserEditSubmit(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                                <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                                <input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required type="email" className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="headteacher">Headteacher</option>
                                    <option value="uneb_admin">UNEB Admin</option>
                                    <option value="nche_admin">NCHE Admin</option>
                                </select>
                            </div>
                             {userForm.role === 'headteacher' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Assigned School</label>
                                    <select value={userForm.assignedSchoolId} onChange={e => setUserForm({...userForm, assignedSchoolId: e.target.value})} className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                        <option value="">-- Unassigned --</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                             <div className="flex justify-end space-x-4 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Announcement Modal */}
            {modal?.type === 'announcement' && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4 text-white">New Announcement</h3>
                        <form onSubmit={e => { e.preventDefault(); handleAnnouncementSubmit(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                                <input value={announcementForm.title} onChange={e => setAnnouncementForm({...announcementForm, title: e.target.value})} required className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                                <textarea value={announcementForm.message} onChange={e => setAnnouncementForm({...announcementForm, message: e.target.value})} required rows={4} className="w-full px-4 py-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                             <div className="flex justify-end space-x-4 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">Send</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={['deleteSchool', 'deleteUser', 'deleteModule', 'resetPassword'].includes(modal?.type || '')}
                title={modal?.type === 'deleteSchool' ? 'Delete School' : modal?.type === 'deleteUser' ? 'Delete User' : modal?.type === 'deleteModule' ? 'Delete Module' : 'Reset Password'}
                message={
                    modal?.type === 'deleteSchool' ? `Are you sure you want to delete ${modal.data.schoolName}? This will remove all associated data.` :
                    modal?.type === 'deleteUser' ? `Are you sure you want to delete ${modal.data.userName}?` :
                    modal?.type === 'deleteModule' ? `Are you sure you want to delete ${modal.data.moduleName}? This will remove it from all schools.` :
                    `Are you sure you want to reset the password for ${userForm.name}?`
                }
                onConfirm={() => {
                    if (modal?.type === 'deleteSchool') confirmSchoolDelete(modal.data.schoolId);
                    else if (modal?.type === 'deleteUser') confirmUserDelete(modal.data.userId);
                    else if (modal?.type === 'deleteModule') confirmModuleDelete(modal.data.moduleId);
                    else if (modal?.type === 'resetPassword') confirmResetPassword();
                }}
                onCancel={() => setModal(null)}
                confirmButtonVariant={modal?.type === 'resetPassword' ? 'primary' : 'danger'}
                confirmText={modal?.type === 'resetPassword' ? 'Reset' : 'Delete'}
            />
        </div>
    );
};
