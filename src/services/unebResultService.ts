


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

    // --- 1. Validation ---
    for (const [index, row] of slipsFromCsv.entries()) {
        try {
            if (!row.indexNumber || !row.candidateName || !row.yearOfExamination || !row.examinationType) {
                throw new Error("Missing required fields (indexNumber, candidateName, yearOfExamination, examinationType).");
            }
            
            const examType = row.examinationType.toUpperCase();
            let level: UnebPassSlip['level'];
            if (examType.includes('ADVANCED')) level = 'U.A.C.E';
            else if (examType.includes('PRIMARY')) level = 'P.L.E';
            else if (examType.includes('EDUCATION')) level = 'U.C.E';
            else throw new Error(`Unknown examinationType: "${row.examinationType}"`);

            const subjectsStr = row.subjects || '';
            const subjects = subjectsStr.split('|').map((s: string) => {
                if (!s.trim()) return null;
                const parts = s.split(':');
                if (parts.length < 2) throw new Error(`Invalid subject format: "${s}". Expected "Name:Grade".`);
                return { name: parts[0].trim(), grade: parts[1].trim() };
            }).filter((s: {name: string, grade: string} | null): s is {name: string, grade: string} => s !== null);

            // FIX: A logic error where an empty `subjects` string would still result in an array with one empty object is now corrected.


            const newSlip: UnebPassSlip = {
                indexNo: row.indexNumber,
                name: row.candidateName,
                year: row.yearOfExamination,
                level: level,
                subjects: subjects,
                dateOfBirth: row.dateOfBirth,
                schoolName: row.schoolName,
                schoolAddress: row.schoolAddress,
                entryCode: row.entryCode,
                aggregate: row.gradeAggregate,
                result: row.overallResult,
            };
            validatedSlips.push(newSlip);
        } catch (e) {
            errors.push(`Row ${index + 2}: ${(e as Error).message}`);
        }
    }

    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    }
    
    // --- 2. Save ---
    validatedSlips.forEach(slip => {
        slipsToSave.set(slip.indexNo.toUpperCase(), slip);
    });

    saveResults(Array.from(slipsToSave.values()));

    return { successCount: validatedSlips.length, errorCount: 0, errors: [] };
};

/**
 * Finds a UNEB pass slip by the student's index number.
 * @param indexNo The index number to search for.
 * @returns The UnebPassSlip object or null if not found.
 */
export const findResultByIndex = (indexNo: string): UnebPassSlip | null => {
    if (!indexNo) return null;
    const results = getResults();
    return results.find(slip => slip.indexNo.toLowerCase() === indexNo.toLowerCase()) || null;
};

/**
 * Calculates and returns statistics about the stored UNEB results.
 * @returns A UnebStats object.
 */
export const getUnebStats = (): UnebStats => {
    const results = getResults();
    const uniqueSchools = new Set(results.map(r => r.schoolName).filter(Boolean));

    const stats: UnebStats = {
        totalSlips: results.length,
        uniqueSchools: uniqueSchools.size,
        byLevel: {
            'P.L.E': { studentCount: 0, years: [] },
            'U.C.E': { studentCount: 0, years: [] },
            'U.A.C.E': { studentCount: 0, years: [] },
        },
    };

    const pleYears = new Set<string>();
    const uceYears = new Set<string>();
    const uaceYears = new Set<string>();

    results.forEach(slip => {
        if (slip.level === 'P.L.E') {
            stats.byLevel['P.L.E'].studentCount++;
            pleYears.add(slip.year);
        } else if (slip.level === 'U.C.E') {
            stats.byLevel['U.C.E'].studentCount++;
            uceYears.add(slip.year);
        } else if (slip.level === 'U.A.C.E') {
            stats.byLevel['U.A.C.E'].studentCount++;
            uaceYears.add(slip.year);
        }
    });

    stats.byLevel['P.L.E'].years = Array.from(pleYears).sort();
    stats.byLevel['U.C.E'].years = Array.from(uceYears).sort();
    stats.byLevel['U.A.C.E'].years = Array.from(uaceYears).sort();

    return stats;
};
