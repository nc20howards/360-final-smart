// components/StudentPage.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: Added missing type imports
import { User, Module, ExtractedUnebSlipData, UnebPassSlip, AdmissionSettings, AdminUser, School, CustomIdTemplate, CanteenShop, InternalExamResult, SchoolClass, StudentTransferProposal, TransferNegotiation, CompletedAdmission, SchoolALevelCombination, EWallet, UnebSubjectResult, StagedAdmission, StagedMarketplaceOrder, StagedCanteenOrder, MarketplaceListing, Receipt, ReceiptStatus, ChatAttachment, Place, Event } from '../types';
import { APP_TITLE } from '../constants';
import NotificationBell from './NotificationBell';
import { getAllSchools, getOpenMarketProposals, getProposalsForSchool, getNegotiationsForSchool, startOrGetNegotiation } from '../services/schoolService';
import { getAllModules, SMART_ADMISSION_MODULE_NAME, MESSAGE_MODULE_NAME, E_WALLET_MODULE_NAME, ONLINE_MODULE_NAME, SMART_STUDENT_ID_MODULE_NAME, E_CANTEEN_MODULE_NAME, NCHE_MODULE_NAME, STUDENT_TRANSFER_MODULE_NAME, NEWS_FEED_MODULE_NAME, E_VOTE_MODULE_NAME, MY_INSTITUTE_MODULE_NAME, VISITOR_CENTER_MODULE_NAME, KIOSK_MODE_MODULE_NAME, EXPLORATION_MODULE_NAME } from '../services/moduleService';
import * as settingsService from '../services/settingsService';
import { isUnebVerificationEnabled, getUnebOfficialLogo } from '../services/systemSettingsService';
// FIX: Added missing imports from apiService
import { extractTextFromImageWithGoogle, getNewsFromAI, getPlaceSuggestionsFromAI } from '../services/apiService';
import { findResultByIndex } from '../services/unebResultService';
import * as eWalletService from '../services/eWalletService';
import * as studentService from '../services/studentService';
import SocialHubPage from './SocialHubPage';
import MessagesPage from './MessagesPage';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import { heartbeat } from '../services/presenceService';
import * as groupService from '../services/groupService';
import EWalletPage from './EWalletPage';
import ProfilePage from './ProfilePage';
import { getHomePageContent } from '../services/homePageService';
// FIX: Changed import to be a named import as OnlineFeedPage is a named export in its file.
import { OnlineFeedPage } from './OnlineFeedPage';
import { SmartIdCard, SmartIdCardFront, SmartIdCardBack } from './SmartIdCard';
import * as smartIdService from '../services/smartIdService';
import CustomSmartIdCard, { CustomSmartIdCardDownloadable } from './CustomSmartIdCard';
import * as customIdTemplateService from '../services/customIdTemplateService';
import ECanteenStudentPage from './ECanteenStudentPage';
import StudentNcheView from './StudentNcheView';
import ReportCard from './ReportCard';
import * as classService from '../services/classService';
import KioskPage from './KioskPage';
import UserAvatar from './UserAvatar';
import StudentTransferMarketplace from './StudentTransferMarketplace';
import SchoolLandingPage from './SchoolLandingPage';
import * as chatService from '../services/chatService';
import EVoteStudentPage from './EVoteStudentPage';
import PinStrengthIndicator from './PinStrengthIndicator';
import MyInstituteStudentPage from './MyInstituteStudentPage';
import * as marketplaceService from '../services/marketplaceService';
import * as canteenService from '../services/canteenService';
// FIX: Added missing icon and component imports
import { DashboardIcon, ResultsIcon, GenericModuleIcon, SmartAdmissionIcon, EWalletIcon, OnlineIcon, IdCardIcon, CanteenIcon, NcheIcon, NewsIcon, HamburgerIcon, CloseIcon, VerifiedIcon, EditIcon, MessagesIcon, IconTrash, MinusIcon, PlusIcon, IconComposerPhoto, IconComposerVideo, IconComposerFile, IconLink, IconCopyLink, CartIcon, IconCalendar, IconLocation, KioskIcon, VotingIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';
import VisitorCenterStudentPage from './VisitorCenterStudentPage';


// Tell typescript html2canvas exists globally
declare var html2canvas: any;

// Helper function to fetch a cross-origin image and convert it to a data URL
const imageToDataUrl = (url: string): Promise<string> => {
    const proxyUrl = 'https://corsproxy.io/?';
    if (url.startsWith('data:')) {
        return Promise.resolve(url);
    }
    return fetch(proxyUrl + encodeURIComponent(url))
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch through proxy with status: ${response.status}`);
            return response.blob();
        })
        .then(fileBlob => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    // The result includes the data URL prefix, so we need to remove it
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject(new Error("Failed to read blob as Base64 string."));
                }
            };
            reader.onerror = reject;
            // FIX: Renamed 'blob' to 'fileBlob' to match the parameter name and avoid potential name collision.
            reader.readAsDataURL(fileBlob);
        }))
        .catch(error => {
            console.error(`Failed to load image via proxy for canvas conversion: ${url}`, error);
            // FIX: Corrected typo in base64 string (R00l -> R0l)
            return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        });
};


// --- News Feed View ---
const NewsFeedView: React.FC = () => {
    return <div>News Feed Placeholder</div>;
};

// --- Results Analytics Sub-component ---
const ResultsAnalytics: React.FC<{ results: InternalExamResult[] }> = ({ results }) => {
    return <div>Results Analytics Placeholder</div>;
};

// --- Student Transfer View Sub-component ---
const StudentTransferView: React.FC = () => {
    const [transfers, setTransfers] = useState<Array<CompletedAdmission & { fromSchoolId: string }>>([]);
    const [schools, setSchools] = useState<School[]>([]);

    useEffect(() => {
        setTransfers(settingsService.getAllTransfers());
        setSchools(getAllSchools());
    }, []);

    const getSchoolName = (id?: string) => schools.find(s => s.id === id)?.name || 'Unknown School';

    const getStatusBadge = (status?: string) => {
        switch(status) {
            case 'accepted_by_student': return <span className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs font-semibold">Accepted</span>;
            case 'rejected_by_student': return <span className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs font-semibold">Rejected</span>;
            case 'pending_student_approval': return <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs font-semibold">Pending</span>;
            default: return <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-300 text-xs font-semibold">{status ? status.replace(/_/g, ' ') : 'Unknown'}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Student Transfer History</h2>
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-700 text-gray-300 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Index Number</th>
                                <th className="px-6 py-4">Original School</th>
                                <th className="px-6 py-4">Transferred To</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {transfers.length > 0 ? transfers.map(t => {
                                const name = 'candidateName' in t.data ? t.data.candidateName : t.data.name;
                                const index = 'indexNumber' in t.data ? t.data.indexNumber : t.data.indexNo;
                                return (
                                    <tr key={t.id} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">{name}</td>
                                        <td className="px-6 py-4 text-gray-400 font-mono text-sm">{index}</td>
                                        <td className="px-6 py-4 text-gray-300">{getSchoolName(t.fromSchoolId)}</td>
                                        <td className="px-6 py-4 text-cyan-400">{getSchoolName(t.transferToSchoolId)}</td>
                                        <td className="px-6 py-4">{getStatusBadge(t.transferStatus || t.status)}</td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No transfers recorded.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Student Results View Sub-component ---
interface StudentResultsViewProps {
    user: User;
    onDownload: (result: InternalExamResult) => void;
    isDownloading: boolean;
}
function StudentResultsView({ user, onDownload, isDownloading }: StudentResultsViewProps) {
    const sortedExams = useMemo(() => {
        return [...(user.internalExams || [])].sort((a, b) => b.term.localeCompare(a.term));
    }, [user.internalExams]);

    const [selectedResult, setSelectedResult] = useState<InternalExamResult | null>(sortedExams.length > 0 ? sortedExams[0] : null);

    if (sortedExams.length === 0) {
        return (
            <div className="text-center p-8 bg-gray-800 rounded-lg">
                <h3 className="text-xl font-bold">No Results Found</h3>
                <p className="text-gray-400 mt-2">Your academic reports will appear here once they are published by your teachers.</p>
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">My Results</h2>
                    <p className="text-gray-400 mt-1">View and download your termly report cards.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold mb-3">Available Reports</h3>
                    <div className="space-y-2">
                        {sortedExams.map(result => (
                            <button
                                key={result.term}
                                onClick={() => setSelectedResult(result)}
                                className={`w-full text-left p-3 rounded-md transition-colors ${selectedResult?.term === result.term ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                            >
                                {result.term}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-3">
                    {selectedResult ? (
                        <div className="bg-gray-800 p-6 rounded-lg">
                             <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-cyan-400">{selectedResult.term} Report</h3>
                                    <p className="text-gray-400">Class Position: <strong>{selectedResult.classPosition}</strong> | Average: <strong>{selectedResult.average.toFixed(1)}%</strong></p>
                                </div>
                                <button
                                    onClick={() => onDownload(selectedResult)}
                                    disabled={isDownloading}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-semibold disabled:opacity-50"
                                >
                                    {isDownloading ? 'Downloading...' : 'Download'}
                                </button>
                            </div>
                            <table className="min-w-full">
                                <thead className="bg-gray-700/50">
                                    <tr>
                                        <th className="p-3 text-left">Subject</th>
                                        <th className="p-3 text-center">Score</th>
                                        <th className="p-3 text-center">Grade</th>
                                        <th className="p-3 text-left">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedResult.subjects.map(sub => (
                                        <tr key={sub.name} className="border-b border-gray-700">
                                            <td className="p-3 font-semibold">{sub.name}</td>
                                            <td className="p-3 text-center">{sub.score}%</td>
                                            <td className="p-3 text-center font-bold">{sub.grade}</td>
                                            <td className="p-3 text-gray-400 italic">{sub.remarks || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>Select a report to view details.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

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
        setALevelSelection({ category: '', choices: [] });
        if (isCameraOn) stopCamera();
    };

    const handleProcessImage = async (dataUrl: string) => {
        resetState(); setProgress(0); setIsLoading(true);
        const interval = setInterval(() => setProgress(p => (p ? Math.min(95, p + 5) : 5)), 300);
        try {
            const base64Image = dataUrl.split(',')[1];
            const mimeType = dataUrl.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
            const data = await extractTextFromImageWithGoogle(base64Image, mimeType);

            if (isUnebVerificationEnabled()) {
                const resultSlip = findResultByIndex(data.indexNumber);
                if (!resultSlip) {
                    clearInterval(interval);
                    setProgress(null);
                    setError("Index number not available! Check it well and try again.");
                    setIsLoading(false);
                    return;
                }
            }

            const validationError = validateSlipForClass(data, selectedTargetClass);
            if (validationError) {
                clearInterval(interval);
                setProgress(null);
                setError(validationError);
                setIsLoading(false);
                return;
            }
            
            const indexNumber = data.indexNumber;
            if (settingsService.hasAdmissionBeenSubmitted(indexNumber, school.id)) {
                setStatusViewAlert("Already Applied for Admission. Check your index number to see the application progress.");
                const admission = settingsService.getAdmissionForStudent(indexNumber, school.id);
                if (admission) {
                    setViewingStatusFor(admission);
                }
                clearInterval(interval);
                setProgress(null);
                setIsLoading(false);
                return;
            }

            if (isUnebVerificationEnabled() && findResultByIndex(data.indexNumber)) {
                setIsVerified(true);
            }
            clearInterval(interval); setProgress(100);
            setTimeout(() => {
                setDataForVerification(data); setEditableData(data); setProgress(null); setIsLoading(false);
            }, 500);
        } catch (err) {
            clearInterval(interval); setProgress(null);
            setError(err instanceof Error ? err.message : 'Failed to extract text from image.');
            setIsLoading(false);
        }
    };

    const handleIndexLookup = (index: string) => {
        resetState();
        if (!index.trim()) return setError("Please enter an index number.");
        setIsLoading(true);

        if (settingsService.hasAdmissionBeenSubmitted(index.trim(), school.id)) {
            setStatusViewAlert("Already Applied for Admission. Check your index number to see the application progress.");
            const admission = settingsService.getAdmissionForStudent(index.trim(), school.id);
            if (admission) {
                setViewingStatusFor(admission);
            }
            setIsLoading(false);
            return;
        }

        setTimeout(() => {
            try {
                const resultSlip = findResultByIndex(index.trim());
                if (resultSlip) {
                    const validationError = validateSlipForClass(resultSlip, selectedTargetClass);
                    if (validationError) {
                        setError(validationError);
                        setIsLoading(false);
                        return;
                    }
                    if (isUnebVerificationEnabled()) { setIsVerified(true); }
                    setDataForVerification(resultSlip); setEditableData(null);
                } else {
                    setError("Index number not available! Check it well and try again.");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "An unexpected error occurred during lookup.");
            }
            setIsLoading(false);
        }, 500);
    };

    const submitApplication = () => {
        try {
            if (!dataForVerification) throw new Error("No data to submit.");
            if (!gender) throw new Error("Gender must be selected.");
            if (isNewUserFlow && onAdmissionSuccess) {
                const creds = studentService.createTemporaryUserFromAdmission(dataForVerification!, school.id, gender);
                settingsService.addCompletedAdmission(creds.studentId, dataForVerification!, school.id, selectedTargetClass, aLevelSelection.choices, false, gender);
                onAdmissionSuccess(creds);
            } else if (user) {
                const submittedAdmission = settingsService.addCompletedAdmission(user.studentId, dataForVerification!, school.id, selectedTargetClass, aLevelSelection.choices, false, gender);
                setViewingStatusFor(submittedAdmission);
            }
            onStagedDataConsumed?.();
            setDataForVerification(null);
        } catch(err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during submission.');
            throw err;
        }
    };
    
    const handlePaymentConfirmed = () => {
        if (!dataForVerification || !user || !settings) return;
        setPinError('');
        try {
            eWalletService.verifyPin(user.studentId, pin);
            eWalletService.processAdmissionFeePayment(user.studentId, school.id, settings.admissionFee);
            submitApplication();
            setIsPaymentModalOpen(false);
        } catch(err) {
            setPinError((err as Error).message);
        }
    };
    
    const handleDetailsCorrect = () => {
        if (!dataForVerification || !settings) return;
        setError('');
        
        if (!gender) {
            setError("Please select the applicant's gender.");
            return;
        }
        
        if (isUnebVerificationEnabled() && !isVerified) {
            setError("This application cannot be submitted because the UNEB results could not be verified.");
            return;
        }
        
        const isALevelApplication = ['S.5', 'S.6'].includes(selectedTargetClass);
        if (isALevelApplication && aLevelSelection.choices.length === 0) {
            setError("Please select at least one A-Level combination choice.");
            return;
        }

        const indexNo = 'indexNumber' in dataForVerification ? dataForVerification.indexNumber : dataForVerification.indexNo;
        if (settingsService.hasAdmissionBeenSubmitted(indexNo, school.id)) {
            setError(`An application for index number ${indexNo} has already been submitted.`);
            const admission = settingsService.getAdmissionForStudent(indexNo, school.id);
            if(admission) setViewingStatusFor(admission);
            return;
        }

        if (isNewUserFlow) {
            submitApplication();
        } else if (user) {
            const wallet = eWalletService.getWalletForUser(user.studentId);
            if (wallet.balance >= settings.admissionFee) {
                setWalletBalance(wallet.balance);
                setIsPaymentModalOpen(true);
            } else {
                onAdmissionStaged?.({
                    data: dataForVerification,
                    targetClass: selectedTargetClass,
                    gender: gender,
                    aLevelCombinationChoices: aLevelSelection.choices,
                });
            }
        }
    };
    
    const handleFieldChange = (field: keyof ExtractedUnebSlipData, value: string) => { if (editableData) setEditableData({ ...editableData, [field]: value }); };
    
    const handleSubjectChange = (index: number, field: keyof UnebSubjectResult, value: string) => { 
        if (editableData) { 
            const newSubjects = [...editableData.subjects];
            (newSubjects[index] as any)[field] = value;
            setEditableData({ ...editableData, subjects: newSubjects });
        } 
    };

    const handleCombinationToggle = (comboName: string) => {
        setALevelSelection(prev => {
            const newChoices = prev.choices.includes(comboName)
                ? prev.choices.filter(c => c !== comboName)
                : [...prev.choices, comboName];
            return { ...prev, choices: newChoices };
        });
    };

    const handleSaveEdits = () => {
        if(editableData) {
            setDataForVerification(editableData);
        }
        setIsEditingData(false);
    };

    const renderVerificationView = () => {
        if (!dataForVerification || !settings) return null;
        
        const unebLogoUrl = getUnebOfficialLogo();
        const slip = isEditingData ? editableData : dataForVerification;
        if (!slip) return null;

        const isExtracted = 'candidateName' in slip;

        // Normalize data for display or editing
        const displayData = {
            yearOfExamination: isExtracted ? slip.yearOfExamination : slip.year,
            examinationType: isExtracted ? slip.examinationType : `UGANDA CERTIFICATE OF ${slip.level.replace(/\./g, '')}`,
            slipSerialNumber: isExtracted ? slip.slipSerialNumber : 'N/A',
            candidateName: isExtracted ? slip.candidateName : slip.name,
            schoolName: isExtracted ? slip.schoolName : slip.schoolName || 'N/A',
            centerNumber: isExtracted ? slip.centerNumber : 'N/A',
            indexNumber: isExtracted ? slip.indexNumber : slip.indexNo,
            entryCode: isExtracted ? slip.entryCode : slip.entryCode || 'N/A',
            dateOfBirth: isExtracted ? slip.dateOfBirth : slip.dateOfBirth || 'N/A',
            schoolAddress: isExtracted ? slip.schoolAddress : slip.schoolAddress || 'N/A',
            subjects: isExtracted ? slip.subjects : slip.subjects.map(s => ({ subjectNumber: 'N/A', subjectName: s.name, gradeNumber: s.grade, gradeWord: 'N/A' })),
            gradeAggregate: isExtracted ? slip.gradeAggregate : slip.aggregate || 'N/A',
            overallResult: isExtracted ? slip.overallResult : slip.result || 'N/A',
            note: isExtracted ? slip.note : 'N/A',
        };

        const isALevelApplication = ['S.5', 'S.6'].includes(selectedTargetClass);
        const slipLevel = getSlipLevel(slip);
        const shouldShowCombinations = isALevelApplication && slipLevel === 'U.C.E';
        
        return <div className="bg-gray-800 p-4 sm:p-6 rounded-lg space-y-6">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-white">Verify Your Details</h3>
                {isExtracted && !isEditingData && <button onClick={() => setIsEditingData(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold text-sm"><EditIcon /> Edit</button>}
                {isEditingData && <div className="flex gap-2"><button onClick={() => setIsEditingData(false)} className="px-4 py-2 bg-gray-600 text-sm rounded">Cancel</button><button onClick={handleSaveEdits} className="px-4 py-2 bg-cyan-600 text-sm rounded">Save</button></div>}
            </div>
            {isVerified && <div className="flex items-center space-x-2 bg-green-500/20 text-green-300 p-3 rounded-lg font-semibold"><VerifiedIcon /><span>Result Verified with UNEB Database</span></div>}

            {/* Pass Slip UI */}
            <div className="border-2 border-gray-600 p-4 rounded-lg bg-gray-900/50 font-mono text-sm text-white">
                <div className="text-center border-b-2 border-gray-600 pb-2 mb-4">
                    <img src={unebLogoUrl} alt="UNEB Logo" className="w-12 h-12 mx-auto mb-2 rounded-full" />
                    {isEditingData ? <input value={displayData.examinationType} onChange={e => handleFieldChange('examinationType', e.target.value)} className="font-bold text-lg text-white bg-gray-700 text-center w-full"/> : <h4 className="font-bold text-lg text-white">{displayData.examinationType}</h4>}
                    <div className="flex justify-center gap-4">
                        <p>YEAR: {isEditingData ? <input value={displayData.yearOfExamination} onChange={e => handleFieldChange('yearOfExamination', e.target.value)} className="bg-gray-700 w-24 text-center"/> : displayData.yearOfExamination}</p>
                        <p>S/N: {isEditingData ? <input value={displayData.slipSerialNumber} onChange={e => handleFieldChange('slipSerialNumber', e.target.value)} className="bg-gray-700 w-24 text-center"/> : displayData.slipSerialNumber}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-4">
                    <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">NAME:</span> {isEditingData ? <input value={displayData.candidateName} onChange={e => handleFieldChange('candidateName', e.target.value)} className="bg-gray-700 w-full"/> : displayData.candidateName}</div>
                    <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">SCHOOL:</span> {isEditingData ? <input value={displayData.schoolName} onChange={e => handleFieldChange('schoolName', e.target.value)} className="bg-gray-700 w-full"/> : displayData.schoolName}</div>
                    <div><span className="font-semibold text-white/70">CENTER:</span> {isEditingData ? <input value={displayData.centerNumber} onChange={e => handleFieldChange('centerNumber', e.target.value)} className="bg-gray-700 w-full"/> : displayData.centerNumber}</div>
                    <div><span className="font-semibold text-white/70">INDEX:</span> {isEditingData ? <input value={displayData.indexNumber} onChange={e => handleFieldChange('indexNumber', e.target.value)} className="bg-gray-700 w-full"/> : displayData.indexNumber}</div>
                    <div><span className="font-semibold text-white/70">ENTRY:</span> {isEditingData ? <input value={displayData.entryCode} onChange={e => handleFieldChange('entryCode', e.target.value)} className="bg-gray-700 w-full"/> : displayData.entryCode}</div>
                    <div><span className="font-semibold text-white/70">D.O.B:</span> {isEditingData ? <input value={displayData.dateOfBirth} onChange={e => handleFieldChange('dateOfBirth', e.target.value)} className="bg-gray-700 w-full"/> : displayData.dateOfBirth}</div>
                    <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-white/70">ADDRESS:</span> {isEditingData ? <input value={displayData.schoolAddress} onChange={e => handleFieldChange('schoolAddress', e.target.value)} className="bg-gray-700 w-full"/> : displayData.schoolAddress}</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-600 text-left min-w-[500px]">
                        <thead><tr className="bg-gray-700 text-white"><th className="p-2 border border-gray-600">NO.</th><th className="p-2 border border-gray-600">SUBJECT</th><th className="p-2 border border-gray-600 text-center">GRADE</th><th className="p-2 border border-gray-600">GRADE IN WORDS</th></tr></thead>
                        <tbody>{displayData.subjects.map((s, i) => <tr key={i}><td className="p-2 border border-gray-600">{isEditingData ? <input value={s.subjectNumber} onChange={e => handleSubjectChange(i, 'subjectNumber', e.target.value)} className="bg-gray-700 w-16"/> : s.subjectNumber}</td><td className="p-2 border border-gray-600">{isEditingData ? <input value={s.subjectName} onChange={e => handleSubjectChange(i, 'subjectName', e.target.value)} className="bg-gray-700 w-full"/> : s.subjectName}</td><td className="p-2 border border-gray-600 text-center">{isEditingData ? <input value={s.gradeNumber} onChange={e => handleSubjectChange(i, 'gradeNumber', e.target.value)} className="bg-gray-700 w-12 text-center"/> : s.gradeNumber}</td><td className="p-2 border border-gray-600">{isEditingData ? <input value={s.gradeWord} onChange={e => handleSubjectChange(i, 'gradeWord', e.target.value)} className="bg-gray-700 w-full"/> : displayData.subjects[i].gradeWord}</td></tr>)}</tbody>
                    </table>
                </div>
                <div className="mt-4"><p><span className="font-semibold text-white/70">RESULT:</span> {isEditingData ? <input value={displayData.overallResult} onChange={e => handleFieldChange('overallResult', e.target.value)} className="bg-gray-700"/> : displayData.overallResult}, <span className="font-semibold text-white/70">AGG:</span> {isEditingData ? <input value={displayData.gradeAggregate} onChange={e => handleFieldChange('gradeAggregate', e.target.value)} className="bg-gray-700 w-24"/> : displayData.gradeAggregate}</p></div>
                <div className="border-t-2 border-gray-600 pt-2 mt-4"><p className="text-xs italic text-white/70">{isEditingData ? <input value={displayData.note} onChange={e => handleFieldChange('note', e.target.value)} className="bg-gray-700 w-full"/> : displayData.note}</p></div>
            </div>
            
            <div className="border-t border-gray-600 pt-4 space-y-4">
                <h4 className="font-semibold text-white">Applicant's Gender</h4>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-700 rounded-md">
                        <input
                            type="radio"
                            name="gender"
                            value="Male"
                            checked={gender === 'Male'}
                            onChange={() => setGender('Male')}
                            className="form-radio h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 focus:ring-cyan-500"
                        />
                        <span>Male</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-700 rounded-md">
                        <input
                            type="radio"
                            name="gender"
                            value="Female"
                            checked={gender === 'Female'}
                            onChange={() => setGender('Female')}
                            className="form-radio h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 focus:ring-cyan-500"
                        />
                        <span>Female</span>
                    </label>
                </div>
            </div>
            
            {shouldShowCombinations && (
                <div className="border-t border-gray-600 pt-4 space-y-4">
                    <h4 className="font-semibold text-white">A'Level Combination Choice(s)</h4>
                    <p className="text-sm text-gray-400">Select a category, then choose one or more combinations you are interested in.</p>
                    
                    <div className="flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setALevelSelection({ category: 'sciences', choices: [] })}
                            className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${aLevelSelection.category === 'sciences' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                        >
                            Sciences
                        </button>
                        <button 
                            type="button"
                            onClick={() => setALevelSelection({ category: 'arts', choices: [] })}
                            className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${aLevelSelection.category === 'arts' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                        >
                            Arts
                        </button>
                    </div>

                    {aLevelSelection.category && (settings.aLevelCombinations[aLevelSelection.category] || []).length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded-md">
                            {(settings.aLevelCombinations[aLevelSelection.category] || []).map(combo => (
                                <label key={combo.id} className="flex items-start p-3 bg-gray-700 rounded-md cursor-pointer hover:bg-gray-600">
                                    <input 
                                        type="checkbox"
                                        checked={aLevelSelection.choices.includes(combo.name)}
                                        onChange={() => handleCombinationToggle(combo.name)}
                                        className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded mt-1 flex-shrink-0"
                                    />
                                    <div className="ml-3">
                                        <span className="font-bold text-white">{combo.name}</span>
                                        <p className="text-xs text-gray-400">{combo.subjects}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-600"><button onClick={() => { resetState(); setSelfAdmissionTab('scan'); }} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Re-enter Details</button><button onClick={handleDetailsCorrect} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Details are Correct</button></div>
        </div>;
    };


    const handleSlipScanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => handleProcessImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const startCamera = async () => {
        resetState();
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevs = devices.filter(d => d.kind === 'videoinput');
            if (videoDevs.length > 0) {
                setVideoDevices(videoDevs);
                setSelectedDeviceId(videoDevs[0].deviceId);
                setIsCameraOn(true);
            } else { setError("No camera found on this device."); }
        } catch (err) { setError("Could not access camera. Please grant permission."); }
    };

    const switchCamera = () => { if (videoDevices.length > 1) { const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId); const nextIndex = (currentIndex + 1) % videoDevices.length; setSelectedDeviceId(videoDevices[nextIndex].deviceId); } };
    const captureImage = () => { if (videoRef.current) { const canvas = document.createElement('canvas'); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); handleProcessImage(canvas.toDataURL('image/jpeg')); stopCamera(); } };
    const handleCheckStatus = (e: React.FormEvent) => { e.preventDefault(); setError(''); const admission = settingsService.getAdmissionForStudent(statusCheckIndex, school.id); if (admission) { setViewingStatusFor(admission); setStatusCheckIndex(''); } else { setError(`No application found for Student/Index Number: ${statusCheckIndex}`); } };

    const admissionStatusColors = { coming: 'border-yellow-500 text-yellow-300', open: 'border-green-500 text-green-300 animate-pulse-custom', closed: 'border-red-500 text-red-400' };

    const admissionSettings = useMemo(() => settingsService.getAdmissionSettings(school.id), [school.id]);

    useEffect(() => {
        setSettings(admissionSettings);
        
        if (user) {
            const existingAdmission = settingsService.getAdmissionForStudent(user.studentId, school.id);
            if (existingAdmission) {
                setViewingStatusFor(existingAdmission);
            }
        }

        if (stagedData) {
            setDataForVerification(stagedData.data);
            setSelectedTargetClass(stagedData.targetClass);
            setGender(stagedData.gender);
            
            // Infer category based on first choice to restore UI state
            const sciences = settings?.aLevelCombinations.sciences.map(c => c.name) || [];
            const arts = settings?.aLevelCombinations.arts.map(c => c.name) || [];
            let category: 'arts' | 'sciences' | '' = '';
            if (stagedData.aLevelCombinationChoices && stagedData.aLevelCombinationChoices.length > 0) {
                const firstChoice = stagedData.aLevelCombinationChoices[0];
                if (sciences.includes(firstChoice)) {
                    category = 'sciences';
                } else if (arts.includes(firstChoice)) {
                    category = 'arts';
                }
            }

            setALevelSelection({
                category: category,
                choices: stagedData.aLevelCombinationChoices || []
            });


            if (user && admissionSettings) {
                const currentWallet = eWalletService.getWalletForUser(user.studentId);
                if (currentWallet.balance >= admissionSettings.admissionFee) {
                    setWalletBalance(currentWallet.balance);
                    setIsPaymentModalOpen(true);
                } else {
                    setError("Your balance is still insufficient. Please top up more funds in your E-Wallet.");
                }
            }
        }
    }, [school.id, user, stagedData, settings, admissionSettings]);

    useEffect(() => {
        if (!settings?.startDate || !settings?.endDate) {
            setAdmissionStatus('closed');
            setCountdown('Dates not set.');
            return;
        }

        const start = new Date(settings.startDate + 'T00:00:00').getTime();
        const endDateObj = new Date(settings.endDate + 'T00:00:00');
        endDateObj.setHours(23, 59, 59, 999);
        const end = endDateObj.getTime();
        
        const interval = setInterval(() => {
            const now = Date.now();
            let targetTime: number;

            if (now < start) {
                setAdmissionStatus('coming');
                targetTime = start;
            } else if (now >= start && now <= end) {
                setAdmissionStatus('open');
                targetTime = end;
            } else {
                setAdmissionStatus('closed');
                setCountdown('Admission period has ended.');
                clearInterval(interval);
                return;
            }
            const diff = targetTime - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [settings]);
    
    useEffect(() => {
        let stream: MediaStream | null = null;
        const videoElement = videoRef.current;
        if (isCameraOn && videoElement && selectedDeviceId) {
            navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedDeviceId } } })
                .then(s => {
                    stream = s;
                    videoElement.srcObject = stream;
                    videoElement.play().catch(e => console.error("Video play failed:", e));
                })
                .catch(err => {
                    setError("Could not access camera. Please check permissions and ensure it's not in use by another app.");
                    setIsCameraOn(false);
                });
        }
        return () => stream?.getTracks().forEach(track => track.stop());
    }, [isCameraOn, selectedDeviceId]);

    const renderApplicationStatusView = () => {
        if (!viewingStatusFor) return null;
    
        const handleTransferResponse = (response: 'accepted_by_student' | 'rejected_by_student') => {
            if (!user) return;
            const fromSchoolId = school.id;
            if (!fromSchoolId) {
                setStatusViewAlert("Critical error: Could not find the original school for this transfer.");
                return;
            }
            
            settingsService.respondToTransferOffer(viewingStatusFor.id, fromSchoolId, response);
            
            if (response === 'accepted_by_student' && viewingStatusFor.transferToSchoolId) {
                // FIX: Check if current user is temporary (self-applicant) or active (helper)
                if (user.accountStatus === 'temporary') {
                    studentService.transferStudent(user.studentId, viewingStatusFor.transferToSchoolId);
                    setStatusViewAlert("Transfer accepted! You are now part of the new school. Please log out and log in again to see your new portal.");
                } else {
                    // Existing student helping another -> Create new account for the applicant
                    const { studentId, tempPass } = studentService.createSchoolUserFromAdmission(viewingStatusFor, viewingStatusFor.transferToSchoolId);
                    setStatusViewAlert(`Transfer accepted! A new account has been created for the applicant at the new school.\n\nNew Student ID: ${studentId}\nPassword: ${tempPass}\n\nPlease write these down.`);
                }
            }
            // Refresh the view to show the new status
            const updatedAdmission = settingsService.getAdmissionForStudent(viewingStatusFor.applicantId, fromSchoolId);
            setViewingStatusFor(updatedAdmission);
        };
        
        if (statusViewAlert) {
            return (
                <div className="bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in-up text-center">
                    <div className="bg-green-500/20 text-green-300 p-4 rounded-lg whitespace-pre-wrap">{statusViewAlert}</div>
                    <div className="text-center mt-6">
                        <button onClick={() => { setViewingStatusFor(null); setStatusViewAlert(''); }} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Close</button>
                    </div>
                </div>
            );
        }
    
        // Priority 1: Check for a pending transfer offer.
        if (viewingStatusFor.transferStatus === 'pending_student_approval' && viewingStatusFor.transferToSchoolId) {
            const offeringSchool = getAllSchools().find(s => s.id === viewingStatusFor.transferToSchoolId);
            return (
                <div className="bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in-up text-center">
                    <h3 className="text-2xl font-bold text-cyan-400 mb-4">Student Transfer Offer</h3>
                    <p className="text-gray-300 mb-6">
                        You have received a transfer offer from <strong className="text-white">{offeringSchool?.name || 'an unknown school'}</strong>.
                        Do you wish to accept this transfer? Your account will be moved to the new school.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => handleTransferResponse('rejected_by_student')} className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold">
                            Reject Offer
                        </button>
                        <button onClick={() => handleTransferResponse('accepted_by_student')} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold">
                            Accept Transfer
                        </button>
                    </div>
                </div>
            );
        }
        
        // Priority 2: Check for a completed transfer decision.
        if (viewingStatusFor.transferStatus === 'accepted_by_student' || viewingStatusFor.transferStatus === 'rejected_by_student') {
            const offeringSchool = getAllSchools().find(s => s.id === viewingStatusFor.transferToSchoolId);
            return (
                <div className="bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in-up text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">Transfer Offer Responded</h3>
                    {viewingStatusFor.transferStatus === 'accepted_by_student' ? (
                        <p className="text-green-300">You have accepted the transfer to {offeringSchool?.name}. If this is not your current school, please log out and log back in to access the new portal.</p>
                    ) : (
                        <p className="text-red-300">You have rejected the transfer offer from {offeringSchool?.name}.</p>
                    )}
                    <div className="text-center mt-6">
                        <button onClick={() => setViewingStatusFor(null)} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Close</button>
                    </div>
                </div>
            );
        }
    
        // Priority 3: Default application status progress bar.
        const steps = ['Submitted', 'Under Review', 'Decision Made'];
        let currentStep = 0;
        if (viewingStatusFor.status === 'under_review') currentStep = 1;
        else if (['approved', 'rejected', 'transferred'].includes(viewingStatusFor.status)) currentStep = 2;
    
        const studentName = 'candidateName' in viewingStatusFor.data ? viewingStatusFor.data.candidateName : viewingStatusFor.data.name;
    
        return (
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in-up">
                <h3 className="text-2xl font-bold text-white text-center mb-2">Application Status</h3>
                <p className="text-gray-400 text-center mb-8">For: {studentName}</p>
    
                <div className="flex items-center w-full max-w-md mx-auto mb-8">
                    {steps.map((step, index) => (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors duration-300 ${index <= currentStep ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    {index < currentStep ? '✓' : index + 1}
                                </div>
                                <p className={`text-xs mt-2 font-semibold ${index <= currentStep ? 'text-white' : 'text-gray-400'}`}>{step}</p>
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`flex-1 h-1 transition-colors duration-300 ${index < currentStep ? 'bg-cyan-500' : 'bg-gray-700'}`}></div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
    
                <div className="text-center bg-gray-700 p-6 rounded-lg">
                    {viewingStatusFor.status === 'under_review' && <p className="text-yellow-300">Your application is currently being reviewed by the school administration.</p>}
                    {viewingStatusFor.status === 'approved' && <p className="text-green-300 font-bold text-lg">Congratulations! Your application has been approved.</p>}
                    {viewingStatusFor.status === 'rejected' && <p className="text-red-300 font-bold text-lg">We regret to inform you that your application was not successful at this time.</p>}
                    {viewingStatusFor.status === 'transferred' && <p className="text-blue-300 font-bold text-lg">This application has been processed for a school transfer.</p>}
                </div>
                <div className="text-center mt-6">
                    <button onClick={() => setViewingStatusFor(null)} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Close</button>
                </div>
            </div>
        );
    };

    if (viewingStatusFor) return renderApplicationStatusView();
    
    return <div>
        {isPaymentModalOpen && settings && (
            <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4 text-center">
                    <h3 className="text-xl font-bold">Confirm Payment</h3>
                    <p className="text-sm text-gray-400">Please enter your E-Wallet PIN to confirm the admission fee payment.</p>
                    <div className="bg-gray-700 p-4 rounded-lg space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-gray-400">Amount Due:</span><strong>UGX {settings.admissionFee.toLocaleString()}</strong></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-400">Your Balance:</span><span>UGX {walletBalance?.toLocaleString()}</span></div>
                    </div>
                    <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} className="w-full p-3 text-2xl tracking-[1rem] text-center bg-gray-900 rounded-md" />
                    <PinStrengthIndicator pin={pin} />
                    {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
                    <div className="flex justify-center gap-2 pt-2">
                        <button onClick={() => { setIsPaymentModalOpen(false); setPin(''); setPinError(''); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                        <button onClick={handlePaymentConfirmed} className="px-4 py-2 bg-cyan-600 rounded">Confirm</button>
                    </div>
                </div>
            </div>
        )}
        <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-white">Smart Admission Portal</h2><button onClick={onBack} className="text-sm px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold">&larr; Back</button></header>
        <div className={`bg-gray-800 border-l-8 ${admissionStatusColors[admissionStatus]} rounded-lg shadow-xl p-6 sm:p-8 mb-8`}><div className="flex flex-col sm:flex-row justify-between items-center gap-6"><div className="text-center sm:text-left"><p className={`font-bold text-2xl sm:text-3xl uppercase tracking-wider ${admissionStatusColors[admissionStatus]}`}>Admission {admissionStatus}</p><p className="text-gray-300 text-lg mt-2">{admissionStatus === 'coming' ? 'Opens in:' : admissionStatus === 'open' ? 'Closes in:' : ''} <span className="font-mono font-bold text-xl">{countdown}</span></p></div>{settings && settings.acceptingClasses.length > 0 && (<div className="text-center sm:text-right bg-gray-900/50 p-4 rounded-lg"><p className="font-semibold text-gray-300">Accepting Applications For:</p><p className="text-cyan-400 text-lg font-bold">{settings.acceptingClasses.join(', ')}</p></div>)}</div></div>
        
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">{admissionStatus === 'closed' ? (<div className="text-center py-8"><p className="text-yellow-400 font-semibold mb-6">The admission period is currently closed. You can check your application status below.</p></div>) : !selectedTargetClass ? (<div className="space-y-4"><h3 className="font-bold text-lg text-white">Step 1: Select Class</h3><select value={selectedTargetClass} onChange={e => setSelectedTargetClass(e.target.value)} className="w-full max-w-sm p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"><option value="">-- Select Class to Apply For --</option>{settings?.acceptingClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>) : dataForVerification ? (renderVerificationView()) : isLoading ? (<div className="text-center p-8"><p className="mb-4">Processing...</p><div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-cyan-600 h-2.5 rounded-full" style={{ width: `${progress || 0}%` }}></div></div></div>) : error ? (<div className="bg-red-500/20 text-red-300 p-4 rounded-lg">{error} <button onClick={resetState} className="ml-4 font-bold underline">Try again</button></div>) : (<div className="space-y-4"><h3 className="font-bold text-lg text-white">Step 2: Provide Your Results</h3><div className="flex items-center gap-2 p-1 bg-gray-900 rounded-lg"><button onClick={() => { resetState(); setSelfAdmissionTab('scan'); }} className={`w-full py-2 text-sm font-semibold rounded-md ${selfAdmissionTab === 'scan' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Scan Pass Slip</button>{isUnebVerificationEnabled() && (<button onClick={() => { resetState(); setSelfAdmissionTab('index'); }} className={`w-full py-2 text-sm font-semibold rounded-md ${selfAdmissionTab === 'index' ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}>Use Index Number</button>)}</div>{selfAdmissionTab === 'scan' && (<div className="space-y-4 pt-4">{!isCameraOn ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><button onClick={startCamera} className="flex flex-col items-center justify-center p-6 bg-gray-700 hover:bg-gray-600 rounded-lg border-2 border-dashed border-gray-500"><svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span>Use Camera</span></button><label htmlFor="slip-upload" className="cursor-pointer flex flex-col items-center justify-center p-6 bg-gray-700 hover:bg-gray-600 rounded-lg border-2 border-dashed border-gray-500"><svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg><span>Upload File</span></label><input id="slip-upload" type="file" className="hidden" accept="image/*" onChange={handleSlipScanUpload} /></div>) : (<div className="text-center space-y-4"><video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-gray-900" /><div className="flex justify-center gap-4"><button onClick={captureImage} className="px-6 py-2 bg-cyan-600 rounded-lg">Capture</button>{videoDevices.length > 1 && <button onClick={switchCamera} className="px-4 py-2 bg-gray-600 rounded-lg">Switch Camera</button>}<button onClick={stopCamera} className="px-4 py-2 bg-red-600 rounded-lg">Cancel</button></div></div>)}</div>)}{selfAdmissionTab === 'index' && (<form onSubmit={(e) => { e.preventDefault(); handleIndexLookup(selfIndex); }} className="space-y-4 pt-4"><label htmlFor="selfIndex" className="block text-gray-300">UNEB Index Number</label><input id="selfIndex" value={selfIndex} onChange={e => setSelfIndex(e.target.value)} placeholder="e.g., UXXXX/XXX" required className="w-full max-w-sm px-4 py-2 text-white bg-gray-700 rounded-md" /><button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Look Up</button></form>)}{!selfAdmissionTab && <p className="text-gray-400 text-center py-8">Please select an admission method to begin.</p>}</div>)}</div>
        
        {(!dataForVerification || isEditingData) && !viewingStatusFor && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in-up">
                <h3 className="text-xl font-bold text-white text-center mb-4">Check Application Status</h3>
                <p className="text-gray-400 text-center mb-6">Already submitted? Enter your Index Number below to see your application's progress.</p>
                <form onSubmit={handleCheckStatus} className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
                    <input value={statusCheckIndex} onChange={e => setStatusCheckIndex(e.target.value)} placeholder="Enter Your Index Number" className="w-full px-4 py-2 bg-gray-700 rounded-md"/>
                    <button type="submit" className="w-full sm:w-auto px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold whitespace-nowrap">Check Status</button>
                </form>
            </div>
        )}
    </div>;
}

// --- Smart ID Viewer Modal ---
interface SmartIdViewerProps {
    user: User;
    school: School;
    settings: any; 
    templateType: 'default' | 'custom';
    onClose: () => void;
}

const SmartIdViewer: React.FC<SmartIdViewerProps> = ({ user, school, settings, templateType, onClose }) => {
    return <div>Smart ID Viewer Placeholder</div>;
};

// --- MAIN STUDENT PAGE ---
interface StudentPageProps { user: User; onLogout: (showNewUserFlow?: boolean) => void; }

const StudentPage: React.FC<StudentPageProps> = ({ user, onLogout }) => {
    const [currentUser, setCurrentUser] = useState(user);
    const [school, setSchool] = useState<School | null>(null);
    const [schoolName, setSchoolName] = useState(APP_TITLE);
    const [schoolLogo, setSchoolLogo] = useState('');
    const [availableModules, setAvailableModules] = useState<Module[]>([]);
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'my-results', or a module ID
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isIdCardVisible, setIsIdCardVisible] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    
    const reportCardContainerRef = useRef<HTMLDivElement>(null);
    const [reportToDownload, setReportToDownload] = useState<InternalExamResult | null>(null);

    const [idCardSettings, setIdCardSettings] = useState<any>(null);
    const [idCardTemplateType, setIdCardTemplateType] = useState<'default' | 'custom'>('default');
    
    const [stagedAdmissionData, setStagedAdmissionData] = useState<StagedAdmission | null>(null);
    const [stagedMarketplaceOrder, setStagedMarketplaceOrder] = useState<StagedMarketplaceOrder | null>(null);
    const [stagedCanteenOrder, setStagedCanteenOrder] = useState<StagedCanteenOrder | null>(null);
    const [wallet, setWallet] = useState<EWallet>(() => eWalletService.getWalletForUser(currentUser.studentId));

    const eWalletModule = useMemo(() => availableModules.find(m => m.name === E_WALLET_MODULE_NAME), [availableModules]);
    const admissionModule = useMemo(() => availableModules.find(m => m.name === SMART_ADMISSION_MODULE_NAME), [availableModules]);
    const onlineModule = useMemo(() => availableModules.find(m => m.name === ONLINE_MODULE_NAME), [availableModules]);
    const eCanteenModule = useMemo(() => availableModules.find(m => m.name === E_CANTEEN_MODULE_NAME), [availableModules]);
    const admissionSettings = useMemo(() => school ? settingsService.getAdmissionSettings(school.id) : null, [school]);
    
    const handleAdmissionStaged = (stagedInfo: StagedAdmission) => {
        setStagedAdmissionData(stagedInfo);
        if (eWalletModule) {
            setCurrentView(eWalletModule.id);
        }
    };
    
    const handleMarketplaceOrderStaged = (stagedInfo: StagedMarketplaceOrder) => {
        setStagedMarketplaceOrder(stagedInfo);
        if (eWalletModule) {
            setCurrentView(eWalletModule.id);
        }
    };
    
    const handleCanteenOrderStaged = (stagedInfo: StagedCanteenOrder) => {
        setStagedCanteenOrder(stagedInfo);
        if (eWalletModule) {
            setCurrentView(eWalletModule.id);
        }
    };

    const handleProceedWithStagedAdmission = () => {
        if (admissionModule) {
            setCurrentView(admissionModule.id);
        }
    };

    const handleFinishShopping = () => {
        if (onlineModule) {
            setCurrentView(onlineModule.id);
        }
    };
    
    const handleProceedWithCanteenOrder = () => {
        if (eCanteenModule) {
            setCurrentView(eCanteenModule.id);
        }
    };

    // Initialize staged orders from services on mount
    useEffect(() => {
        const savedMarketplace = marketplaceService.getStagedMarketplaceOrder();
        if (savedMarketplace) setStagedMarketplaceOrder(savedMarketplace);
        
        const savedCanteen = canteenService.getStagedCanteenOrder();
        if (savedCanteen) setStagedCanteenOrder(savedCanteen);
    }, []);

    useEffect(() => {
        if (!stagedAdmissionData && !stagedMarketplaceOrder && !stagedCanteenOrder) return;
        const interval = setInterval(() => {
            setWallet(eWalletService.getWalletForUser(currentUser.studentId));
        }, 2000);
        return () => clearInterval(interval);
    }, [stagedAdmissionData, stagedMarketplaceOrder, stagedCanteenOrder, currentUser.studentId]);

    const refreshModulesAndSettings = useCallback(() => {
        if (currentUser.schoolId) {
            const schoolData = getAllSchools().find(s => s.id === currentUser.schoolId);
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
                        // If allowedRoles is defined and has items, the user's role MUST be in it.
                        // If allowedRoles is undefined or empty, we default to allowing access (backward compatibility),
                        // unless strict role enforcement is desired. Given the user request, let's stick to the list if present.
                        const roles = m.allowedRoles;
                        return !roles || roles.length === 0 || roles.includes(currentUser.role);
                    })
                    .map(m => allModules.find(mod => mod.id === m.moduleId))
                    .filter((m): m is Module => !!m);
                
                setAvailableModules(publishedModules);
                setClasses(classService.getClassesForSchool(schoolData.id));
                setIdCardSettings(smartIdService.getSmartIdSettings(schoolData.id));
                setIdCardTemplateType(smartIdService.getSmartIdSettings(schoolData.id).templateType);
            }
        }
    }, [currentUser.schoolId, currentUser.role]);

    useEffect(() => {
        refreshModulesAndSettings();
        const interval = setInterval(() => {
            heartbeat(currentUser.studentId);
        }, 5000);
        return () => clearInterval(interval);
    }, [refreshModulesAndSettings, currentUser.studentId]);


    const handleDownloadReport = async (result: InternalExamResult) => {
        if (!school || !html2canvas) return;
        setReportToDownload(result);
        setIsDownloading(true);

        // Allow time for the hidden report card to render
        setTimeout(async () => {
             if (reportCardContainerRef.current) {
                try {
                    // We need to pre-process images to be data URLs to avoid taint
                    // This assumes images in report card (logo, avatar) are accessible.
                    // For external images (picsum), we'd need a proxy or they must allow CORS.
                    // The helper `imageToDataUrl` handles this.

                    // For simplicity in this demo, we assume `html2canvas` handles it with `useCORS: true`.
                    const canvas = await html2canvas(reportCardContainerRef.current, {
                        scale: 2, // Higher resolution
                        useCORS: true,
                        logging: false,
                    });
                    
                    const image = canvas.toDataURL("image/png", 1.0);
                    const link = document.createElement('a');
                    link.download = `${currentUser.name}_${result.term}_Report.png`;
                    link.href = image;
                    link.click();
                } catch (err) {
                    console.error("Report download failed:", err);
                    alert("Could not download report card. Please try again.");
                } finally {
                    setIsDownloading(false);
                    setReportToDownload(null);
                }
            }
        }, 500);
    };

    // --- Navigation Items ---
    const navItems = [
        { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
        { id: 'my-results', name: 'My Results', icon: <ResultsIcon /> }, // Built-in view
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
        if (!school) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <p className="text-lg text-yellow-400">Loading school data...</p>
                    </div>
                </div>
            );
        }

        // Special Views
        if (currentView === 'dashboard') {
            const studentWallet = eWalletService.getWalletForUser(currentUser.studentId);
            const unreadMessages = 0; // Placeholder
            const upcomingEvents = 0; // Placeholder

            return (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-6 text-white shadow-lg">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">Welcome back, {currentUser.name}!</h2>
                            <p className="opacity-90">{currentUser.studentId} | {currentUser.class || 'No Class Assigned'}</p>
                        </div>
                        <div className="mt-4 md:mt-0 text-center md:text-right">
                             <div className="text-sm opacity-75">E-Wallet Balance</div>
                             <div className="text-3xl font-bold">UGX {studentWallet.balance.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Quick Access Cards */}
                        <button onClick={() => setCurrentView(eWalletModule?.id || 'dashboard')} className="bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-750 transition-all hover:scale-105 text-left group">
                            <div className="bg-green-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                                <EWalletIcon />
                            </div>
                            <h3 className="font-bold text-lg text-gray-200">E-Wallet</h3>
                            <p className="text-sm text-gray-400 mt-1">Manage funds & payments</p>
                        </button>

                         <button onClick={() => setCurrentView('my-results')} className="bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-750 transition-all hover:scale-105 text-left group">
                            <div className="bg-purple-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                                <ResultsIcon />
                            </div>
                            <h3 className="font-bold text-lg text-gray-200">Academic Results</h3>
                            <p className="text-sm text-gray-400 mt-1">View performance reports</p>
                        </button>
                        
                        {availableModules.find(m => m.name === MESSAGE_MODULE_NAME) && (
                            <button onClick={() => setCurrentView(availableModules.find(m => m.name === MESSAGE_MODULE_NAME)?.id || '')} className="bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-700 transition-all hover:scale-105 text-left group">
                                <div className="bg-blue-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                                    <MessagesIcon />
                                </div>
                                <h3 className="font-bold text-lg text-gray-200">Messages</h3>
                                <p className="text-sm text-gray-400 mt-1">Chat with teachers & peers</p>
                            </button>
                        )}
                    </div>
                    
                     <NotificationPermissionBanner />
                </div>
            );
        }

        if (currentView === 'my-results') {
            return <StudentResultsView user={currentUser} onDownload={handleDownloadReport} isDownloading={isDownloading} />;
        }

        // Module Views
        const activeModule = availableModules.find(m => m.id === currentView);
        if (activeModule) {
            switch (activeModule.name) {
                case KIOSK_MODE_MODULE_NAME:
                    return <KioskPage user={currentUser} school={school} />;
                case VISITOR_CENTER_MODULE_NAME:
                    return <VisitorCenterStudentPage user={currentUser} school={school} />;
                case SMART_ADMISSION_MODULE_NAME:
                    return <StudentAdmissionPortal 
                                user={currentUser} 
                                school={school} 
                                onBack={() => setCurrentView('dashboard')} 
                                onAdmissionStaged={handleAdmissionStaged} 
                                stagedData={stagedAdmissionData}
                                onStagedDataConsumed={() => setStagedAdmissionData(null)}
                                onLogout={onLogout}
                           />;
                case E_WALLET_MODULE_NAME:
                    return <EWalletPage 
                                user={currentUser} 
                                stagedMarketplaceOrder={stagedMarketplaceOrder}
                                onFinishShopping={handleFinishShopping}
                                stagedCanteenOrder={stagedCanteenOrder}
                                onProceedWithCanteenOrder={handleProceedWithCanteenOrder}
                            />;
                case MESSAGE_MODULE_NAME:
                    return <SocialHubPage user={currentUser} onLogout={onLogout} />;
                case ONLINE_MODULE_NAME:
                    return <OnlineFeedPage 
                                user={currentUser} 
                                onLogout={onLogout} 
                                onBackToDashboard={() => setCurrentView('dashboard')} 
                                onNavigateToWallet={() => eWalletModule && setCurrentView(eWalletModule.id)}
                                onOrderStaged={handleMarketplaceOrderStaged}
                                stagedOrder={stagedMarketplaceOrder}
                                onStagedOrderConsumed={() => setStagedMarketplaceOrder(null)}
                            />;
                case SMART_STUDENT_ID_MODULE_NAME:
                     return (
                        <div className="flex flex-col items-center justify-center min-h-[60vh]">
                            <h2 className="text-2xl font-bold text-white mb-8">My Smart ID Card</h2>
                            <div className="transform scale-75 sm:scale-100 origin-top">
                                {idCardTemplateType === 'custom' && idCardSettings ? (
                                     <CustomSmartIdCardDownloadable user={currentUser} school={school} template={customIdTemplateService.getCustomIdTemplate(school.id)} />
                                ) : (
                                    <div className="space-y-8">
                                         <SmartIdCardFront user={currentUser} school={school} settings={idCardSettings || smartIdService.getSmartIdSettings(school.id)} />
                                         <SmartIdCardBack user={currentUser} school={school} settings={idCardSettings || smartIdService.getSmartIdSettings(school.id)} />
                                    </div>
                                )}
                            </div>
                        </div>
                     );
                case E_CANTEEN_MODULE_NAME:
                     return <ECanteenStudentPage 
                                school={school} 
                                user={currentUser} 
                                onOrderStaged={handleCanteenOrderStaged}
                                stagedOrder={stagedCanteenOrder}
                                onStagedOrderConsumed={() => setStagedCanteenOrder(null)}
                            />;
                case NCHE_MODULE_NAME:
                    return <StudentNcheView user={currentUser} />;
                case STUDENT_TRANSFER_MODULE_NAME:
                    return <StudentTransferView />;
                case NEWS_FEED_MODULE_NAME:
                     return <OnlineFeedPage user={currentUser} onLogout={onLogout} onBackToDashboard={() => setCurrentView('dashboard')} />;
                case E_VOTE_MODULE_NAME:
                    return <EVoteStudentPage user={currentUser} school={school} />;
                case MY_INSTITUTE_MODULE_NAME:
                    return <MyInstituteStudentPage />;
                case EXPLORATION_MODULE_NAME:
                     return <div className="p-8 text-center text-gray-400">Exploration module content coming soon.</div>;
                default:
                    return <div className="p-8 text-center text-gray-400">Module "{activeModule.name}" content coming soon.</div>;
            }
        }

        return <div>Select a module</div>;
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside 
                className={`bg-gray-800 shadow-xl flex flex-col transition-all duration-300 z-20 ${isSidebarExpanded ? 'w-64' : 'w-20'} hidden md:flex`}
            >
                <div className="p-4 flex items-center justify-center h-16 border-b border-gray-700">
                     {isSidebarExpanded ? (
                         <h1 className="text-xl font-bold text-cyan-400 truncate">{APP_TITLE}</h1>
                     ) : (
                         <img src={schoolLogo} alt="Logo" className="w-8 h-8 rounded-full" />
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
                            <h1 className="text-xl font-bold text-cyan-400">{APP_TITLE}</h1>
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
                {/* Header */}
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
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-bold text-white">{schoolName}</p>
                        </div>
                        <NotificationBell userId={currentUser.studentId} />
                        <div className="relative cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                             <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="w-9 h-9 rounded-full border-2 border-gray-600" />
                        </div>
                        <button onClick={() => onLogout()} className="text-gray-400 hover:text-red-400 transition-colors" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-gray-900 relative">
                     {stagedAdmissionData && eWalletModule && currentView === eWalletModule.id && admissionSettings && wallet.balance >= admissionSettings.admissionFee && (
                        <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up">
                            <div>
                                <h3 className="font-bold text-green-400 text-lg">Funds Ready for Admission!</h3>
                                <p className="text-gray-400 text-sm">Your E-Wallet balance is now sufficient to complete your application.</p>
                            </div>
                            <button onClick={handleProceedWithStagedAdmission} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap animate-pulse-custom">
                                Proceed with Admission
                            </button>
                        </div>
                    )}
                     {renderContent()}
                </main>
            </div>

            {/* Profile Modal */}
            {isProfileOpen && (
                <ProfilePage
                    user={currentUser}
                    onClose={() => setIsProfileOpen(false)}
                    onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser as User);
                        localStorage.setItem('360_smart_school_session', JSON.stringify(updatedUser));
                    }}
                    classes={classes}
                />
            )}

             {/* Hidden Report Card for PDF Generation */}
             {reportToDownload && school && (
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div ref={reportCardContainerRef}>
                        <ReportCard user={currentUser} school={school} result={reportToDownload} />
                    </div>
                </div>
            )}
        </div>
    );
};

// FIX: Added a default export for the StudentPage component.
export default StudentPage;