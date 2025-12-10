
// services/settingsService.ts

import { AdmissionSettings, CompletedAdmission, ExtractedUnebSlipData, UnebPassSlip, StagedAdmission } from '../types';
import { getAllSchools } from './schoolService';

const ADMISSION_SETTINGS_KEY = '360_smart_school_admission_settings';
const STAGED_ADMISSION_KEY = '360_smart_school_staged_admission';

const getAllSettings = (): AdmissionSettings[] => {
    const data = localStorage.getItem(ADMISSION_SETTINGS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveAllSettings = (allSettings: AdmissionSettings[]) => {
    localStorage.setItem(ADMISSION_SETTINGS_KEY, JSON.stringify(allSettings));
};

const getDefaultSettings = (schoolId: string): AdmissionSettings => ({
    schoolId,
    automaticAdmission: false,
    defaultClass: 'S.1', // A sensible default for Uganda
    studentIdPrefix: 'STU-',
    admissionFee: 50000, // Default admission fee
    acceptingClasses: [],
    startDate: '',
    endDate: '',
    aLevelCombinations: {
        arts: [],
        sciences: [],
    },
});

export const getAdmissionSettings = (schoolId: string): AdmissionSettings => {
    const allSettings = getAllSettings();
    const savedSchoolSettings = allSettings.find(s => s.schoolId === schoolId);
    const defaultSchoolSettings = getDefaultSettings(schoolId);

    const finalSettings = {
        ...defaultSchoolSettings,
        ...savedSchoolSettings,
    };

    if (!finalSettings.aLevelCombinations) {
        finalSettings.aLevelCombinations = { arts: [], sciences: [] };
    }
    if (!finalSettings.aLevelCombinations.arts) {
        finalSettings.aLevelCombinations.arts = [];
    }
     if (!finalSettings.aLevelCombinations.sciences) {
        finalSettings.aLevelCombinations.sciences = [];
    }


    return finalSettings;
};

export const saveAdmissionSettings = (settings: AdmissionSettings): void => {
    const allSettings = getAllSettings();
    const schoolIndex = allSettings.findIndex(s => s.schoolId === settings.schoolId);
    if (schoolIndex > -1) {
        allSettings[schoolIndex] = settings;
    } else {
        allSettings.push(settings);
    }
    saveAllSettings(allSettings);
};

// --- COMPLETED ADMISSIONS SERVICE LOGIC ---
const COMPLETED_ADMISSIONS_KEY = '360_smart_school_completed_admissions';

const getAllAdmissionsData = (): Record<string, CompletedAdmission[]> => {
    const data = localStorage.getItem(COMPLETED_ADMISSIONS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveAllAdmissionsData = (data: Record<string, CompletedAdmission[]>) => {
    localStorage.setItem(COMPLETED_ADMISSIONS_KEY, JSON.stringify(data));
};

export const getCompletedAdmissions = (schoolId: string): CompletedAdmission[] => {
    const allData = getAllAdmissionsData();
    return (allData[schoolId] || []).sort((a, b) => b.timestamp - a.timestamp);
};

export const addCompletedAdmission = (
    applicantId: string,
    data: UnebPassSlip | ExtractedUnebSlipData,
    schoolId: string,
    targetClass: string,
    aLevelCombinationChoices?: string[],
    isTransfer: boolean = false,
    gender?: 'Male' | 'Female'
): CompletedAdmission => {
    const allData = getAllAdmissionsData();
    if (!allData[schoolId]) {
        allData[schoolId] = [];
    }

    const newAdmission: CompletedAdmission = {
        id: `comp_adm_${Date.now()}`,
        applicantId,
        data,
        status: 'under_review',
        timestamp: Date.now(),
        targetClass,
        gender,
        aLevelCombinationChoices,
    };
    
    if (isTransfer) {
        (newAdmission.data as any).schoolName = `Transferred from another school - ${newAdmission.data.schoolName}`;
    }


    allData[schoolId].unshift(newAdmission);
    saveAllAdmissionsData(allData);
    return newAdmission;
};

export const updateAdmissionStatus = (admissionId: string, schoolId: string, status: 'approved' | 'rejected'): void => {
    const allData = getAllAdmissionsData();
    if (!allData[schoolId]) return;

    const admissionIndex = allData[schoolId].findIndex(adm => adm.id === admissionId);
    if (admissionIndex > -1) {
        allData[schoolId][admissionIndex].status = status;
        saveAllAdmissionsData(allData);
    } else {
        throw new Error("Admission record not found.");
    }
};

export const hasAdmissionBeenSubmitted = (indexNumberToCheck: string, schoolId: string): boolean => {
    const allAdmissions = getAllAdmissionsData();
    const schoolAdmissions = allAdmissions[schoolId] || [];
    return schoolAdmissions.some(admission => {
        // Check the actual index number within the submitted data, not just the applicantId
        const admissionIndexNo = 'indexNumber' in admission.data ? admission.data.indexNumber : admission.data.indexNo;
        return admissionIndexNo.toLowerCase() === indexNumberToCheck.toLowerCase();
    });
};

export const getAdmissionForStudent = (studentIdOrIndexNo: string, schoolId?: string): (CompletedAdmission & { fromSchoolId?: string }) | null => {
    const allAdmissionsData = getAllAdmissionsData();

    for (const sId in allAdmissionsData) {
        const schoolAdmissions = allAdmissionsData[sId];
        const foundAdmission = schoolAdmissions.find(adm => {
            const admissionIndexNo = 'indexNumber' in adm.data ? adm.data.indexNumber : adm.data.indexNo;
            return adm.applicantId.toLowerCase() === studentIdOrIndexNo.toLowerCase() ||
                   admissionIndexNo.toLowerCase() === studentIdOrIndexNo.toLowerCase();
        });

        if (foundAdmission) {
            // If it's a pending transfer, enrich it with the fromSchoolId
            if (foundAdmission.status === 'transferred' && foundAdmission.transferStatus === 'pending_student_approval') {
                return { ...foundAdmission, fromSchoolId: sId };
            }
            return { ...foundAdmission, fromSchoolId: sId }; // Return the found admission from its original school
        }
    }
    return null; // Not found in any school
};

export const stageAdmissionForTransfer = (admissionId: string, schoolId: string): void => {
    const allData = getAllAdmissionsData();
    if (!allData[schoolId]) throw new Error("School has no admission data.");

    const admissionIndex = allData[schoolId].findIndex(adm => adm.id === admissionId);
    if (admissionIndex === -1) throw new Error("Admission to stage for transfer not found.");

    // Only change the status. Do not assign a destination school or transfer status yet.
    allData[schoolId][admissionIndex].status = 'transferred';
    
    // Clear any previous transfer details if they exist from an older workflow
    delete allData[schoolId][admissionIndex].transferToSchoolId;
    delete allData[schoolId][admissionIndex].transferStatus;

    saveAllAdmissionsData(allData);
};


export const initiateAdmissionTransfer = (admissionId: string, fromSchoolId: string, toSchoolId: string): void => {
    const allData = getAllAdmissionsData();
    if (!allData[fromSchoolId]) throw new Error("Source school has no admission data.");
    
    const admissionIndex = allData[fromSchoolId].findIndex(adm => adm.id === admissionId);
    if (admissionIndex === -1) throw new Error("Admission to transfer not found.");

    allData[fromSchoolId][admissionIndex].status = 'transferred';
    allData[fromSchoolId][admissionIndex].transferToSchoolId = toSchoolId;
    // This status is a signal for both the buying admin (to accept the deal) and the student (if they need to approve).
    allData[fromSchoolId][admissionIndex].transferStatus = 'pending_student_approval';
    
    saveAllAdmissionsData(allData);
};

export const respondToTransferOffer = (admissionId: string, schoolId: string, response: 'accepted_by_student' | 'rejected_by_student'): void => {
    const allData = getAllAdmissionsData();
    if (!allData[schoolId]) throw new Error("Originating school data not found.");

    const admissionIndex = allData[schoolId].findIndex(adm => adm.id === admissionId);
    if (admissionIndex === -1) throw new Error("Original admission record not found.");
    
    const admission = allData[schoolId][admissionIndex];
    admission.transferStatus = response;

    if (response === 'accepted_by_student' && admission.transferToSchoolId) {
        addCompletedAdmission(
            admission.applicantId,
            admission.data,
            admission.transferToSchoolId,
            admission.targetClass,
            admission.aLevelCombinationChoices,
            true,
            admission.gender
        );
    } else if (response === 'rejected_by_student') {
        // If rejected, we might want to revert the status to something else,
        // but for now, the history is preserved in the transferStatus field.
        // Let's keep the main status as 'transferred' to indicate an attempt was made.
    }
    
    allData[schoolId][admissionIndex] = admission;
    saveAllAdmissionsData(allData);
};

export const findPendingTransferForStudent = (studentIdOrIndexNo: string, toSchoolId: string): CompletedAdmission | null => {
    const allData = getAllAdmissionsData();
    for (const schoolId in allData) {
        const found = allData[schoolId].find(adm => 
            adm.applicantId === studentIdOrIndexNo &&
            adm.status === 'transferred' &&
            adm.transferToSchoolId === toSchoolId &&
            adm.transferStatus === 'pending_student_approval'
        );
        if (found) return found;
    }
    return null;
};

export const findPendingTransferForApplicant = (applicantId: string): (CompletedAdmission & { fromSchoolId: string }) | null => {
    const allData = getAllAdmissionsData();
    for (const schoolId in allData) {
        const found = allData[schoolId].find(adm => 
            adm.applicantId === applicantId &&
            adm.status === 'transferred' &&
            adm.transferStatus === 'pending_student_approval'
        );
        if (found) {
            return { ...found, fromSchoolId: schoolId };
        }
    }
    return null;
};

export const getTransferHistoryForApplicant = (applicantId: string): (CompletedAdmission & { fromSchoolId: string })[] => {
    const history: (CompletedAdmission & { fromSchoolId: string })[] = [];
    const allData = getAllAdmissionsData();

    for (const schoolId in allData) {
        const transfers = allData[schoolId].filter(adm => 
            adm.applicantId === applicantId &&
            adm.status === 'transferred' &&
            (adm.transferStatus === 'accepted_by_student' || adm.transferStatus === 'rejected_by_student')
        );
        transfers.forEach(t => history.push({ ...t, fromSchoolId: schoolId }));
    }

    return history.sort((a, b) => b.timestamp - a.timestamp);
};


export const finalizeAcceptedTransfer = (admissionId: string, fromSchoolId: string): void => {
    const allData = getAllAdmissionsData();
    if (!allData[fromSchoolId]) return;

    const admissionIndex = allData[fromSchoolId].findIndex(adm => adm.id === admissionId);
    if (admissionIndex > -1) {
        allData[fromSchoolId][admissionIndex].transferStatus = 'accepted_by_student';
        saveAllAdmissionsData(allData);
    }
};

/**
 * Extracts and normalizes the academic level from admission data.
 */
export const getAdmissionLevel = (data: UnebPassSlip | ExtractedUnebSlipData): 'P.L.E' | 'U.C.E' | 'U.A.C.E' | 'UNKNOWN' => {
    if ('level' in data) {
        return data.level;
    }
    if ('examinationType' in data) {
        const type = data.examinationType.toUpperCase();
        if (type.includes('ADVANCED')) return 'U.A.C.E';
        if (type.includes('PRIMARY')) return 'P.L.E';
        if (type.includes('EDUCATION')) return 'U.C.E'; 
    }
    return 'UNKNOWN';
};

/**
 * Extracts and normalizes the overall grade from admission data.
 */
export const getAdmissionGrade = (admission: CompletedAdmission): string | null => {
    const data = admission.data;
    if ('overallResult' in data) return data.overallResult;
    if ('result' in data) return data.result || null;
    return null;
};

/**
 * Normalizes a grade/division string to a consistent format (e.g., 'FIRST GRADE').
 */
export const normalizeGrade = (grade: string | null | undefined): string => {
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

// --- Staged Admission for Insufficient Funds ---
export const stageAdmission = (admissionData: StagedAdmission): void => {
    localStorage.setItem(STAGED_ADMISSION_KEY, JSON.stringify(admissionData));
};

export const getStagedAdmission = (): StagedAdmission | null => {
    const data = localStorage.getItem(STAGED_ADMISSION_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedAdmission = (): void => {
    localStorage.removeItem(STAGED_ADMISSION_KEY);
};

export const getAllTransfers = (): Array<CompletedAdmission & { fromSchoolId: string }> => {
    const allData = getAllAdmissionsData();
    const transfers: Array<CompletedAdmission & { fromSchoolId: string }> = [];
    for (const schoolId in allData) {
        const schoolAdmissions = allData[schoolId];
        schoolAdmissions.forEach(adm => {
            // Include if it has transfer info
            if (adm.transferToSchoolId || adm.status === 'transferred') {
                transfers.push({ ...adm, fromSchoolId: schoolId });
            }
        });
    }
    return transfers.sort((a, b) => b.timestamp - a.timestamp);
};
