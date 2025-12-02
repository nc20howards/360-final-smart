// services/ncheService.ts
import { HigherEducationInstitution, Program, UnebPassSlip, InternalExamResult, OLevelGuidance, ALevelCombination, SubjectPerformance } from '../types';

const INSTITUTIONS_KEY = '360_smart_school_nche_institutions';
const PROGRAMS_KEY = '360_smart_school_nche_programs';

// --- Helper Functions ---
const getInstitutions = (): HigherEducationInstitution[] => JSON.parse(localStorage.getItem(INSTITUTIONS_KEY) || '[]');
const saveInstitutions = (data: HigherEducationInstitution[]) => localStorage.setItem(INSTITUTIONS_KEY, JSON.stringify(data));
const getPrograms = (): Program[] => JSON.parse(localStorage.getItem(PROGRAMS_KEY) || '[]');
const savePrograms = (data: Program[]) => localStorage.setItem(PROGRAMS_KEY, JSON.stringify(data));

// --- Data Management ---
export const getAllInstitutions = () => getInstitutions();
export const getAllPrograms = () => getPrograms();

export const createInstitution = (data: Omit<HigherEducationInstitution, 'id'>): HigherEducationInstitution => {
    const all = getInstitutions();
    const newInst: HigherEducationInstitution = { ...data, id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` };
    all.push(newInst);
    saveInstitutions(all);
    return newInst;
};

export const createProgram = (data: Omit<Program, 'id'>): Program => {
    const all = getPrograms();
    const newProg: Program = { ...data, id: `prog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` };
    all.push(newProg);
    savePrograms(all);
    return newProg;
};

// FIX: Implement bulk creation from CSV for institutions and programs.
// --- Bulk Creation ---
/**
 * Bulk creates institutions from a CSV string. Skips duplicates.
 * @param csvText The string content of the CSV file.
 * @returns An object with success count, error count, and a list of errors.
 */
export const bulkCreateInstitutionsFromCSV = (
    csvText: string
): { successCount: number; errorCount: number; errors: string[] } => {
    const allInstitutions = getInstitutions();
    const institutionMap = new Map(allInstitutions.map(i => [i.acronym.toLowerCase(), i]));
    const errors: string[] = [];
    let successCount = 0;

    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error("CSV file is empty or contains only a header.");
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['name', 'acronym', 'type', 'ownership', 'logourl'];
    const missing = required.filter(h => !header.includes(h.replace(/\s/g, '')));
    if (missing.length > 0) {
        throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
    }

    const nameIndex = header.indexOf('name');
    const acronymIndex = header.indexOf('acronym');
    const typeIndex = header.indexOf('type');
    const ownershipIndex = header.indexOf('ownership');
    const logoUrlIndex = header.indexOf('logourl');

    const institutionsToCreate: Omit<HigherEducationInstitution, 'id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const lineNumber = i + 1;
        const values = lines[i].split(',');
        try {
            const name = values[nameIndex]?.trim();
            const acronym = values[acronymIndex]?.trim();
            const type = values[typeIndex]?.trim() as HigherEducationInstitution['type'];
            const ownership = values[ownershipIndex]?.trim() as HigherEducationInstitution['ownership'];
            const logoUrl = values[logoUrlIndex]?.trim();

            if (!name || !acronym || !type || !ownership) {
                throw new Error("Missing required fields (name, acronym, type, ownership).");
            }
            if (institutionMap.has(acronym.toLowerCase())) {
                // Skip duplicates, not an error
                continue;
            }

            const newInst: Omit<HigherEducationInstitution, 'id'> = {
                name,
                acronym,
                type,
                ownership,
                logoUrl: logoUrl || `https://picsum.photos/seed/${acronym}/100`
            };
            institutionsToCreate.push(newInst);
            // Temporarily add to map to catch duplicates within the same file
            institutionMap.set(newInst.acronym.toLowerCase(), { ...newInst, id: 'temp' });
            successCount++;

        } catch (e) {
            errors.push(`Line ${lineNumber}: ${(e as Error).message}`);
        }
    }
    
    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    }

    if (institutionsToCreate.length > 0) {
        const createdInstitutions = institutionsToCreate.map(inst => ({...inst, id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` }));
        saveInstitutions([...allInstitutions, ...createdInstitutions]);
    }

    return { successCount, errorCount: errors.length, errors };
};

/**
 * Bulk creates programs from a CSV string. Skips duplicates.
 * @param csvText The string content of the CSV file.
 * @returns An object with success count, error count, and a list of errors.
 */
export const bulkCreateProgramsFromCSV = (
    csvText: string
): { successCount: number; errorCount: number; errors: string[] } => {
    const allPrograms = getPrograms();
    const allInstitutions = getInstitutions();
    // FIX: Corrected the `new Map()` constructor argument. The original code passed a `string[]` instead of an array of `[key, value]` pairs.
    const programMap = new Map(allPrograms.map(p => [p.ncheCode.toLowerCase(), p]));
    const institutionMap = new Map(allInstitutions.map(i => [i.acronym.toLowerCase(), i]));
    const errors: string[] = [];
    let successCount = 0;

    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error("CSV file is empty or contains only a header.");
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['institutionacronym', 'nchecode', 'name', 'faculty', 'durationyears', 'level', 'principalpasses', 'subsidiarypasses'];
    const missing = required.filter(h => !header.includes(h.replace(/\s/g, '')));
    if (missing.length > 0) {
        throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
    }

    const instAcronymIndex = header.indexOf('institutionacronym');
    const ncheCodeIndex = header.indexOf('nchecode');
    const nameIndex = header.indexOf('name');
    const facultyIndex = header.indexOf('faculty');
    const durationIndex = header.indexOf('durationyears');
    const levelIndex = header.indexOf('level');
    const principalPassesIndex = header.indexOf('principalpasses');
    const subsidiaryPassesIndex = header.indexOf('subsidiarypasses');
    const essentialSubjectsIndex = header.indexOf('essentialsubjects');
    const minPointsIndex = header.indexOf('minpoints');
    const uceReqsIndex = header.indexOf('ucerequirements');

    const programsToCreate: Omit<Program, 'id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const lineNumber = i + 1;
        const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '')) || lines[i].split(',');
        try {
            const institutionAcronym = values[instAcronymIndex]?.trim();
            const ncheCode = values[ncheCodeIndex]?.trim();
            const name = values[nameIndex]?.trim();

            if (!institutionAcronym || !ncheCode || !name) {
                throw new Error("Missing required fields (institutionAcronym, ncheCode, name).");
            }
            if (programMap.has(ncheCode.toLowerCase())) {
                continue; // Skip duplicates
            }
            const institution = institutionMap.get(institutionAcronym.toLowerCase());
            if (!institution) {
                throw new Error(`Institution with acronym "${institutionAcronym}" not found.`);
            }

            const essentialSubjectsStr = values[essentialSubjectsIndex]?.trim();
            const essentialSubjects = essentialSubjectsStr ? essentialSubjectsStr.split('|').map(s => {
                const [subName, minGrade] = s.split(':');
                if (!subName || !minGrade) throw new Error(`Invalid essential subject format: ${s}. Expected 'SubjectName:Grade'.`);
                return { name: subName.trim(), minGrade: minGrade.trim() };
            }) : undefined;

            const newProg: Omit<Program, 'id'> = {
                institutionId: institution.id,
                ncheCode,
                name,
                faculty: values[facultyIndex]?.trim() || 'N/A',
                durationYears: parseInt(values[durationIndex]?.trim(), 10) || 3,
                level: values[levelIndex]?.trim() as Program['level'] || 'Bachelors',
                requirements: {
                    principalPasses: parseInt(values[principalPassesIndex]?.trim(), 10) || 0,
                    subsidiaryPasses: parseInt(values[subsidiaryPassesIndex]?.trim(), 10) || 0,
                    essentialSubjects: essentialSubjects,
                    minPoints: minPointsIndex > -1 ? parseInt(values[minPointsIndex]?.trim(), 10) : undefined,
                    uceRequirements: uceReqsIndex > -1 ? values[uceReqsIndex]?.trim() : undefined,
                }
            };
            programsToCreate.push(newProg);
            programMap.set(newProg.ncheCode.toLowerCase(), { ...newProg, id: 'temp'});
            successCount++;
        } catch (e) {
            errors.push(`Line ${lineNumber}: ${(e as Error).message}`);
        }
    }
    
    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    }

    if (programsToCreate.length > 0) {
        const createdPrograms = programsToCreate.map(prog => ({...prog, id: `prog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` }));
        savePrograms([...allPrograms, ...createdPrograms]);
    }
    
    return { successCount, errorCount: errors.length, errors };
};


// --- A'Level Eligibility Logic ---
const UACE_POINTS_MAP: Record<string, number> = { 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'O': 1, 'F': 0 };
const SUBSIDIARY_POINTS_MAP: Record<string, number> = { 'D1': 1, 'D2': 1, 'C3': 1, 'C4': 1, 'C5': 1, 'C6': 1, 'P7': 0, 'P8': 0, 'F9': 0 };

const calculateUacePerformance = (results: UnebPassSlip) => {
    let totalPoints = 0;
    let principalPasses = 0;
    let subsidiaryPasses = 0;
    const subjectsPassed: { name: string; grade: string }[] = [];

    results.subjects.forEach(subject => {
        const grade = subject.grade.toUpperCase();
        if (subject.name.toLowerCase() === 'general paper') {
            if (SUBSIDIARY_POINTS_MAP[grade] === 1) {
                subsidiaryPasses++;
                totalPoints++;
            }
        } else if (UACE_POINTS_MAP[grade] !== undefined) {
            totalPoints += UACE_POINTS_MAP[grade];
            if (UACE_POINTS_MAP[grade] >= 2) { // Grade E or better
                principalPasses++;
            } else if (UACE_POINTS_MAP[grade] === 1) { // Grade O
                subsidiaryPasses++;
            }
            subjectsPassed.push(subject);
        }
    });

    return { totalPoints, principalPasses, subsidiaryPasses, subjectsPassed };
};

export const findEligiblePrograms = (results: UnebPassSlip): Program[] => {
    if (results.level !== 'U.A.C.E') return [];

    const performance = calculateUacePerformance(results);
    const allPrograms = getPrograms().filter(p => p.level === 'Bachelors' || p.level === 'Diploma');
    const eligiblePrograms: Program[] = [];

    allPrograms.forEach(program => {
        const reqs = program.requirements;
        let isEligible = true;

        if (performance.principalPasses < reqs.principalPasses) isEligible = false;
        if (performance.subsidiaryPasses < reqs.subsidiaryPasses) isEligible = false;
        if (reqs.minPoints && performance.totalPoints < reqs.minPoints) isEligible = false;

        if (isEligible && reqs.essentialSubjects) {
            for (const reqSub of reqs.essentialSubjects) {
                const studentSubject = performance.subjectsPassed.find(s => s.name.toLowerCase() === reqSub.name.toLowerCase());
                if (!studentSubject || (UACE_POINTS_MAP[studentSubject.grade.toUpperCase()] < UACE_POINTS_MAP[reqSub.minGrade.toUpperCase()])) {
                    isEligible = false;
                    break;
                }
            }
        }
        
        if (isEligible) {
            eligiblePrograms.push(program);
        }
    });

    return eligiblePrograms;
};

// --- O'Level & U.C.E Guidance Logic ---
const aLevelCombinations: ALevelCombination[] = [
    { code: 'PCM', name: 'Physical Sciences', subjects: ['Physics', 'Chemistry', 'Mathematics'], description: 'Focuses on the core physical sciences, ideal for analytical and problem-solving minds.', careerProspects: ['Engineering (Civil, Electrical, Mechanical)', 'Computer Science', 'Architecture', 'Actuarial Science'] },
    { code: 'BCM', name: 'Biological Sciences', subjects: ['Biology', 'Chemistry', 'Mathematics'], description: 'Combines biology and chemistry with a strong mathematical foundation.', careerProspects: ['Medicine', 'Pharmacy', 'Dentistry', 'Veterinary Medicine', 'Biotechnology'] },
    { code: 'HEG', name: 'Humanities & Arts', subjects: ['History', 'Economics', 'Geography'], description: 'Explores social structures, economic principles, and the physical world.', careerProspects: ['Law', 'Journalism', 'Public Administration', 'Development Studies', 'Tourism'] },
    { code: 'LEG', name: 'Languages & Arts', subjects: ['Literature in English', 'Economics', 'Geography'], description: 'For students passionate about literature, economics, and geography.', careerProspects: ['Law', 'Journalism', 'Education', 'Social Work'] },
    { code: 'EGM', name: 'Economics & Mathematics', subjects: ['Economics', 'Geography', 'Mathematics'], description: 'A quantitative approach to understanding economic and geographical patterns.', careerProspects: ['Statistics', 'Quantitative Economics', 'Finance', 'Urban Planning'] },
    { code: 'FAD', name: 'Fine Arts', subjects: ['Fine Art', 'Economics', 'Divinity'], description: 'A combination for creative minds with an interest in design and commerce.', careerProspects: ['Industrial Art & Design', 'Fashion Design', 'Marketing'] },
];

export const getALevelCombinations = (): ALevelCombination[] => aLevelCombinations;

const oLevelTertiaryPrograms: Program[] = [
    { id: 'cert-pa', institutionId: '', ncheCode: 'CERT-PA', name: 'Certificate in Public Administration', faculty: 'Vocational', durationYears: 2, level: 'Certificate', requirements: { principalPasses: 0, subsidiaryPasses: 0, uceRequirements: "5 Passes in U.C.E" }, estimatedFees: 1200000, careerProspects: ['Local Government Clerk', 'Administrative Assistant'] },
    { id: 'cert-it', institutionId: '', ncheCode: 'CERT-IT', name: 'Certificate in Information Technology', faculty: 'Vocational', durationYears: 2, level: 'Certificate', requirements: { principalPasses: 0, subsidiaryPasses: 0, uceRequirements: "5 Passes in U.C.E including a Credit in Mathematics" }, estimatedFees: 1500000, careerProspects: ['IT Support Technician', 'Junior Web Developer'] },
    { id: 'dip-ba', institutionId: '', ncheCode: 'DIP-BA', name: 'Diploma in Business Administration', faculty: 'Vocational', durationYears: 2, level: 'Diploma', requirements: { principalPasses: 0, subsidiaryPasses: 0, uceRequirements: "5 Credits in U.C.E including English and Mathematics" }, estimatedFees: 1800000, careerProspects: ['Junior Accountant', 'Sales Representative', 'HR Assistant'] },
    { id: 'dip-jour', institutionId: '', ncheCode: 'DIP-JOUR', name: 'Diploma in Journalism', faculty: 'Vocational', durationYears: 2, level: 'Diploma', requirements: { principalPasses: 0, subsidiaryPasses: 0, uceRequirements: "5 Credits in U.C.E including a Credit in English" }, estimatedFees: 1700000, careerProspects: ['Radio Presenter', 'Reporter', 'Communications Assistant'] },
];

export const getOLevelGuidance = (latestResult: InternalExamResult): OLevelGuidance => {
    const topSubjects = latestResult.subjects.filter(s => s.score >= 70).sort((a, b) => b.score - a.score);
    const topSubjectNames = new Set(topSubjects.map(s => s.name));

    let combinationSuggestions = aLevelCombinations.filter(combo => {
        const matchCount = combo.subjects.filter(sub => topSubjectNames.has(sub)).length;
        return matchCount >= 2;
    });

    // --- NEW FALLBACK LOGIC ---
    if (combinationSuggestions.length === 0) {
        const sortedSubjects = [...latestResult.subjects].sort((a, b) => b.score - a.score);
        const passedSubjects = sortedSubjects.filter(s => s.score >= 50); // Using 50 as a passing mark

        if (passedSubjects.length >= 2) {
            const top1 = passedSubjects[0];
            const top2 = passedSubjects[1];

            // Attempt 1: Find a "perfect pair" combination.
            const perfectPairCombo = aLevelCombinations.find(combo => 
                combo.subjects.includes(top1.name) && combo.subjects.includes(top2.name)
            );

            if (perfectPairCombo) {
                combinationSuggestions = [perfectPairCombo];
            } else {
                // Attempt 2: Find a "strong anchor" combination.
                const studentScoresMap = new Map(latestResult.subjects.map(s => [s.name, s.score]));
                
                const potentialCombos = aLevelCombinations
                    .filter(combo => combo.subjects.includes(top1.name)) // Anchor on the best subject
                    .map(combo => {
                        const comboScore = combo.subjects.reduce((total, subName) => {
                            return total + (studentScoresMap.get(subName) || 0);
                        }, 0);
                        return { ...combo, score: comboScore };
                    });

                if (potentialCombos.length > 0) {
                    potentialCombos.sort((a, b) => b.score - a.score);
                    const { score, ...bestCombo } = potentialCombos[0];
                    combinationSuggestions = [bestCombo];
                }
            }
        }
    }
    // --- END of FALLBACK LOGIC ---

    const ucePasses = latestResult.subjects.filter(s => s.score >= 40).length;
    const uceCredits = latestResult.subjects.filter(s => s.score >= 60).length;
    const hasMathCredit = latestResult.subjects.some(s => s.name === 'Mathematics' && s.score >= 60);
    const hasEnglishCredit = latestResult.subjects.some(s => s.name === 'English' && s.score >= 60);

    const tertiarySuggestions = oLevelTertiaryPrograms.filter(prog => {
        const reqs = prog.requirements.uceRequirements || '';
        if (reqs.includes("5 Credits") && uceCredits < 5) return false;
        if (reqs.includes("5 Passes") && ucePasses < 5) return false;
        if (reqs.includes("Credit in Mathematics") && !hasMathCredit) return false;
        if (reqs.includes("Credit in English") && !hasEnglishCredit) return false;
        return true;
    });

    return { topSubjects, combinationSuggestions, tertiarySuggestions };
};

export const getUceGuidance = (uceResults: UnebPassSlip): OLevelGuidance => {
    const creditGrades = ['D1', 'D2', 'C3', 'C4', 'C5', 'C6'];
    const passGrades = [...creditGrades, 'P7', 'P8'];
    const gradePoints: Record<string, number> = { 'D1': 8, 'D2': 7, 'C3': 6, 'C4': 5, 'C5': 4, 'C6': 3, 'P7': 2, 'P8': 1, 'F9': 0 };

    const topSubjects = uceResults.subjects.filter(s => creditGrades.includes(s.grade.toUpperCase()));
    const topSubjectNames = new Set(topSubjects.map(s => s.name));

    let combinationSuggestions = aLevelCombinations.filter(combo => {
        const matchCount = combo.subjects.filter(sub => topSubjectNames.has(sub)).length;
        return matchCount >= 2;
    });

    // --- NEW FALLBACK LOGIC ---
    if (combinationSuggestions.length === 0) {
        const sortedSubjects = [...uceResults.subjects].sort((a, b) => 
            (gradePoints[b.grade.toUpperCase()] || 0) - (gradePoints[a.grade.toUpperCase()] || 0)
        );
        
        const passedSubjects = sortedSubjects.filter(s => passGrades.includes(s.grade.toUpperCase()));

        if (passedSubjects.length >= 2) {
            const top1 = passedSubjects[0];
            const top2 = passedSubjects[1];

            // Attempt 1: Find a "perfect pair" combination.
            const perfectPairCombo = aLevelCombinations.find(combo => 
                combo.subjects.includes(top1.name) && combo.subjects.includes(top2.name)
            );

            if (perfectPairCombo) {
                combinationSuggestions = [perfectPairCombo];
            } else {
                // Attempt 2: Find a "strong anchor" combination.
                const studentScoresMap = new Map(uceResults.subjects.map(s => [s.name, gradePoints[s.grade.toUpperCase()] || 0]));
                
                const potentialCombos = aLevelCombinations
                    .filter(combo => combo.subjects.includes(top1.name))
                    .map(combo => {
                        const comboScore = combo.subjects.reduce((total, subName) => {
                            return total + (studentScoresMap.get(subName) || 0);
                        }, 0);
                        return { ...combo, score: comboScore };
                    });

                if (potentialCombos.length > 0) {
                    potentialCombos.sort((a, b) => b.score - a.score);
                    const { score, ...bestCombo } = potentialCombos[0];
                    combinationSuggestions = [bestCombo];
                }
            }
        }
    }
    // --- END of FALLBACK LOGIC ---

    const uceCredits = uceResults.subjects.filter(s => creditGrades.includes(s.grade.toUpperCase())).length;
    const ucePasses = uceResults.subjects.filter(s => passGrades.includes(s.grade.toUpperCase())).length;
    const hasMathCredit = uceResults.subjects.some(s => s.name === 'Mathematics' && creditGrades.includes(s.grade.toUpperCase()));
    const hasEnglishCredit = uceResults.subjects.some(s => s.name === 'English' && creditGrades.includes(s.grade.toUpperCase()));

    const tertiarySuggestions = oLevelTertiaryPrograms.filter(prog => {
        const reqs = prog.requirements.uceRequirements || '';
        if (reqs.includes("5 Credits") && uceCredits < 5) return false;
        if (reqs.includes("5 Passes") && ucePasses < 5) return false;
        if (reqs.includes("Credit in Mathematics") && !hasMathCredit) return false;
        if (reqs.includes("Credit in English") && !hasEnglishCredit) return false;
        return true;
    });

    return { topSubjects, combinationSuggestions, tertiarySuggestions };
};


// --- S.5 & S.6 Internal Exam Guidance ---
const getALevelGradeFromScore = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C';
    if (score >= 65) return 'D';
    if (score >= 60) return 'E';
    if (score >= 50) return 'O';
    return 'F';
};

const getGPSubsidiaryGradeFromScore = (score: number): string => {
    if (score >= 65) return 'C6'; // Represents any subsidiary pass
    return 'F9'; // Represents a fail
};

export const getALevelGuidanceFromInternalExams = (internalResult: InternalExamResult) => {
    // 1. Convert internal scores to A'Level grades
    const uaceSubjects = internalResult.subjects.map(subject => {
        if (subject.name.toLowerCase() === 'general paper') {
            return { name: subject.name, grade: getGPSubsidiaryGradeFromScore(subject.score) };
        }
        return { name: subject.name, grade: getALevelGradeFromScore(subject.score) };
    });

    // 2. Create a mock UnebPassSlip to reuse existing logic
    const mockPassSlip: UnebPassSlip = {
        indexNo: 'INTERNAL_EXAM',
        name: 'Internal Exam Results',
        year: internalResult.term,
        level: 'U.A.C.E',
        subjects: uaceSubjects,
    };

    // 3. Calculate performance and find eligible programs using existing functions
    const performance = calculateUacePerformance(mockPassSlip);
    const eligiblePrograms = findEligiblePrograms(mockPassSlip);

    return { performance, eligiblePrograms };
};


// --- Data Seeding ---
export const seedNcheData = () => {
    if (getInstitutions().length > 0) return;
    console.log("Seeding initial NCHE data...");

    const mak = createInstitution({ name: 'Makerere University', acronym: 'MAK', type: 'University', ownership: 'Public', logoUrl: 'https://i.imgur.com/vHqjZ7g.png' });
    const mubs = createInstitution({ name: 'Makerere University Business School', acronym: 'MUBS', type: 'University', ownership: 'Public', logoUrl: 'https://i.imgur.com/r6y9dY8.png' });
    const kyu = createInstitution({ name: 'Kyambogo University', acronym: 'KYU', type: 'University', ownership: 'Public', logoUrl: 'https://i.imgur.com/i3vQMz4.png' });
    
    createProgram({
        institutionId: mak.id, ncheCode: 'MAK-CS', name: 'Bachelor of Science in Computer Science', faculty: 'Computing and Informatics Technology', durationYears: 3, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'Mathematics', minGrade: 'C' }], minPoints: 40 },
        estimatedFees: 2500000, careerProspects: ['Software Engineer', 'Data Scientist', 'Network Administrator']
    });
     createProgram({
        institutionId: mak.id, ncheCode: 'MAK-LAW', name: 'Bachelor of Laws', faculty: 'School of Law', durationYears: 4, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'History', minGrade: 'C' }, { name: 'Literature in English', minGrade: 'D'}], minPoints: 48 },
        estimatedFees: 3000000, careerProspects: ['Advocate', 'Corporate Lawyer', 'Legal Consultant']
    });
     createProgram({
        institutionId: mak.id, ncheCode: 'MAK-MD', name: 'Bachelor of Medicine and Bachelor of Surgery', faculty: 'Health Sciences', durationYears: 5, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'Biology', minGrade: 'B' }, { name: 'Chemistry', minGrade: 'B' }], minPoints: 45 },
        estimatedFees: 4500000, careerProspects: ['Medical Doctor', 'Surgeon', 'Public Health Specialist']
    });
    createProgram({
        institutionId: mubs.id, ncheCode: 'MUBS-BCOM', name: 'Bachelor of Commerce', faculty: 'Commerce', durationYears: 3, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'Economics', minGrade: 'C' }], minPoints: 35 },
        estimatedFees: 2200000, careerProspects: ['Accountant', 'Financial Analyst', 'Marketing Manager']
    });
    createProgram({
        institutionId: kyu.id, ncheCode: 'KYU-ENG', name: 'Bachelor of Engineering in Civil and Building Engineering', faculty: 'Engineering', durationYears: 4, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'Mathematics', minGrade: 'B' }, { name: 'Physics', minGrade: 'B' }], minPoints: 42 },
        estimatedFees: 2800000, careerProspects: ['Civil Engineer', 'Structural Engineer', 'Construction Manager']
    });
     createProgram({
        institutionId: kyu.id, ncheCode: 'KYU-ART', name: 'Bachelor of Art and Industrial Design', faculty: 'Vocational Studies', durationYears: 3, level: 'Bachelors',
        requirements: { principalPasses: 2, subsidiaryPasses: 1, essentialSubjects: [{ name: 'Fine Art', minGrade: 'C' }], minPoints: 28 },
        estimatedFees: 1800000, careerProspects: ['Graphic Designer', 'Fashion Designer', 'Product Designer']
    });

    console.log("NCHE data seeding complete.");
};
