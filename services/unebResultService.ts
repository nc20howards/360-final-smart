import { UnebPassSlip, UnebStats } from '../types';
import { isUnebVerificationEnabled } from './systemSettingsService';

const UNEB_RESULTS_KEY = '360_smart_school_uneb_results';

// Helper to get all pass slips from localStorage
const getResults = (): UnebPassSlip[] => {
    const results = localStorage.getItem(UNEB_RESULTS_KEY);
    return results ? JSON.parse(results) : [];
};

// Helper to save all pass slips to localStorage
const saveResults = (results: UnebPassSlip[]) => {
    localStorage.setItem(UNEB_RESULTS_KEY, JSON.stringify(results));
};

/**
 * Adds a batch of UNEB pass slips from a parsed CSV, performing an all-or-nothing validation.
 * It now parses a detailed CSV format and derives year/level from the file content.
 * @param slipsFromCsv An array of objects parsed from the CSV.
 * @returns An object detailing the success and error counts of the operation.
 */
export const addResults = (
    slipsFromCsv: any[]
): { successCount: number; errorCount: number; errors: string[] } => {
    const existingSlips = getResults();
    // Use a map for efficient lookup and to handle overwriting existing entries
    const slipsToSave = new Map<string, UnebPassSlip>();
    for (const slip of existingSlips) {
        slipsToSave.set(slip.indexNo.toUpperCase(), slip);
    }

    const errors: string[] = [];
    const validatedSlips: UnebPassSlip[] = [];

    // --- 1. Validation Phase ---
    slipsFromCsv.forEach((row, index) => {
        const lineNumber = index + 2; // For user feedback
        try {
            // Ensure required fields exist and are strings
            const requiredFields = ['candidateName', 'indexNumber', 'yearOfExamination', 'examinationType', 'subjects'];
            for (const field of requiredFields) {
                if (!row[field] || typeof row[field] !== 'string') {
                    throw new Error(`Missing or invalid required field: '${field}'.`);
                }
            }

            const examinationType = row.examinationType.toUpperCase();
            let level: UnebPassSlip['level'];
            if (examinationType.includes('ADVANCED')) level = 'U.A.C.E';
            else if (examinationType.includes('PRIMARY')) level = 'P.L.E';
            else if (examinationType.includes('CERTIFICATE OF EDUCATION')) level = 'U.C.E';
            else throw new Error(`Could not determine examination level from '${row.examinationType}'.`);

            // Parse subjects: "MATHEMATICS:1:DISTINCTION|ENGLISH:2:CREDIT"
            const subjects: UnebPassSlip['subjects'] = row.subjects.split('|').map((subStr: string) => {
                const parts = subStr.split(':');
                if (parts.length < 2) return null; // Must have at least name and grade
                return { name: parts[0].trim(), grade: parts[1].trim() };
            }).filter((s: any): s is { name: string; grade: string } => s !== null);

            if (subjects.length === 0 && row.subjects.trim() !== '') {
                 throw new Error(`Invalid format for subjects column: "${row.subjects}". Expected 'Subject:GradeNumber:GradeWord|...'`);
            }

            const finalSlip: UnebPassSlip = {
                indexNo: row.indexNumber.trim(),
                name: row.candidateName.trim(),
                year: row.yearOfExamination.trim(),
                level: level,
                subjects: subjects,
                dateOfBirth: row.dateOfBirth?.trim(),
                schoolName: row.schoolName?.trim(),
                schoolAddress: row.schoolAddress?.trim(),
                entryCode: row.entryCode?.trim(),
                aggregate: row.gradeAggregate?.trim(),
                result: row.overallResult?.trim(),
            };

            validatedSlips.push(finalSlip);

        } catch (e) {
            errors.push(`Line ${lineNumber}: ${(e as Error).message}`);
        }
    });

    // --- 2. Commit Phase (All-or-Nothing) ---
    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    } else {
        validatedSlips.forEach(slip => {
            slipsToSave.set(slip.indexNo.toUpperCase(), slip);
        });
        saveResults(Array.from(slipsToSave.values()));
        return { successCount: validatedSlips.length, errorCount: 0, errors: [] };
    }
};


/**
 * Finds a student's UNEB pass slip by their index number.
 * This function is now protected by the system-wide UNEB verification setting.
 * @param indexNo The index number to search for.
 * @returns The UnebPassSlip object or null if not found.
 * @throws An error if the UNEB verification service is disabled by the superadmin.
 */
export const findResultByIndex = (indexNo: string): UnebPassSlip | null => {
    // Check if the service is enabled system-wide.
    if (!isUnebVerificationEnabled()) {
        throw new Error("The UNEB result verification service is currently disabled. Please contact the superadministrator.");
    }

    const slips = getResults();
    return slips.find(slip => slip.indexNo.toUpperCase() === indexNo.toUpperCase()) || null;
};

/**
 * Gathers statistics from the stored UNEB results data, categorized by level.
 * @returns An object with various statistics about the UNEB results.
 */
export const getUnebStats = (): UnebStats => {
    const slips = getResults();
    const uniqueSchoolNames = new Set(slips.map(slip => slip.schoolName).filter(Boolean));

    const byLevel: UnebStats['byLevel'] = {
        'P.L.E': { studentCount: 0, years: [] },
        'U.C.E': { studentCount: 0, years: [] },
        'U.A.C.E': { studentCount: 0, years: [] },
    };
    
    const yearsByLevel: Record<'P.L.E' | 'U.C.E' | 'U.A.C.E', Set<string>> = {
        'P.L.E': new Set<string>(),
        'U.C.E': new Set<string>(),
        'U.A.C.E': new Set<string>(),
    };

    for (const slip of slips) {
        if (slip.level && byLevel[slip.level]) {
            byLevel[slip.level].studentCount++;
            if(slip.year) {
               yearsByLevel[slip.level].add(slip.year);
            }
        }
    }
    
    byLevel['P.L.E'].years = Array.from(yearsByLevel['P.L.E']).sort();
    byLevel['U.C.E'].years = Array.from(yearsByLevel['U.C.E']).sort();
    byLevel['U.A.C.E'].years = Array.from(yearsByLevel['U.A.C.E']).sort();

    return {
        totalSlips: slips.length,
        uniqueSchools: uniqueSchoolNames.size,
        byLevel,
    };
};
