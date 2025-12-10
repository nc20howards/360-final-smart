
// components/AdminPage.tsx (Complete File)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: Added UnebResultEntry to imports for use in the new UNEB admin components.
import { AdminUser, School, Module, User as SchoolUser, AuditLogEntry, UnebPassSlip, UnebStats, CustomIdTemplate, SchoolUserRole, ExtractedUnebSlipData, AdmissionSettings, CompletedAdmission, PinResetRequest, SchoolClass, SmartIDSettings, CustomIdField, IpWhitelistSettings, StudentTransferProposal, TransferNegotiation, SchoolALevelCombination, UnebSubjectResult, KioskLogEntry, StagedMarketplaceOrder, StagedTransferPayment, UnebLogoSettings, HigherEducationInstitution, Program } from '../types';
import { getAllSchools, activateModuleForSchool, deactivateModuleForSchool, publishModuleForSchool, unpublishModuleForSchool, publishHomePage, unpublishHomePage, updateModuleRolesForSchool } from '../services/schoolService';
import { getAllModules, HOME_PAGE_MODULE_NAME, SMART_ADMISSION_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, STUDENT_TRANSFER_MODULE_NAME, MESSAGE_MODULE_NAME, EXPLORATION_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME, VISITOR_CENTER_MODULE_NAME, KIOSK_MODE_MODULE_NAME } from '../services/moduleService';
import * as studentService from '../services/studentService';
import { extractTextFromImageWithGoogle } from '../services/apiService';
import { addResults as addUnebResults, findResultByIndex, getUnebStats } from '../services/unebResultService';
import StatCard from './StatCard';
import HomePageEditor from './HomePageEditor';
import NotificationBell from './NotificationBell';
import { APP_TITLE, GRADE_OPTIONS, GENDER_OPTIONS } from '../constants';
import SocialHubPage from './SocialHubPage';
import { logAction, getAllLogs } from '../services/auditLogService';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import * as settingsService from '../services/settingsService';
import EWalletPage from './EWalletPage';
import * as systemSettingsService from '../services/systemSettingsService';
import ProfilePage from './ProfilePage';
import * as userService from '../services/userService';
import { heartbeat } from '../services/presenceService';
import OnlineFeedPage from './OnlineFeedPage';
import * as classService from '../services/classService';
import * as smartIdService from '../services/smartIdService';
import { SmartIdCard, SmartIdCardBack, SmartIdCardFront } from './SmartIdCard';
import IdCardDesigner from './IdCardDesigner';
import ECanteenManagementPage from './ECanteenManagementPage';
import * as customIdTemplateService from '../services/customIdTemplateService';
import CustomSmartIdCard, { CustomSmartIdCardDownloadable } from './CustomSmartIdCard';
import HeadteacherNcheView from './HeadteacherNcheView';
import NcheAdminPage from './NcheAdminPage';
import UserAvatar from './UserAvatar';
import StudentTransferMarketplace from './StudentTransferMarketplace';
import ConfirmationModal from './ConfirmationModal';
import ExplorationPage from './ExplorationPage';
import { createBroadcastNotification } from '../services/notificationService';
import EVoteAdminPage from './EVoteAdminPage';
import { TeacherPage } from './TeacherPage';
import { getUnebOfficialLogo } from '../services/systemSettingsService';
import MyInstituteAdminPage from './MyInstituteAdminPage';
import VisitorCenterPage from './VisitorCenterPage';
import * as kioskService from '../services/kioskService';
import * as marketplaceService from '../services/marketplaceService';
import * as eWalletService from '../services/eWalletService';
import * as ncheService from '../services/ncheService';
import ExplorationModuleManager from './ExplorationModuleManager';
import SchoolDirectory from './SchoolDirectory';

// --- TYPE DEFINITIONS for Smart Admission ---
type KioskView = 'main' | 'index' | 'scan';

const getAdmissionGrade = (admission: CompletedAdmission): string | null => {
    const data = admission.data;
    if ('overallResult' in data) return data.overallResult;
    if ('result' in data) return data.result || null;
    return null;
};

const normalizeGrade = (grade: string | null | undefined): string => {
    if (!grade) return 'UNKNOWN';
    const upperGrade = grade.trim().toUpperCase();

    if (
        upperGrade.includes('FIRST') ||
        upperGrade.includes('GRADE ONE') ||
        upperGrade.includes('DIVISION ONE') ||
        upperGrade.includes('DIVISION 1') ||
        ['1', 'I', 'D1'].includes(upperGrade)
    ) {
        return 'FIRST GRADE';
    }

    if (
        upperGrade.includes('SECOND') ||
        upperGrade.includes('GRADE TWO') ||
        upperGrade.includes('DIVISION TWO') ||
        upperGrade.includes('DIVISION 2') ||
        ['2', 'II', 'D2'].includes(upperGrade)
    ) {
        return 'SECOND GRADE';
    }

    if (
        upperGrade.includes('THIRD') ||
        upperGrade.includes('GRADE THREE') ||
        upperGrade.includes('DIVISION THREE') ||
        upperGrade.includes('DIVISION 3') ||
        ['3', 'III', 'D3'].includes(upperGrade)
    ) {
        return 'THIRD GRADE';
    }

    if (
        upperGrade.includes('FOURTH') ||
        upperGrade.includes('GRADE FOUR') ||
        upperGrade.includes('DIVISION FOUR') ||
        upperGrade.includes('DIVISION 4') ||
        ['4', 'IV', 'D4'].includes(upperGrade)
    ) {
        return 'FOURTH GRADE';
    }

    if (
        upperGrade.includes('FAIL') ||
        upperGrade.includes('GRADE 0') ||
        upperGrade.includes('DIVISION X') ||
        ['0', 'F', 'X', 'D X'].includes(upperGrade)
    ) {
        return 'FAILED';
    }

    return 'UNKNOWN';
};

// --- SVG Icons ---
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>);
const UnebIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M15 13.129l-5 2.857-5-2.857V9.32l5 2.857 5-2.857v3.81z" /></svg>);
const EWalletIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>);
const ModulesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zM5 3a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H5z" /><path d="M15 4a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2zM15 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2h-2zM5 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 00-1-1H5zM5 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2H5zM15 14a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 00-1-1h-2zM15 13a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2h-2z" /></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>);
const ActiveModulesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v.25h.5a.75.75 0 010 1.5h-.5v.25a.75.75 0 01-1.5 0v-.25h-.5a.75.75 0 010-1.5h.5v-.25A.75.75 0 0110 2zM5.013 4.3a.75.75 0 01.53 1.28l-.213.213a.75.75 0 01-1.06 0l-.213-.213a.75.75 0 01.53-1.28zM14.987 4.3a.75.75 0 01.53 1.28l-.213.213a.75.75 0 01-1.06 0l-.213-.213a.75.75 0 01.53-1.28zM17 10a.75.75 0 01.25.75v.5a.75.75 0 01-1.5 0v-.5a.75.75 0 011.25-.664V10zM3 10a.75.75 0 01.25.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 013 10zm11.987 5.7a.75.75 0 01.53-1.28l.213.213a.75.75 0 010 1.06l-.213.213a.75.75 0 01-.53-1.28zM5.013 15.7a.75.75 0 01.53-1.28l.213.213a.75.75 0 010 1.06l-.213.213a.75.75 0 01-.53-1.28zM10 17a.75.75 0 01.75.75v.25h.5a.75.75 0 010 1.5h-.5v.25a.75.75 0 01-1.5 0v-.25h-.5a.75.75 0 010-1.5h.5v-.25A.75.75 0 0110 17zM8 10a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" /></svg>);
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (<svg className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const HamburgerIcon = () => (<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg className="w-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const HomePageIcon = () => (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>);
const SmartAdmissionIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M15 13.129l-5 2.857-5-2.857V9.32l5 2.857 5-2.857v3.81z" /></svg>);
const MessageIcon = () => (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>);
const OnlineIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.522-1.522l.836.836a.75.75 0 001.06 0l1.414-1.414a.75.75 0 000-1.06l-.836-.836A7.5 7.5 0 002 10a7.5 7.5 0 004.027 6.668l.836-.836a.75.75 0 000-1.06l-1.414-1.414a.75.75 0 00-1.06 0l-.836.836a6.012 6.012 0 01-1.522-1.522zm11.336 0a6.012 6.012 0 01-1.522 1.522l-.836-.836a.75.75 0 00-1.06 0L11.25 10.5l-1.06-1.06a.75.75 0 00-1.06 0l-.836.836a6.012 6.012 0 01-1.522-1.522l.836-.836a.75.75 0 000-1.06L5.5 4.332a.75.75 0 00-1.06 0l-.836.836A7.5 7.5 0 0010 2.5a7.5 7.5 0 006.668 4.027l-.836.836a.75.75 0 00-1.06 0l-1.414 1.414a.75.75 0 000 1.06l.836.836z" clipRule="evenodd" /></svg>);
const VerifiedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const IdCardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H3zm3 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm-1 4a1 1 0 100 2h.01a1 1 0 100-2H5zm3 0a1 1 0 100 2h6a1 1 0 100-2H8zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H5zm3 0a1 1 0 100 2h6a1 1 0 100-2H8z" clipRule="evenodd" /></svg>;
const CanteenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.5A1.5 1.5 0 013.5 3h1.53a1.5 1.5 0 011.42 1.049l.343.857a.5.5 0 00.47.344h4.474a.5.5 0 00.47-.344l.343-.857A1.5 1.5 0 0113.97 3H15.5A1.5 1.5 0 0117 4.5V5h-.5a.5.5 0 000 1h.5v1.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 7.5V5h.5a.5.5 0 000-1H2V4.5zM3.5 4a.5.5 0 00-.5.5V5h13V4.5a.5.5 0 00-.5-.5h-1.03a.5.5 0 00-.47.349l-.344.856a1.5 1.5 0 01-1.42 1.045H7.234a1.5 1.5 0 01-1.42-1.045l-.343-.856A.5.5 0 005.03 4H3.5zM2 12v3.5A1.5 1.5 0 003.5 17h13a1.5 1.5 0 001.5-1.5V12h-16zm1.5.5a.5.5 0 01.5-.5h12a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-12a.5.5 0 01-.5-.5v-3z"/></svg>;
const SecurityIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5.002L2 15.854A2 2 0 004 17.854h12a2 2 0 002-2V5.002A11.954 11.954 0 0110 1.944zM10 11a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /><path d="M10 12a5 5 0 00-5 5v1h10v-1a5 5 0 00-5-5z" clipRule="evenodd" /></svg>);
const NcheAdminIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5 8.281V13.5a1 1 0 001 1h8a1 1 0 001-1V8.281l2.394-1.36a1 1 0 000-1.84l-7-3zM6 9.319l4 2.286 4-2.286V13.5H6V9.319z" /><path d="M6 13.5V15l4 2.286L14 15v-1.5H6z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const ResultsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);
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


const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
        case HOME_PAGE_MODULE_NAME:
            return <HomePageIcon />;
        case SMART_ADMISSION_MODULE_NAME:
            return <SmartAdmissionIcon />;
        case E_WALLET_MODULE_NAME:
            return <EWalletIcon />;
        case SMART_STUDENT_ID_MODULE_NAME:
            return <IdCardIcon />;
        case E_CANTEEN_MODULE_NAME:
            return <CanteenIcon />;
        case NCHE_MODULE_NAME:
            return <NcheAdminIcon />;
        case STUDENT_TRANSFER_MODULE_NAME:
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8z" /><path d="M12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" /></svg>;
        case MY_INSTITUTE_MODULE_NAME:
            return <CheckIcon />;
        default:
            return <ModulesIcon />;
    }
};

const moduleNameToViewMap: Record<string, string> = {
    [HOME_PAGE_MODULE_NAME]: 'homepage',
    [SMART_ADMISSION_MODULE_NAME]: 'smart_admission',
    [E_WALLET_MODULE_NAME]: 'e_wallet',
    [SMART_STUDENT_ID_MODULE_NAME]: 'smart_id',
    [E_CANTEEN_MODULE_NAME]: 'e_canteen',
    [NCHE_MODULE_NAME]: 'nche',
    [STUDENT_TRANSFER_MODULE_NAME]: 'transfer_market',
    [MESSAGE_MODULE_NAME]: 'messages',
    [ONLINE_MODULE_NAME]: 'online_feed',
    [EXPLORATION_MODULE_NAME]: 'exploration',
    [E_VOTE_MODULE_NAME]: 'e_vote',
    [MY_INSTITUTE_MODULE_NAME]: 'my_institute',
    [VISITOR_CENTER_MODULE_NAME]: 'visitor_center',
    [KIOSK_MODE_MODULE_NAME]: 'kiosk_management',
};


const SecurityManagement: React.FC = () => {
    const [settings, setSettings] = useState<IpWhitelistSettings>(() => systemSettingsService.getIpWhitelistSettings());
    
    const handleSave = () => {
        systemSettingsService.saveIpWhitelistSettings(settings);
        alert('Settings saved!');
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Security Settings</h3>
            <div className="space-y-4">
                <div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" checked={settings.enabled} onChange={e => setSettings(s => ({...s, enabled: e.target.checked}))} className="form-checkbox h-5 w-5 text-cyan-600"/>
                        <span>Enable IP Whitelisting</span>
                    </label>
                    <p className="text-sm text-gray-400 mt-1 pl-8">Restrict login access to specified IP addresses.</p>
                </div>
                 {settings.enabled && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Allowed IP Addresses (one per line)</label>
                        <textarea
                            value={settings.allowedIps.join('\n')}
                            onChange={e => setSettings(s => ({...s, allowedIps: e.target.value.split('\n').map(ip => ip.trim()).filter(Boolean)}))}
                            rows={5}
                            className="w-full p-2 bg-gray-700 rounded-md"
                        />
                    </div>
                )}
                <button onClick={handleSave} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Settings</button>
            </div>
        </div>
    );
};


// FIX: Added missing component definitions for Headteacher views.
interface ModulesManagementProps {
    school: School;
    allModules: Module[];
    onActivate: (schoolId: string, moduleId: string) => void;
    onDeactivate: (schoolId: string, moduleId: string) => void;
    onPublish: (schoolId: string, moduleId: string) => void;
    onUnpublish: (schoolId: string, moduleId: string) => void;
    onHomePagePublish: (schoolId: string) => void;
    onHomePageUnpublish: (schoolId: string) => void;
    onUpdateRoles?: (schoolId: string, moduleId: string, roles: SchoolUserRole[]) => void;
}
const ModulesManagement: React.FC<ModulesManagementProps> = ({
    school,
    allModules,
    onActivate,
    onDeactivate,
    onPublish,
    onUnpublish,
    onHomePagePublish,
    onHomePageUnpublish,
    onUpdateRoles
}) => {
    const homePageModule = allModules.find(m => m.name === HOME_PAGE_MODULE_NAME);
    const [expandedRoleSettings, setExpandedRoleSettings] = useState<string | null>(null);

    const availableRoles: { value: SchoolUserRole; label: string }[] = [
        { value: 'student', label: 'Student' },
        { value: 'teacher', label: 'Teacher' },
        { value: 'admin', label: 'School Admin' },
        { value: 'admission_agent', label: 'Admission Agent' },
        { value: 'parent', label: 'Parent' },
        { value: 'head_of_department', label: 'Head of Dept.' },
        { value: 'deputy_headteacher', label: 'Deputy Headteacher' },
        { value: 'canteen_seller', label: 'Canteen Seller' },
        { value: 'carrier', label: 'Carrier' },
        { value: 'old_student', label: 'Old Student' },
    ];

    const toggleRole = (moduleId: string, role: SchoolUserRole, currentRoles: SchoolUserRole[]) => {
        if (!onUpdateRoles) return;
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        onUpdateRoles(school.id, moduleId, newRoles);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Manage Modules for {school.name}</h3>
            
            {homePageModule && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-xl font-bold">{homePageModule.name}</h4>
                            <p className="text-sm text-gray-400">{homePageModule.description}</p>
                        </div>
                        <div>
                            {school.isHomePagePublished ? (
                                <button onClick={() => onHomePageUnpublish(school.id)} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md font-semibold">Unpublish</button>
                            ) : (
                                <button onClick={() => onHomePagePublish(school.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold">Publish</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allModules.filter(m => m.isAssignable).map(module => {
                    const assignment = school.modules.find(assignmentRecord => assignmentRecord.moduleId === module.id);
                    const status = assignment?.status || 'unassigned';
                    // Default to student if undefined, maintaining backward compatibility
                    const currentAllowedRoles = assignment?.allowedRoles || ['student'];
                    const isExpanded = expandedRoleSettings === module.id;

                    return (
                        <div key={module.id} className="bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col h-full">
                            <div className="flex-grow">
                                <h4 className="text-xl font-bold">{module.name}</h4>
                                <p className="text-sm text-gray-400 mt-1 mb-4 h-16">{module.description}</p>
                            </div>
                            
                            <div className="border-t border-gray-700 pt-4 mt-auto">
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`capitalize px-3 py-1 text-sm font-semibold rounded-full ${
                                        status === 'published' ? 'bg-cyan-500/20 text-cyan-300' :
                                        status === 'active' ? 'bg-green-500/20 text-green-300' :
                                        status === 'unassigned' ? 'bg-gray-500/20 text-gray-400' :
                                        'bg-yellow-500/20 text-yellow-300'
                                    }`}>
                                        {status}
                                    </span>
                                    
                                    <div className="flex space-x-2">
                                        {status === 'unassigned' || status === 'assigned' ? (
                                            <button onClick={() => onActivate(school.id, module.id)} className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-700 transition-colors">Activate</button>
                                        ) : (
                                            <button onClick={() => onDeactivate(school.id, module.id)} className="px-3 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500 transition-colors">Deactivate</button>
                                        )}
                                        {status === 'active' && (
                                            <button onClick={() => onPublish(school.id, module.id)} className="px-3 py-1 bg-cyan-600 rounded text-sm hover:bg-cyan-700 transition-colors">Publish</button>
                                        )}
                                         {status === 'published' && (
                                            <button onClick={() => onUnpublish(school.id, module.id)} className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-700 transition-colors">Unpublish</button>
                                        )}
                                    </div>
                                </div>

                                {status === 'published' && (
                                    <div className="mt-2">
                                        <button 
                                            onClick={() => setExpandedRoleSettings(isExpanded ? null : module.id)}
                                            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors w-full justify-end mb-2"
                                        >
                                            <span>Manage Access ({currentAllowedRoles.length})</span>
                                            <ChevronIcon isOpen={isExpanded} />
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="bg-gray-900/50 p-3 rounded-md animate-fade-in-up">
                                                <p className="text-xs font-semibold text-gray-400 mb-2">Allowed Roles:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {availableRoles.map(role => (
                                                        <label key={role.value} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-700/50 rounded">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={currentAllowedRoles.includes(role.value)}
                                                                onChange={() => toggleRole(module.id, role.value, currentAllowedRoles)}
                                                                className="form-checkbox h-3 w-3 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                                                            />
                                                            <span className="text-xs text-gray-300">{role.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// FIX: Added missing component definitions for Headteacher views.
interface HeadteacherDashboardViewProps {
    school: School;
    students: SchoolUser[];
    activeModules: Module[];
}
const HeadteacherDashboardView: React.FC<HeadteacherDashboardViewProps> = ({ school, students, activeModules }) => (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Welcome, Headteacher of {school.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Total Students" value={students.length} icon={<UsersIcon />} colorClassName="bg-cyan-500" />
            <StatCard title="Active Modules" value={activeModules.length} icon={<ActiveModulesIcon />} colorClassName="bg-indigo-500" />
        </div>
    </div>
);

interface UsersManagementProps {
    school: School;
    students: SchoolUser[];
    classes: SchoolClass[];
    refreshData: () => void;
    onResetPassword: (user: SchoolUser) => void;
}

const UsersManagement: React.FC<UsersManagementProps> = ({ school, students, classes, refreshData, onResetPassword }) => {
    const [activeTab, setActiveTab] = useState<'view' | 'add' | 'manage_classes'>('view');
    const [addMethod, setAddMethod] = useState<'single' | 'bulk'>('single');
    
    // Filters
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterClass, setFilterClass] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Single Add Form
    const initialUserForm = {
        name: '',
        studentId: '', // User ID (Student ID or Staff ID)
        role: 'student' as SchoolUserRole,
        class: '',
        stream: '',
        gender: 'Male' as 'Male' | 'Female',
        password: 'password123' // Default initial password
    };
    const [newUser, setNewUser] = useState(initialUserForm);
    
    // Bulk Upload
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Editing/Deleting
    const [editingUser, setEditingUser] = useState<SchoolUser | null>(null);
    const [userToDelete, setUserToDelete] = useState<SchoolUser | null>(null);
    
    // Feedback
    const [feedback, setFeedback] = useState<{type: 'success'|'error', message: React.ReactNode} | null>(null);

    // Class & Stream Management
    const [classToManage, setClassToManage] = useState<SchoolClass | null>(null);
    const [streamForm, setStreamForm] = useState({ id: '', name: '' });
    const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);

    const showFeedback = (message: React.ReactNode, type: 'success' | 'error' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 5000);
    };

    const filteredUsers = useMemo(() => {
        return students.filter(u => {
            const roleMatch = filterRole === 'all' || u.role === filterRole;
            const classMatch = filterClass === 'all' || u.class === filterClass;
            const searchMatch = !searchTerm || 
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                u.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            return roleMatch && classMatch && searchMatch;
        });
    }, [students, filterRole, filterClass, searchTerm]);

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newUser.name || !newUser.studentId) throw new Error("Name and ID are required.");
            if (newUser.role === 'student' && !newUser.class) throw new Error("Class is required for students.");

            studentService.createSchoolUser({
                ...newUser,
                schoolId: school.id,
                // Only include class/stream if role is student, otherwise undefined
                class: newUser.role === 'student' ? newUser.class : undefined,
                stream: newUser.role === 'student' ? newUser.stream : undefined,
                mustChangePassword: true,
            });
            
            showFeedback(`User ${newUser.name} created successfully.`);
            setNewUser(initialUserForm);
            refreshData();
        } catch (err) {
            showFeedback((err as Error).message, 'error');
        }
    };

    const handleBulkUpload = () => {
        if (!csvFile) {
            showFeedback("Please select a CSV file first.", 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvText = event.target?.result as string;
            try {
                const result = await studentService.createBulkSchoolUsers([], school.id, newUser.class, csvText);
                if (result.errorCount > 0) {
                    showFeedback(
                        <div>
                            <p>Uploaded with {result.errorCount} errors.</p>
                            <ul className="list-disc pl-4 text-xs mt-1">{result.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}</ul>
                        </div>, 
                        'error'
                    );
                } else {
                    showFeedback(`Successfully added ${result.successCount} users.`);
                }
                refreshData();
                setCsvFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } catch (err) {
                showFeedback((err as Error).message, 'error');
            }
        };
        reader.readAsText(csvFile);
    };
    

    const handleUpdateUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        try {
            studentService.updateSchoolUser(editingUser.studentId, editingUser);
            showFeedback("User updated successfully.");
            setEditingUser(null);
            refreshData();
        } catch (err) {
            showFeedback((err as Error).message, 'error');
        }
    };

    const handleDeleteUser = () => {
        if (!userToDelete) return;
        try {
            studentService.deleteSchoolUser(userToDelete.studentId);
            showFeedback("User deleted.");
            setUserToDelete(null);
            refreshData();
        } catch (err) {
            showFeedback((err as Error).message, 'error');
        }
    };

    const handleStreamAction = () => {
        if (!classToManage || !streamForm.name) return;
        try {
            if (streamForm.id) { // Editing
                classService.updateClassStream(classToManage.id, streamForm.id, streamForm.name);
                showFeedback('Stream updated.');
            } else { // Adding
                classService.addClassStream(classToManage.id, streamForm.name);
                showFeedback('Stream added.');
            }
            refreshData(); // This should update classes prop
            setClassToManage(prev => prev ? classService.getClassesForSchool(school.id).find(c => c.id === prev.id) || null : null);
            setStreamForm({ id: '', name: '' });
        } catch (err) {
            showFeedback((err as Error).message, 'error');
        }
    };

    const handleRemoveStream = (streamName: string) => {
        if (!classToManage) return;
        if (window.confirm(`Are you sure you want to delete the stream "${streamName}"? All students in this stream will have their stream unassigned.`)) {
            try {
                classService.removeClassStream(classToManage.id, streamName);
                showFeedback('Stream removed.');
                refreshData();
                setClassToManage(prev => prev ? classService.getClassesForSchool(school.id).find(c => c.id === prev.id) || null : null);
            } catch (err) {
                showFeedback((err as Error).message, 'error');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-white">User Management</h3>
                <div className="flex bg-gray-700 rounded-lg p-1">
                    <button onClick={() => setActiveTab('view')} className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'view' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>Directory</button>
                    <button onClick={() => setActiveTab('add')} className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'add' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>Add Users</button>
                    <button onClick={() => setActiveTab('manage_classes')} className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'manage_classes' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>Manage Classes & Streams</button>
                </div>
            </div>

            {feedback && (
                <div className={`p-4 rounded-lg ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {feedback.message}
                </div>
            )}

            {activeTab === 'view' && (
                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex flex-wrap gap-4">
                        <input 
                            placeholder="Search Name or ID..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-gray-700 text-white px-3 py-2 rounded-md">
                            <option value="all">All Roles</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">School Admin</option>
                            <option value="admission_agent">Admission Agent</option>
                            <option value="canteen_seller">Canteen Seller</option>
                            <option value="carrier">Carrier</option>
                            <option value="head_of_department">HOD</option>
                            <option value="deputy_headteacher">Deputy HT</option>
                            <option value="parent">Parent</option>
                            <option value="old_student">Old Student</option>
                        </select>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="bg-gray-700 text-white px-3 py-2 rounded-md">
                            <option value="all">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-gray-300">
                            <thead className="bg-gray-700 text-white uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">User</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Class/Stream</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                    <tr key={u.studentId} className="hover:bg-gray-700/50">
                                        <td className="px-6 py-4 flex items-center gap-3">
                                            <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="w-8 h-8 rounded-full" />
                                            <div>
                                                <div className="font-medium text-white">{u.name}</div>
                                                <div className="text-xs text-gray-500">{u.studentId}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 capitalize">{u.role.replace(/_/g, ' ')}</td>
                                        <td className="px-6 py-4">{u.class ? `${u.class} ${u.stream ? `(${u.stream})` : ''}` : '-'}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => setEditingUser(u)} className="text-cyan-400 hover:text-cyan-300 text-sm">Edit</button>
                                            <button onClick={() => onResetPassword(u)} className="text-yellow-400 hover:text-yellow-300 text-sm">Reset Pass</button>
                                            <button onClick={() => setUserToDelete(u)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No users found matching filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'add' && (
                <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-3xl mx-auto">
                    <div className="flex border-b border-gray-700 mb-6">
                        <button onClick={() => setAddMethod('single')} className={`px-4 py-2 border-b-2 font-medium ${addMethod === 'single' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Single Entry</button>
                        <button onClick={() => setAddMethod('bulk')} className={`px-4 py-2 border-b-2 font-medium ${addMethod === 'bulk' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Bulk Upload</button>
                    </div>

                    {addMethod === 'single' ? (
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Role</label>
                                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as SchoolUserRole, class: '', stream: ''})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500">
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">School Admin</option>
                                        <option value="admission_agent">Admission Agent</option>
                                        <option value="canteen_seller">Canteen Seller</option>
                                        <option value="carrier">Carrier</option>
                                        <option value="head_of_department">Head of Dept</option>
                                        <option value="deputy_headteacher">Deputy Headteacher</option>
                                        <option value="parent">Parent</option>
                                        <option value="old_student">Old Student</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                                    <input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500" required />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">User ID (Unique)</label>
                                    <input value={newUser.studentId} onChange={e => setNewUser({...newUser, studentId: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500" required placeholder="e.g. S001 or T-John" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Gender</label>
                                    <select value={newUser.gender} onChange={e => setNewUser({...newUser, gender: e.target.value as 'Male'|'Female'})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500">
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>

                            {newUser.role === 'student' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700 pt-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Class</label>
                                        <select value={newUser.class} onChange={e => setNewUser({...newUser, class: e.target.value, stream: ''})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500" required>
                                            <option value="">Select Class</option>
                                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Stream</label>
                                         <select value={newUser.stream} onChange={e => setNewUser({...newUser, stream: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500" disabled={!newUser.class || !classes.find(c => c.name === newUser.class)?.streams.length}>
                                            <option value="">Select Stream</option>
                                            {classes.find(c => c.name === newUser.class)?.streams.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                             <div className="pt-4">
                                <label className="block text-sm text-gray-400 mb-1">Initial Password</label>
                                <input value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500" required />
                            </div>
                            <div className="pt-4 flex justify-end">
                                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-md font-semibold">Create User</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <h4 className="font-bold text-cyan-400 mb-2">Instructions</h4>
                                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                                    <li>Prepare a CSV file with headers: <code className="bg-gray-800 px-1 rounded">name,studentId,role,password,stream</code> (stream is optional).</li>
                                    <li>Role must be one of the system roles (student, teacher, etc.).</li>
                                    <li>Use the template below to ensure correct formatting.</li>
                                </ol>
                                <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("name,studentId,role,password,stream\nJohn Doe,S100,student,pass123,East\nJane Smith,T001,teacher,securePass,")}`} download="users_template.csv" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">Download Template CSV</a>
                            </div>
                            
                             {/* Optional Class Selector for Bulk Student Upload */}
                             <div>
                                <label className="block text-sm text-gray-400 mb-1">Default Target Class (For Students)</label>
                                <select value={newUser.class} onChange={e => setNewUser({...newUser, class: e.target.value, stream: ''})} className="w-full bg-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-cyan-500">
                                    <option value="">None (or Mixed)</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">If selected, all 'student' roles in the CSV will be assigned to this class.</p>
                            </div>

                            <div className="flex items-center space-x-4">
                                <input type="file" accept=".csv" ref={fileInputRef} onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700"/>
                                <button onClick={handleBulkUpload} disabled={!csvFile} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Upload</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'manage_classes' && (
                <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                    <div className="space-y-4">
                        {classes.map(cls => (
                            <div key={cls.id} className="bg-gray-700 p-4 rounded-md flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-white">{cls.name}</h4>
                                    <p className="text-sm text-gray-400">{cls.streams.join(', ') || 'No streams defined'}</p>
                                </div>
                                <button onClick={() => { setClassToManage(cls); setIsStreamModalOpen(true); }} className="px-4 py-2 bg-cyan-600 text-sm font-semibold rounded-md">Manage Streams</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Edit Modal */}
            {editingUser && (
                 <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Edit User</h3>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Name</label>
                                <input value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white" required />
                            </div>
                             <div>
                                <label className="block text-sm text-gray-400 mb-1">Role</label>
                                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as SchoolUserRole, class: '', stream: ''})} className="w-full bg-gray-700 rounded p-2 text-white">
                                    <option value="student">Student</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="admin">School Admin</option>
                                    <option value="admission_agent">Admission Agent</option>
                                    <option value="canteen_seller">Canteen Seller</option>
                                    <option value="carrier">Carrier</option>
                                    <option value="head_of_department">HOD</option>
                                    <option value="deputy_headteacher">Deputy HT</option>
                                    <option value="parent">Parent</option>
                                    <option value="old_student">Old Student</option>
                                </select>
                            </div>
                            {editingUser.role === 'student' && (
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm text-gray-400 mb-1">Class</label>
                                        <select value={editingUser.class || ''} onChange={e => setEditingUser({...editingUser, class: e.target.value, stream: ''})} className="w-full bg-gray-700 rounded p-2 text-white">
                                            <option value="">Select Class</option>
                                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                     <div>
                                        <label className="block text-sm text-gray-400 mb-1">Stream</label>
                                        <select value={editingUser.stream || ''} onChange={e => setEditingUser({...editingUser, stream: e.target.value})} className="w-full bg-gray-700 rounded p-2 text-white" disabled={!editingUser.class || !classes.find(c => c.name === editingUser.class)?.streams.length}>
                                            <option value="">Select Stream</option>
                                            {classes.find(c => c.name === editingUser.class)?.streams.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end space-x-2 pt-4">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 bg-gray-600 rounded-md text-white hover:bg-gray-500">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-cyan-600 rounded-md text-white hover:bg-cyan-700">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmationModal
                isOpen={!!userToDelete}
                title="Delete User"
                message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
                onConfirm={handleDeleteUser}
                onCancel={() => setUserToDelete(null)}
                confirmButtonVariant="danger"
            />

            {/* Manage Streams Modal */}
            {isStreamModalOpen && classToManage && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Manage Streams for {classToManage.name}</h3>
                        <div className="space-y-2 mb-4">
                            {classToManage.streams.map(stream => (
                                <div key={stream} className="flex justify-between items-center p-2 bg-gray-700 rounded-md">
                                    <span>{stream}</span>
                                    <div className="space-x-2">
                                        <button onClick={() => { setStreamForm({ id: stream, name: stream }); }} className="text-xs text-cyan-400">Edit</button>
                                        <button onClick={() => handleRemoveStream(stream)} className="text-xs text-red-400">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input value={streamForm.name} onChange={e => setStreamForm({...streamForm, name: e.target.value})} placeholder={streamForm.id ? "New name..." : "Add new stream..."} className="w-full p-2 bg-gray-700 rounded-md" />
                            <button onClick={handleStreamAction} className="px-4 py-2 bg-cyan-600 rounded-md text-sm font-semibold">{streamForm.id ? 'Update' : 'Add'}</button>
                            {streamForm.id && <button onClick={() => setStreamForm({id: '', name: ''})} className="px-2 py-2 bg-gray-600 rounded-md text-sm">Cancel</button>}
                        </div>
                         <div className="text-right mt-4">
                            <button onClick={() => setIsStreamModalOpen(false)} className="px-4 py-2 bg-gray-600 rounded-md">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ApplicantDetailsView: React.FC<{ data: UnebPassSlip | ExtractedUnebSlipData }> = ({ data }) => {
    const isExtracted = 'candidateName' in data;
    const { url: unebLogoUrl, size: unebLogoSize } = systemSettingsService.getUnebLogoSettings();

    const displayData = {
        yearOfExamination: isExtracted ? data.yearOfExamination : data.year,
        examinationType: isExtracted ? data.examinationType : `UGANDA CERTIFICATE OF ${data.level.replace(/\./g, '')}`,
        slipSerialNumber: isExtracted ? data.slipSerialNumber : 'N/A',
        candidateName: isExtracted ? data.candidateName : data.name,
        schoolName: isExtracted ? data.schoolName : data.schoolName || 'N/A',
        centerNumber: isExtracted ? data.centerNumber : 'N/A',
        indexNumber: isExtracted ? data.indexNumber : data.indexNo,
        entryCode: isExtracted ? data.entryCode : data.entryCode || 'N/A',
        dateOfBirth: isExtracted ? data.dateOfBirth : data.dateOfBirth || 'N/A',
        schoolAddress: isExtracted ? data.schoolAddress : data.schoolAddress || 'N/A',
        subjects: isExtracted ? data.subjects : data.subjects.map(s => ({ subjectNumber: 'N/A', subjectName: s.name, gradeNumber: s.grade, gradeWord: 'N/A' })),
        gradeAggregate: isExtracted ? data.gradeAggregate : data.aggregate || 'N/A',
        overallResult: isExtracted ? data.overallResult : data.result || 'N/A',
        note: isExtracted ? data.note : 'N/A',
    };

    return (
        <div className="border-2 border-gray-600 p-4 rounded-lg bg-gray-900/50 font-mono text-sm text-white">
            <div className="text-center border-b-2 border-gray-600 pb-2 mb-4">
                <img 
                    src={unebLogoUrl} 
                    alt="UNEB Logo" 
                    className="mx-auto mb-2 rounded-full bg-white p-1"
                    style={{ width: `${unebLogoSize}px`, height: `${unebLogoSize}px` }}
                />
                <h4 className="font-bold text-lg text-white">{displayData.examinationType}</h4>
                <div className="flex justify-center gap-4">
                    <p>YEAR: {displayData.yearOfExamination}</p>
                    <p>S/N: {displayData.slipSerialNumber}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-4">
                <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">NAME:</span> {displayData.candidateName}</div>
                <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">SCHOOL:</span> {displayData.schoolName}</div>
                <div><span className="font-semibold text-white/70">CENTER:</span> {displayData.centerNumber}</div>
                <div><span className="font-semibold text-white/70">INDEX:</span> {displayData.indexNumber}</div>
                <div><span className="font-semibold text-white/70">ENTRY:</span> {displayData.entryCode}</div>
                <div><span className="font-semibold text-white/70">D.O.B:</span> {displayData.dateOfBirth}</div>
                <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">ADDRESS:</span> {displayData.schoolAddress}</div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-600 text-left min-w-[500px]">
                    <thead><tr className="bg-gray-700 text-white"><th className="p-2 border border-gray-600">NO.</th><th className="p-2 border border-gray-600">SUBJECT</th><th className="p-2 border border-gray-600 text-center">GRADE</th><th className="p-2 border border-gray-600">GRADE IN WORDS</th></tr></thead>
                    <tbody>{displayData.subjects.map((s, i) => <tr key={i}><td className="p-2 border border-gray-600">{s.subjectNumber}</td><td className="p-2 border border-gray-600">{s.subjectName}</td><td className="p-2 border border-gray-600 text-center">{s.gradeNumber}</td><td className="p-2 border border-gray-600">{s.gradeWord}</td></tr>)}</tbody>
                </table>
            </div>
            <div className="mt-4"><p><span className="font-semibold text-white/70">RESULT:</span> {displayData.overallResult}, <span className="font-semibold text-white/70">AGG:</span> {displayData.gradeAggregate}</p></div>
            <div className="border-t-2 border-gray-600 pt-2 mt-4"><p className="text-xs italic text-white/70">{displayData.note}</p></div>
        </div>
    );
};


interface AdmissionManagementProps {
    school: School;
    completedAdmissions: CompletedAdmission[];
    classes: SchoolClass[];
    refreshData: () => void;
}
const AdmissionManagement: React.FC<AdmissionManagementProps> = ({ school, completedAdmissions, classes, refreshData }) => {
    const [settings, setSettings] = useState<AdmissionSettings>(() => settingsService.getAdmissionSettings(school.id));
    const [feedback, setFeedback] = useState({ message: '', type: 'success' as 'success' | 'error' });
    
    // State for the main view
    const [activeTab, setActiveTab] = useState<'under_review' | 'approved' | 'rejected' | 'transferred'>('under_review');
    const [levelTab, setLevelTab] = useState<'O-Level' | 'A-Level'>('O-Level');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [aggregateFilter, setAggregateFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
    const [actionFeedback, setActionFeedback] = useState('');

    const oLevelClasses = useMemo(() => classes.filter(c => c.level === 'O-Level'), [classes]);
    const aLevelClasses = useMemo(() => classes.filter(c => c.level === 'A-Level'), [classes]);

    const [oLevelDropdownOpen, setOLevelDropdownOpen] = useState(false);
    const [aLevelDropdownOpen, setALevelDropdownOpen] = useState(false);
    const oLevelDropdownRef = useRef<HTMLDivElement>(null);
    const aLevelDropdownRef = useRef<HTMLDivElement>(null);

    const [newCombination, setNewCombination] = useState({ name: '', subjects: '', category: 'sciences' as 'arts' | 'sciences' });
    const [viewModalData, setViewModalData] = useState<CompletedAdmission | null>(null);

    const showActionFeedback = (message: string) => {
        setActionFeedback(message);
        setTimeout(() => setActionFeedback(''), 4000);
    };

    const handleApprove = (admissionId: string) => {
        try {
            settingsService.updateAdmissionStatus(admissionId, school.id, 'approved');
            const admission = completedAdmissions.find(a => a.id === admissionId);
            if (admission) {
                studentService.createSchoolUserFromAdmission(admission, school.id);
            }
            refreshData();
            showActionFeedback('Admission approved and student account created.');
        } catch (error) {
            showActionFeedback((error as Error).message);
        }
    };

    const handleReject = (admissionId: string) => {
        try {
            settingsService.updateAdmissionStatus(admissionId, school.id, 'rejected');
            refreshData();
            showActionFeedback('Admission rejected.');
        } catch (error) {
            showActionFeedback((error as Error).message);
        }
    };
    
    const handleStageForTransfer = (admissionId: string) => {
        try {
            settingsService.stageAdmissionForTransfer(admissionId, school.id);
            refreshData();
            showActionFeedback('Student staged for transfer.');
        } catch (error) {
            showActionFeedback((error as Error).message);
        }
    };
    
    const getAdmissionAggregate = (admission: CompletedAdmission): number => {
        const data = admission.data;
        const aggStr = 'gradeAggregate' in data ? data.gradeAggregate : data.aggregate;
        if (!aggStr) return Infinity;
        const parsed = parseInt(aggStr.replace(/\D/g, ''), 10);
        return isNaN(parsed) ? Infinity : parsed;
    };

    const oLevelAdmissions = useMemo(() => completedAdmissions.filter(a => settingsService.getAdmissionLevel(a.data) === 'P.L.E'), [completedAdmissions]);
    const aLevelAdmissions = useMemo(() => completedAdmissions.filter(a => settingsService.getAdmissionLevel(a.data) === 'U.C.E'), [completedAdmissions]);


    const filteredAdmissions = useMemo(() => {
        const sourceAdmissions = levelTab === 'O-Level' ? oLevelAdmissions : aLevelAdmissions;
        return sourceAdmissions
            .filter(admission => admission.status === activeTab)
            .filter(admission => {
                if (gradeFilter === 'all') return true;
                const grade = getAdmissionGrade(admission);
                const normalizedStudentGrade = normalizeGrade(grade);
                return normalizedStudentGrade === gradeFilter.toUpperCase();
            })
            .filter(admission => {
                // Apply aggregate filter only if not in transferred tab
                if (activeTab !== 'transferred') {
                    if (!aggregateFilter.trim()) return true;
                    const maxAgg = parseInt(aggregateFilter, 10);
                    if (isNaN(maxAgg)) return true;
                    const studentAgg = getAdmissionAggregate(admission);
                    return studentAgg <= maxAgg;
                }
                return true;
            })
            .filter(admission => {
                // Apply gender filter only in transferred tab
                if (activeTab === 'transferred') {
                    if (genderFilter === 'All') return true;
                    return admission.gender === genderFilter;
                }
                return true;
            });
    }, [oLevelAdmissions, aLevelAdmissions, levelTab, activeTab, gradeFilter, aggregateFilter, genderFilter]);

    const handleClassToggle = (className: string) => {
        const newClasses = settings.acceptingClasses.includes(className)
            ? settings.acceptingClasses.filter(c => c !== className)
            : [...settings.acceptingClasses, className];
        handleSettingsChange('acceptingClasses', newClasses);
    };

    const selectedOLevels = settings.acceptingClasses.filter(c => oLevelClasses.some(oc => oc.name === c)).length;
    const selectedALevels = settings.acceptingClasses.filter(c => aLevelClasses.some(ac => ac.name === c)).length;

    useEffect(() => {
        setSettings(settingsService.getAdmissionSettings(school.id));
    }, [school.id]);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (oLevelDropdownRef.current && !oLevelDropdownRef.current.contains(event.target as Node)) {
                setOLevelDropdownOpen(false);
            }
            if (aLevelDropdownRef.current && !aLevelDropdownRef.current.contains(event.target as Node)) {
                setALevelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showFeedback = (message: string, isSuccess: boolean) => {
        setFeedback({ message, type: isSuccess ? 'success' : 'error' });
        setTimeout(() => setFeedback({ message: '', type: 'success' }), 4000);
    };

    const handleSettingsChange = (field: keyof AdmissionSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveSettings = () => {
        settingsService.saveAdmissionSettings(settings);
        refreshData();
        showFeedback("Admission settings saved successfully!", true);
    };

    const handleAddCombination = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCombination.name.trim() || !newCombination.subjects.trim()) {
            showFeedback("Combination code and subjects are required.", false);
            return;
        }

        const newCombo: SchoolALevelCombination = {
            id: `combo_${Date.now()}`,
            name: newCombination.name.trim().toUpperCase(),
            subjects: newCombination.subjects.trim(),
        };

        const newCombinations = { ...settings.aLevelCombinations };
        newCombinations[newCombination.category] = [...newCombinations[newCombination.category], newCombo];

        handleSettingsChange('aLevelCombinations', newCombinations);
        setNewCombination({ name: '', subjects: '', category: 'sciences' });
        showFeedback("Combination added. Click 'Save Settings' to confirm.", true);
    };

    const handleDeleteCombination = (category: 'arts' | 'sciences', comboId: string) => {
        if (!settings) return;
        const newCombinations = { ...settings.aLevelCombinations };
        newCombinations[category] = newCombinations[category].filter(c => c.id !== comboId);
        handleSettingsChange('aLevelCombinations', newCombinations);
        showFeedback("Combination removed. Click 'Save Settings' to confirm.", true);
    };
    
    const tabOptions: { key: CompletedAdmission['status']; label: string }[] = [
        { key: 'under_review', label: 'Pending' },
        { key: 'approved', label: 'Admit' },
        { key: 'rejected', label: 'Reject' },
        { key: 'transferred', label: 'Transfer' },
    ];
    
    return (
        <div>
            {viewModalData && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
                         <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold">Applicant Details</h3>
                            <button onClick={() => setViewModalData(null)} className="text-2xl">&times;</button>
                        </div>
                        <div className="overflow-y-auto pr-2">
                            <ApplicantDetailsView data={viewModalData.data} />
                        </div>
                    </div>
                </div>
            )}
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-6">Smart Admission Management</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-xl">
                    <div className="flex space-x-1 mb-4 border-b border-gray-700">
                        {tabOptions.map(tab => {
                             const count = (levelTab === 'O-Level' ? oLevelAdmissions : aLevelAdmissions).filter(a => a.status === tab.key).length;
                            return (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-3 font-semibold transition-colors text-sm ${activeTab === tab.key ? 'border-b-2 border-cyan-400 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {tab.label} ({count})
                            </button>
                        )})}
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-gray-900 rounded-lg mb-6">
                        <button onClick={() => setLevelTab('O-Level')} className={`w-full py-2 text-sm font-semibold rounded-md ${levelTab === 'O-Level' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                            O'Level Admissions ({oLevelAdmissions.length})
                        </button>
                        <button onClick={() => setLevelTab('A-Level')} className={`w-full py-2 text-sm font-semibold rounded-md ${levelTab === 'A-Level' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                            A'Level Admissions ({aLevelAdmissions.length})
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md">
                            <option value="all">Filter by Grade (All)</option>
                            {GRADE_OPTIONS.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                        </select>
                        {activeTab === 'transferred' ? (
                            <select value={genderFilter} onChange={e => setGenderFilter(e.target.value as 'All' | 'Male' | 'Female')} className="w-full p-2 bg-gray-700 rounded-md">
                                <option value="All">Select Gender (All)</option>
                                {GENDER_OPTIONS.map(gender => <option key={gender} value={gender}>{gender}</option>)}
                            </select>
                        ) : (
                            <input type="number" value={aggregateFilter} onChange={e => setAggregateFilter(e.target.value)} placeholder="Filter by Max Aggregate (e.g., 12)" className="w-full p-2 bg-gray-700 rounded-md"/>
                        )}
                    </div>
                    
                    {actionFeedback && <div className="bg-cyan-500/20 text-cyan-300 p-3 rounded-md mb-4 text-sm">{actionFeedback}</div>}

                    <div className="space-y-4">
                        {filteredAdmissions.length > 0 ? (
                            filteredAdmissions.map(admission => {
                                const data = admission.data;
                                const name = 'candidateName' in data ? data.candidateName : data.name;
                                const indexNo = 'indexNumber' in data ? data.indexNumber : data.indexNo;
                                const grade = getAdmissionGrade(admission);
                                const aggregate = getAdmissionAggregate(admission);
                                
                                return (
                                    <div key={admission.id} className="bg-gray-700/50 p-4 rounded-lg">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                            <div>
                                                <p className="font-bold text-lg text-white">{name}</p>
                                                <p className="text-sm text-gray-400">{indexNo}</p>
                                                <p className="text-sm mt-1">Applying for: <strong className="text-white">{admission.targetClass}</strong></p>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className="font-semibold text-cyan-400">{grade || 'N/A'}</p>
                                                <p className="text-sm text-gray-300">Aggregate: {aggregate !== Infinity ? aggregate : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-600">
                                            <button onClick={() => setViewModalData(admission)} className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-semibold">View</button>
                                            {activeTab === 'under_review' && (
                                                <>
                                                    <button onClick={() => handleStageForTransfer(admission.id)} className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-md text-sm font-semibold">Stage for Transfer</button>
                                                    <button onClick={() => handleReject(admission.id)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold">Reject</button>
                                                    <button onClick={() => handleApprove(admission.id)} className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold">Approve</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <p>No applications match the current filters.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-xl self-start">
                    <h4 className="font-bold text-xl mb-4 text-white">Settings</h4>
                    {feedback.message && <div className={`p-2 rounded-md text-sm mb-4 ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{feedback.message}</div>}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Admission Fee (UGX)</label>
                            <input type="number" value={settings.admissionFee} onChange={e => handleSettingsChange('admissionFee', Number(e.target.value))} className="w-full p-2 bg-gray-900/50 rounded-md"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label><input type="date" value={settings.startDate} onChange={e => handleSettingsChange('startDate', e.target.value)} className="w-full p-2 bg-gray-900/50 rounded-md"/></div>
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">End Date</label><input type="date" value={settings.endDate} onChange={e => handleSettingsChange('endDate', e.target.value)} className="w-full p-2 bg-gray-900/50 rounded-md"/></div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Configure Accepting Classes</label>
                            <div className="space-y-3">
                                <div className="relative" ref={oLevelDropdownRef}><button type="button" onClick={() => setOLevelDropdownOpen(p => !p)} className="w-full px-4 py-2 bg-gray-900/50 rounded-md text-left flex justify-between items-center"><span>O'Level ({selectedOLevels} selected)</span><ChevronIcon isOpen={oLevelDropdownOpen} /></button>{oLevelDropdownOpen && (<div className="absolute top-full left-0 mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10 p-3 space-y-2">{oLevelClasses.map(cls => (<label key={cls.id} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-600 rounded"><input type="checkbox" checked={settings.acceptingClasses.includes(cls.name)} onChange={() => handleClassToggle(cls.name)} className="form-checkbox"/><span>{cls.name}</span></label>))}</div>)}</div>
                                <div className="relative" ref={aLevelDropdownRef}><button type="button" onClick={() => setALevelDropdownOpen(p => !p)} className="w-full px-4 py-2 bg-gray-900/50 rounded-md text-left flex justify-between items-center"><span>A'Level ({selectedALevels} selected)</span><ChevronIcon isOpen={aLevelDropdownOpen} /></button>{aLevelDropdownOpen && (<div className="absolute top-full left-0 mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg z-10 p-3 space-y-2">{aLevelClasses.map(cls => (<label key={cls.id} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-600 rounded"><input type="checkbox" checked={settings.acceptingClasses.includes(cls.name)} onChange={() => handleClassToggle(cls.name)} className="form-checkbox"/><span>{cls.name}</span></label>))}</div>)}</div>
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-4">
                            <h5 className="font-bold text-lg mb-2 text-white">Manage A'Level Combinations</h5>
                            <form onSubmit={handleAddCombination} className="space-y-3 bg-gray-900/50 p-3 rounded-md">
                                <div className="flex gap-2"><input value={newCombination.name} onChange={e => setNewCombination({...newCombination, name: e.target.value})} placeholder="Code (e.g., PCM)" required className="p-2 bg-gray-700 rounded-md w-1/3"/><select value={newCombination.category} onChange={e => setNewCombination({...newCombination, category: e.target.value as any})} className="p-2 bg-gray-700 rounded-md w-2/3"><option value="sciences">Sciences</option><option value="arts">Arts</option></select></div>
                                <input value={newCombination.subjects} onChange={e => setNewCombination({...newCombination, subjects: e.target.value})} placeholder="Subjects (e.g., Physics, Chemistry, Maths)" required className="w-full p-2 bg-gray-700 rounded-md"/>
                                <button type="submit" className="w-full py-1.5 bg-cyan-800 hover:bg-cyan-700 rounded-md text-sm font-semibold">Add Combination</button>
                            </form>
                            <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-2">
                                <div><h6 className="font-semibold text-sm text-cyan-400">Sciences Combinations</h6>{settings.aLevelCombinations.sciences.length === 0 ? <p className="text-xs text-gray-400">None added.</p> : settings.aLevelCombinations.sciences.map(c => <div key={c.id} className="flex justify-between items-center p-1.5 text-sm"><span className="truncate pr-2"><strong>{c.name}</strong>: {c.subjects}</span><button type="button" onClick={() => handleDeleteCombination('sciences', c.id)} className="text-red-400 hover:text-red-300 text-lg">&times;</button></div>)}</div>
                                <div><h6 className="font-semibold text-sm text-cyan-400">Arts Combinations</h6>{settings.aLevelCombinations.arts.length === 0 ? <p className="text-xs text-gray-400">None added.</p> : settings.aLevelCombinations.arts.map(c => <div key={c.id} className="flex justify-between items-center p-1.5 text-sm"><span className="truncate pr-2"><strong>{c.name}</strong>: {c.subjects}</span><button type="button" onClick={() => handleDeleteCombination('arts', c.id)} className="text-red-400 hover:text-red-300 text-lg">&times;</button></div>)}</div>
                            </div>
                        </div>

                        <button onClick={handleSaveSettings} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold mt-4">
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const KioskManagementView: React.FC<{ schoolId: string }> = ({ schoolId }) => {
    const [logs, setLogs] = useState<KioskLogEntry[]>([]);
    const [filterType, setFilterType] = useState<string>('all');

    const refreshLogs = useCallback(() => {
        setLogs(kioskService.getKioskLogs(schoolId));
    }, [schoolId]);

    useEffect(() => {
        refreshLogs();
        const interval = setInterval(refreshLogs, 5000);
        return () => clearInterval(interval);
    }, [refreshLogs]);

    const filteredLogs = logs.filter(log => filterType === 'all' || log.type === filterType);

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-4">Kiosk Activity Monitor</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-cyan-500">
                    <h4 className="text-gray-400 text-sm font-semibold uppercase">Today's Visits</h4>
                    <p className="text-3xl font-bold text-white mt-1">{logs.filter(l => l.type === 'visitor' && new Date(l.timestamp).toDateString() === new Date().toDateString()).length}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-green-500">
                    <h4 className="text-gray-400 text-sm font-semibold uppercase">Canteen Check-ins</h4>
                    <p className="text-3xl font-bold text-white mt-1">{logs.filter(l => l.type === 'canteen').length}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-purple-500">
                    <h4 className="text-gray-400 text-sm font-semibold uppercase">Votes Cast</h4>
                    <p className="text-3xl font-bold text-white mt-1">{logs.filter(l => l.type === 'voting').length}</p>
                 </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h4 className="font-bold text-lg">Activity Log</h4>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm">
                        <option value="all">All Activities</option>
                        <option value="visitor">Visitor</option>
                        <option value="canteen">Canteen</option>
                        <option value="voting">Voting</option>
                    </select>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-700 text-gray-300 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredLogs.length > 0 ? filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-700/50">
                                    <td className="px-6 py-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                            log.type === 'visitor' ? 'bg-blue-500/20 text-blue-300' :
                                            log.type === 'canteen' ? 'bg-green-500/20 text-green-300' :
                                            'bg-purple-500/20 text-purple-300'
                                        }`}>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-white">{log.description}</td>
                                    <td className="px-6 py-4 text-sm text-gray-300">{log.userName || 'Unknown'}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No activity recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface SmartIdManagementProps {
    school: School;
}
const SmartIdManagement: React.FC<SmartIdManagementProps> = ({ school }) => {
    const [settings, setSettings] = useState(() => smartIdService.getSmartIdSettings(school.id));
    const [template, setTemplate] = useState(() => customIdTemplateService.getCustomIdTemplate(school.id));
    return (
        <div className="space-y-6">
             <h3 className="text-xl font-bold mb-4 text-white">Smart ID Card Management</h3>
             <div className="bg-gray-800 p-4 rounded-lg">
                <IdCardDesigner school={school} onTemplateSave={() => setTemplate(customIdTemplateService.getCustomIdTemplate(school.id))} />
             </div>
        </div>
    );
};

const UnebDashboardView: React.FC<{ stats: UnebStats | null }> = ({ stats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Results" value={stats?.totalSlips || 0} icon={<ResultsIcon/>} colorClassName="bg-cyan-500" />
        <StatCard title="P.L.E Results" value={stats?.byLevel['P.L.E'].studentCount || 0} icon={<ResultsIcon/>} colorClassName="bg-indigo-500" />
        <StatCard title="U.C.E Results" value={stats?.byLevel['U.C.E'].studentCount || 0} icon={<ResultsIcon/>} colorClassName="bg-emerald-500" />
        <StatCard title="U.A.C.E Results" value={stats?.byLevel['U.A.C.E'].studentCount || 0} icon={<ResultsIcon/>} colorClassName="bg-amber-500" />
    </div>
);

const UnebCenterView: React.FC<{
    feedback: { type: 'success' | 'error', message: React.ReactNode } | null;
    isUploading: boolean;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}> = ({ feedback, isUploading, onFileUpload, fileInputRef }) => {

    const csvTemplateHeader = [
        'yearOfExamination', 'slipSerialNumber', 'examinationType', 'candidateName', 'schoolName',
        'centerNumber', 'indexNumber', 'entryCode', 'dateOfBirth', 'schoolAddress',
        'subjects', 'gradeAggregate', 'overallResult', 'note'
    ].join(',');
    const csvTemplateExample = [
        '"2017"', '"O4911683"', '"UGANDA CERTIFICATE OF EDUCATION"', '"NYESIGA HOWARD"', '"STANDARD HIGH SCHOOL, ZZANA"',
        '"U0833"', '"U0833/070"', '"1"', '"22/08/1997"', '"P.O. BOX 22981 KAMPALA"',
        '"ENGLISH:4:FOUR|LITERATURE:5:FIVE|HISTORY:2:TWO|GEOGRAPHY:3:THREE|MATHEMATICS:6:SIX|PHYSICS:8:EIGHT|CHEMISTRY:7:SEVEN|BIOLOGY:6:SIX|COMMERCE:4:FOUR|COMPUTER STUDIES:7:SEVEN"', '"37"', '"RESULT 2"', '"Please see overleaf"'
    ].map(v => `"${v}"`).join(',');
    const csvTemplate = `${csvTemplateHeader}\n${csvTemplateExample}`;

    const sampleCsvData = [
        csvTemplateHeader,
        [
            '2023', 'P123456', 'PRIMARY LEAVING EXAMINATION', 'John Doe', 'Sample Primary School',
            'P001', 'P001/001', '1', '01/01/2010', 'P.O. BOX 1, KAMPALA',
            'ENGLISH:1:DISTINCTION|MATHEMATICS:1:DISTINCTION|SCIENCE:2:CREDIT|SOCIAL STUDIES:2:CREDIT', '6', 'FIRST GRADE', 'N/A'
        ].map(val => `"${val}"`).join(','),
        csvTemplateExample,
        [
            '2023', 'A789012', 'UGANDA ADVANCED CERTIFICATE OF EDUCATION', 'Jane Smith', 'Advanced High School',
            'A001', 'A001/001', '1', '01/01/2005', 'P.O. BOX 2, KAMPALA',
            'MATHEMATICS:A:PRINCIPAL|PHYSICS:B:PRINCIPAL|CHEMISTRY:B:PRINCIPAL|GENERAL PAPER:C3:SUBSIDIARY', '18', 'N/A', 'N/A'
        ].map(val => `"${val}"`).join(',')
    ].join('\n');


    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-white">Upload UNEB Results</h3>
            {feedback && (
                <div className={`p-4 rounded-md mb-4 text-sm ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {feedback.message}
                </div>
            )}
            <div className="space-y-4">
                <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md">
                    <p className="font-bold mb-2">Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Download the CSV template or sample data file.</li>
                        <li>Fill in the student results. All columns are required.</li>
                        <li>The <strong>subjects</strong> column must be formatted as a pipe-separated list: <code>SubjectName:GradeNumber:GradeWord|SubjectName2:GradeNumber2:GradeWord2</code>.</li>
                        <li>Save and upload the completed file. The entire file will be rejected if any row contains an error.</li>
                    </ol>
                </div>
                <div className="flex items-center space-x-4">
                    <input type="file" ref={fileInputRef} onChange={onFileUpload} accept=".csv" className="hidden"/>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:bg-gray-500">
                        <UploadIcon/>{isUploading ? 'Uploading...' : 'Upload CSV'}
                    </button>
                    <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplate)}`} download="uneb_results_template.csv" className="text-sm text-cyan-400 hover:underline">
                        Download Template
                    </a>
                     <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsvData)}`} download="uneb_sample_data.csv" className="text-sm text-cyan-400 hover:underline">
                        Download Sample Data
                    </a>
                </div>
            </div>
        </div>
    );
};

interface AdminPageProps {
    user: AdminUser;
    onLogout: () => void;
}

// Ensure AdminPage is exported as default to match App.tsx lazy usage
const AdminPage: React.FC<AdminPageProps> = ({ user, onLogout }) => {
    // State
    const [view, setView] = useState('dashboard');
    const [schools, setSchools] = useState<School[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [schoolForHeadteacher, setSchoolForHeadteacher] = useState<School | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(user);
    const [classes, setClasses] = useState<SchoolClass[]>([]);

    // State for UNEB Admin
    const [unebStats, setUnebStats] = useState<UnebStats | null>(null);
    const [unebFeedback, setUnebFeedback] = useState<{ type: 'success' | 'error'; message: React.ReactNode } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for Headteacher:
    const [students, setStudents] = useState<SchoolUser[]>([]);
    const [activeModules, setActiveModules] = useState<Module[]>([]);
    const [completedAdmissions, setCompletedAdmissions] = useState<CompletedAdmission[]>([]);
    
    // State for Finish Shopping Flow
    const [stagedMarketplaceOrder, setStagedMarketplaceOrder] = useState<StagedMarketplaceOrder | null>(null);
    const [stagedTransferPayment, setStagedTransferPayment] = useState<StagedTransferPayment | null>(null);


    // State for Password Reset Modal
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [userToResetPassword, setUserToResetPassword] = useState<AdminUser | SchoolUser | null>(null);
    const [newTemporaryPassword, setNewTemporaryPassword] = useState('');


    const refreshData = useCallback(() => {
        const allSchools = getAllSchools();
        setSchools(allSchools);
        const allModules = getAllModules();
        setModules(allModules);

        if (user.role === 'uneb_admin') {
            setUnebStats(getUnebStats());
        }

        if (user.role === 'headteacher' && user.assignedSchoolIds.length > 0) {
            const schoolId = user.assignedSchoolIds[0];
            const school = allSchools.find(s => s.id === schoolId);
            setSchoolForHeadteacher(school || null);
            if(school) {
                const schoolStudents = studentService.getSchoolUsersBySchoolIds([schoolId]);
                setStudents(schoolStudents);
                setCompletedAdmissions(settingsService.getCompletedAdmissions(schoolId));
                setClasses(classService.getClassesForSchool(schoolId));
                
                const schoolModules = school.modules
                    .filter(m => m.status === 'active' || m.status === 'published')
                    .map(m => allModules.find(mod => mod.id === m.moduleId))
                    .filter((m): m is Module => !!m);
                setActiveModules(schoolModules);
            }
        }
    }, [user.role, user.assignedSchoolIds]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(() => heartbeat(currentUser.id), 5000);
        return () => clearInterval(interval);
    }, [refreshData, currentUser.id]);

    useEffect(() => {
        const savedStagedOrder = marketplaceService.getStagedMarketplaceOrder();
        if (savedStagedOrder) {
            setStagedMarketplaceOrder(savedStagedOrder);
        }
        const savedTransferPayment = eWalletService.getStagedTransferPayment();
        if (savedTransferPayment) {
            setStagedTransferPayment(savedTransferPayment);
        }
    }, []);
    
    // --- Module Action Handlers for Headteacher ---
    const handleActivateModule = (schoolId: string, moduleId: string) => {
        activateModuleForSchool(schoolId, moduleId);
        refreshData();
    };
    const handleDeactivateModule = (schoolId: string, moduleId: string) => {
        deactivateModuleForSchool(schoolId, moduleId);
        refreshData();
    };
    const handlePublishModule = (schoolId: string, moduleId: string) => {
        try {
            publishModuleForSchool(schoolId, moduleId);
            refreshData();
        } catch (error) {
            alert((error as Error).message);
        }
    };
    const handleUnpublishModule = (schoolId: string, moduleId: string) => {
        try {
            unpublishModuleForSchool(schoolId, moduleId);
            refreshData();
        } catch (error) {
            alert((error as Error).message);
        }
    };
    const handlePublishHomePage = (schoolId: string) => {
        publishHomePage(schoolId);
        refreshData();
    };
    const handleUnpublishHomePage = (schoolId: string) => {
        unpublishHomePage(schoolId);
        refreshData();
    };

    const handleUpdateModuleRoles = (schoolId: string, moduleId: string, roles: SchoolUserRole[]) => {
        try {
            updateModuleRolesForSchool(schoolId, moduleId, roles);
            refreshData();
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUnebFeedback(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            try {
                // Assuming papaparse is available globally for simplicity
                const { data } = (window as any).Papa.parse(text, { header: true, skipEmptyLines: true });
                const result = addUnebResults(data);
                
                if (result.errorCount > 0) {
                     setUnebFeedback({
                        type: 'error',
                        message: (
                            <>
                                <p>Processing complete with {result.errorCount} errors:</p>
                                <ul className="list-disc list-inside text-xs mt-2">
                                    {result.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </>
                        )
                    });
                } else {
                    setUnebFeedback({ type: 'success', message: `Successfully added ${result.successCount} results.` });
                }
                refreshData();
            } catch (err) {
                setUnebFeedback({ type: 'error', message: (err as Error).message });
            }
            setIsUploading(false);
             if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    const handleSchoolUserPasswordReset = (schoolUser: SchoolUser) => {
        try {
            const newPass = Math.random().toString(36).slice(-8);
            studentService.resetSchoolUserPassword(schoolUser.studentId, newPass);
            setUserToResetPassword(schoolUser);
            setNewTemporaryPassword(newPass);
            setIsResetPasswordModalOpen(true);
        } catch (error) {
            alert((error as Error).message);
        }
    };
    
    const handleOrderStaged = (order: StagedMarketplaceOrder) => {
        setStagedMarketplaceOrder(order);
        marketplaceService.stageMarketplaceOrder(order);
        setView('wallet'); 
    };
    
    const handleProceedWithTransferPayment = () => {
        // Redirect to wallet where staged transfer payment will be picked up
        setView('wallet');
    };

    const handleConsumeStagedTransfer = () => {
        setStagedTransferPayment(null);
        eWalletService.clearStagedTransferPayment();
    }

    const handleFinishShopping = () => {
        setView('online_feed');
    };

    const handleConsumeStagedOrder = () => {
        setStagedMarketplaceOrder(null);
        marketplaceService.clearStagedMarketplaceOrder();
    };

    const renderContent = () => {
        switch (user.role) {
            case 'headteacher':
                if (!schoolForHeadteacher) {
                    return <div><p className="text-yellow-400">You are not assigned to any school. Please contact the superadministrator.</p></div>;
                }

                const compatibleUser = {
                    ...user,
                    studentId: user.id,
                    schoolId: schoolForHeadteacher.id
                };

                // Check if the current view corresponds to an active module
                const activeModuleView = Object.entries(moduleNameToViewMap).find(([name, v]) => v === view);
                if (activeModuleView) {
                    const moduleIsActive = activeModules.some(m => m.name === activeModuleView[0]);
                    if (!moduleIsActive && view !== 'dashboard' && view !== 'online_feed' && view !== 'e_wallet') {
                        // If the module for the current view is not active, reset to dashboard
                        // This prevents showing a view for a deactivated module
                        setView('dashboard');
                        return <HeadteacherDashboardView school={schoolForHeadteacher} students={students} activeModules={activeModules} />;
                    }
                }

                switch(view) {
                    case 'modules':
                        return <ModulesManagement 
                            school={schoolForHeadteacher} 
                            allModules={modules} 
                            onActivate={handleActivateModule}
                            onDeactivate={handleDeactivateModule}
                            onPublish={handlePublishModule}
                            onUnpublish={handleUnpublishModule}
                            onHomePagePublish={handlePublishHomePage}
                            onHomePageUnpublish={handleUnpublishHomePage}
                            onUpdateRoles={handleUpdateModuleRoles}
                        />;
                    case 'users':
                        return <UsersManagement school={schoolForHeadteacher} students={students} classes={classes} refreshData={refreshData} onResetPassword={handleSchoolUserPasswordReset} />;
                    case 'homepage':
                        return <HomePageEditor school={schoolForHeadteacher} />;
                    case 'smart_admission':
                        return <AdmissionManagement school={schoolForHeadteacher} completedAdmissions={completedAdmissions} classes={classes} refreshData={refreshData} />;
                    case 'e_wallet':
                    case 'wallet':
                        return <EWalletPage 
                            user={user} 
                            stagedMarketplaceOrder={stagedMarketplaceOrder} 
                            onFinishShopping={handleFinishShopping} 
                            stagedTransferPayment={stagedTransferPayment}
                            onProceedWithTransferPayment={() => {}} // Not needed in wallet page itself for headteacher flow here
                        />;
                    case 'smart_id':
                        return <SmartIdManagement school={schoolForHeadteacher} />;
                    case 'e_canteen':
                        return <ECanteenManagementPage school={schoolForHeadteacher} user={user} />;
                    case 'security':
                        return <SecurityManagement />;
                    case 'nche':
                        return <HeadteacherNcheView school={schoolForHeadteacher} students={students} />;
                    case 'transfer_market':
                        return <StudentTransferMarketplace 
                                school={schoolForHeadteacher} 
                                user={user} 
                                classes={classes} 
                                onNavigateToWallet={() => setView('wallet')}
                                stagedTransferPayment={stagedTransferPayment}
                                onConsumeStagedTransfer={handleConsumeStagedTransfer}
                            />;
                    case 'messages':
                        return <SocialHubPage user={compatibleUser as any} onLogout={onLogout} onReturnToAdmin={() => setView('dashboard')} />;
                    case 'online_feed':
                        return <OnlineFeedPage 
                            user={compatibleUser as any} 
                            onLogout={onLogout} 
                            onBackToDashboard={() => setView('dashboard')} 
                            onNavigateToWallet={() => setView('wallet')}
                            onOrderStaged={handleOrderStaged}
                            stagedOrder={stagedMarketplaceOrder}
                            onStagedOrderConsumed={handleConsumeStagedOrder}
                        />;
                    case 'exploration':
                        return <ExplorationPage user={compatibleUser as any} />;
                    case 'e_vote':
                        return <EVoteAdminPage school={schoolForHeadteacher} user={user} />;
                    case 'my_institute':
                        return <MyInstituteAdminPage />;
                    case 'visitor_center':
                        return <VisitorCenterPage schoolId={schoolForHeadteacher.id} />;
                    case 'kiosk_management':
                        return <KioskManagementView schoolId={schoolForHeadteacher.id} />;
                    default:
                        return <HeadteacherDashboardView school={schoolForHeadteacher} students={students} activeModules={activeModules} />;
                }
            case 'uneb_admin':
                if (view === 'upload') {
                    return <UnebCenterView feedback={unebFeedback} isUploading={isUploading} onFileUpload={handleFileUpload} fileInputRef={fileInputRef} />;
                }
                if (view === 'e_wallet') {
                    return <EWalletPage user={user} />;
                }
                if (view === 'security') {
                    return <SecurityManagement />;
                }
                return <UnebDashboardView stats={unebStats} />;
            case 'nche_admin':
                 return <NcheAdminPage user={user} onLogout={onLogout} />;
            default:
                return <div>Dashboard for role {user.role} coming soon.</div>;
        }
    };
    
    // Dynamically build nav items based on role
    const navItems: { view: string; name: string; icon: React.ReactNode }[] = useMemo(() => {
        switch(user.role) {
            case 'headteacher':
                return [
                    { view: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
                    { view: 'users', name: 'Users', icon: <UsersIcon /> },
                    { view: 'modules', name: 'Modules', icon: <ModulesIcon /> },
                    { view: 'security', name: 'Security', icon: <SecurityIcon /> },
                ];
            case 'uneb_admin':
                 return [
                    { view: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
                    { view: 'upload', name: 'Upload Center', icon: <UploadIcon /> },
                    { view: 'e_wallet', name: 'E-Wallet', icon: <EWalletIcon /> },
                    { view: 'security', name: 'Security', icon: <SecurityIcon /> },
                 ];
            default: return [];
        }
    }, [user.role]);

    if (user.role === 'nche_admin') {
        return <NcheAdminPage user={user} onLogout={onLogout} />;
    }

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
            
            {/* Desktop Sidebar */}
            <aside className={`bg-gray-800 text-white p-4 flex-col justify-between transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} hidden lg:flex`}>
                <div>
                    <div className="flex items-center justify-center mb-8 h-10">
                         {!isSidebarCollapsed && <h1 className="text-xl font-bold text-cyan-400">{APP_TITLE}</h1>}
                    </div>
                    <nav className="space-y-2">
                        {navItems.map(item => (
                            <button key={item.view} onClick={() => { setView(item.view); setIsSidebarCollapsed(true); }} title={item.name}
                                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${view === item.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                                {item.icon}
                                {!isSidebarCollapsed && <span>{item.name}</span>}
                            </button>
                        ))}
                        {user.role === 'headteacher' && activeModules.length > 0 && (
                            <div className="w-full flex items-center space-x-3 p-3 rounded-md" title="Active Modules">
                                <ModulesIcon />
                                {!isSidebarCollapsed && (
                                    <select
                                        value={Object.values(moduleNameToViewMap).includes(view) ? view : ''}
                                        onChange={(e) => {
                                            const newView = e.target.value;
                                            if (newView) {
                                                setView(newView);
                                                setIsSidebarCollapsed(true);
                                            }
                                        }}
                                        className="w-full p-2 bg-gray-700 rounded-md text-white border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                                        aria-label="Active Modules"
                                    >
                                        <option value="">Active Modules...</option>
                                        {activeModules.map(module => {
                                            const viewName = moduleNameToViewMap[module.name];
                                            if (!viewName) return null;
                                            return (
                                                <option key={module.id} value={viewName}>
                                                    {module.name}
                                                </option>
                                            );
                                        })}
                                    </select>
                                )}
                            </div>
                        )}
                    </nav>
                </div>
            </aside>
            
            {/* Mobile Sidebar & Overlay */}
            {isSidebarOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                    <aside className="fixed top-0 left-0 h-full w-64 bg-gray-800 shadow-xl z-40 p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-cyan-400">{APP_TITLE}</h2>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon /></button>
                        </div>
                         <nav className="space-y-2">
                             {navItems.map(item => (
                                <button key={item.view} onClick={() => { setView(item.view); setIsSidebarOpen(false); }}
                                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${view === item.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>
                                    {item.icon}<span>{item.name}</span>
                                </button>
                            ))}
                            {user.role === 'headteacher' && activeModules.length > 0 && (
                                <div className="w-full flex items-center space-x-3 p-3 rounded-md">
                                    <ModulesIcon />
                                    <select
                                        value={Object.values(moduleNameToViewMap).includes(view) ? view : ''}
                                        onChange={(e) => {
                                            const newView = e.target.value;
                                            if (newView) {
                                                setView(newView);
                                                setIsSidebarOpen(false);
                                            }
                                        }}
                                        className="w-full p-2 bg-gray-700 rounded-md text-white border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                                        aria-label="Active Modules"
                                    >
                                        <option value="">Active Modules...</option>
                                        {activeModules.map(module => {
                                            const viewName = moduleNameToViewMap[module.name];
                                            if (!viewName) return null;
                                            return (
                                                <option key={module.id} value={viewName}>
                                                    {module.name}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </nav>
                    </aside>
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                 <header className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-800 border-l border-gray-700 shadow-md">
                    <div className="flex items-center space-x-4">
                        <button className="lg:hidden p-1 text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(true)}><HamburgerIcon /></button>
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
                        {renderContent()}
                    </div>
                </main>
            </div>

            {isResetPasswordModalOpen && userToResetPassword && (
                <ConfirmationModal
                    isOpen={isResetPasswordModalOpen}
                    title="User Password Reset"
                    message={
                        <div className="space-y-4">
                            <p>The password for <strong className="text-white">{userToResetPassword.name}</strong> ({'email' in userToResetPassword ? userToResetPassword.email : userToResetPassword.studentId}) has been reset.</p>
                            <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 text-center">
                                <p className="text-sm text-gray-400">New Temporary Password:</p>
                                <p className="font-bold text-xl text-cyan-400">{newTemporaryPassword}</p>
                            </div>
                            <p className="text-sm text-yellow-400">Please communicate this new password to the user securely. They will be required to change it upon their next login.</p>
                        </div>
                    }
                    onConfirm={() => setIsResetPasswordModalOpen(false)}
                    onCancel={() => setIsResetPasswordModalOpen(false)}
                    confirmText="Acknowledge"
                    cancelText="Close"
                />
            )}
        </div>
    );
};

export default AdminPage;
