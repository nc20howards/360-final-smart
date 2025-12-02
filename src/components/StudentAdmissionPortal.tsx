
// src/components/StudentAdmissionPortal.tsx


import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, School, ExtractedUnebSlipData, UnebPassSlip, AdmissionSettings, CompletedAdmission, SchoolALevelCombination, EWallet, UnebSubjectResult, StagedAdmission } from '../types';
import * as settingsService from '../services/settingsService';
import { isUnebVerificationEnabled, getUnebOfficialLogo } from '../services/systemSettingsService';
import { extractTextFromImageWithGoogle } from '../services/apiService';
import { findResultByIndex } from '../services/unebResultService';
import * as eWalletService from '../services/eWalletService';
import * as studentService from '../services/studentService';
import PinStrengthIndicator from './PinStrengthIndicator';
import ConfirmationModal from './ConfirmationModal';
import UserAvatar from './UserAvatar';
import { getAllSchools } from '../services/schoolService';


// --- SVG Icons ---
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const VerifiedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);

// --- Student-Facing Admission Portal Component ---
interface StudentAdmissionPortalProps {
    user?: User;
    school: School;
    onBack: () => void;
    onAdmissionStaged?: (data: StagedAdmission) => void;
    stagedData?: StagedAdmission | null;
    onStagedDataConsumed?: () => void;
    isNewUserFlow?: boolean;
    onAdmissionSuccess?: (creds: { studentId: string; tempPass: string }) => void;
    onLogout?: () => void; // Add onLogout to props
}
export function StudentAdmissionPortal({ user, school, onBack, isNewUserFlow, onAdmissionSuccess, onAdmissionStaged, stagedData, onStagedDataConsumed, onLogout }: StudentAdmissionPortalProps) {
    type SelfAdmissionTab = 'scan' | 'index' | null;

    const [settings, setSettings] = useState<AdmissionSettings | null>(null);
    const [selfAdmissionTab, setSelfAdmissionTab] = useState<SelfAdmissionTab>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<number | null>(null);
    const [dataForVerification, setDataForVerification] = useState<UnebPassSlip | ExtractedUnebSlipData | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [editableData, setEditableData] = useState<ExtractedUnebSlipData | null>(null);
    const [isEditingData, setIsEditingData] = useState(false);
    const [gender, setGender] = useState<'Male' | 'Female' | ''>('');
    
    const [selectedTargetClass, setSelectedTargetClass] = useState('');
    const [aLevelSelection, setALevelSelection] = useState<{
        category: 'arts' | 'sciences' | '';
        choices: string[];
    }>({ category: '', choices: [] });
    const [countdown, setCountdown] = useState('');
    const [admissionStatus, setAdmissionStatus] = useState<'coming' | 'open' | 'closed'>('closed');
    const [isCameraOn, setIsCameraOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const [viewingStatusFor, setViewingStatusFor] = useState<CompletedAdmission | null>(null);
    const [statusCheckIndex, setStatusCheckIndex] = useState('');
    const [selfIndex, setSelfIndex] = useState('');

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [statusViewAlert, setStatusViewAlert] = useState('');
    
    const stopCamera = () => setIsCameraOn(false);

    const getSlipLevel = (slipData: UnebPassSlip | ExtractedUnebSlipData): 'P.L.E' | 'U.C.E' | 'U.A.C.E' | 'UNKNOWN' => {
        if ('level' in slipData) {
            return slipData.level;
        }
        if ('examinationType' in slipData) {
            const type = slipData.examinationType.toUpperCase();
            if (type.includes('ADVANCED')) return 'U.A.C.E';
            if (type.includes('PRIMARY')) return 'P.L.E';
            if (type.includes('EDUCATION')) return 'U.C.E'; 
        }
        return 'UNKNOWN';
    };

    const validateSlipForClass = (slipData: UnebPassSlip | ExtractedUnebSlipData, targetClass: string): string | null => {
        const slipLevel = getSlipLevel(slipData);
        const targetClassNormalized = targetClass.toUpperCase().replace(/[\s.-]/g, '');

        if (slipLevel === 'UNKNOWN') {
            return "Could not determine the examination level from the pass slip.";
        }

        if (slipLevel === 'U.A.C.E') {
            return "U.A.C.E. results cannot be used for admission into S.1 - S.6. Please use P.L.E. or U.C.E. results.";
        }

        if (['S1', 'S2', 'S3', 'S4'].includes(targetClassNormalized)) {
            if (slipLevel !== 'P.L.E') {
                return `Invalid pass slip for ${targetClass}. Admission to O-Level classes requires P.L.E results.`;
            }
        } else if (['S5', 'S6'].includes(targetClassNormalized)) {
            if (slipLevel !== 'U.C.E') {
                return `Invalid pass slip for ${targetClass}. Admission to A-Level classes requires U.C.E results.`;
            }
        }
        
        return null; // Validation passes
    };
    
    const resetState = () => {
        setError(''); setIsLoading(false); setProgress(null);
        setDataForVerification(null); setIsVerified(false); setEditableData(null); setIsEditingData(false);
        setAL