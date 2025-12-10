// services/studentService.ts
import { User, SchoolUserRole, SchoolClass, SubjectPerformance, InternalExamResult, CompletedAdmission, ExtractedUnebSlipData, UnebPassSlip } from '../types';
import { getShops, saveShops } from './canteenService';
import { getClassesForSchool } from './classService';
import { findPendingTransferForStudent } from './settingsService';
import * as settingsService from './settingsService';

const USERS_KEY = '360_smart_school_users';

// Helper to get all users from localStorage
export const getUsers = (): User[] => {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
};

// Helper to save all users to localStorage
const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

/**
 * Retrieves all school users (students, teachers, etc.), excluding superadmins.
 * This is the source of truth for users stored in the main user table.
 * @returns An array of all school users.
 */
export const getAllSchoolUsers = (): User[] => {
    const allUsers = getUsers();
    return allUsers.filter(u => u.role !== 'superadmin');
};

/**
 * Retrieves all registered student users.
 * @returns An array of all student users.
 */
export const getAllStudents = (): User[] => {
    return getAllSchoolUsers().filter(u => u.role === 'student');
};


/**
 * Retrieves all users (excluding superadmins) belonging to a specific set of schools.
 * @param schoolIds An array of school IDs.
 * @returns An array of users from those schools.
 */
export const getSchoolUsersBySchoolIds = (schoolIds: string[]): User[] => {
    const allUsers = getAllSchoolUsers();
    return allUsers.filter(s => s.schoolId && schoolIds.includes(s.schoolId));
};

/**
 * Extracts a student ID from a generic identifier, which could be a plain ID or a complex barcode value.
 * @param identifier The full string from the barcode scanner or input.
 * @param schoolId The ID of the school to search for students in.
 * @returns The extracted student ID, or null if no match is found.
 */
export const extractStudentIdFromIdentifier = (identifier: string, schoolId: string): string | null => {
    if (!identifier) {
        return null;
    }
    const usersInSchool = getSchoolUsersBySchoolIds([schoolId]);

    // First, check for an exact match (case-insensitive)
    const exactMatchUser = usersInSchool.find(user => user.studentId.toLowerCase() === identifier.toLowerCase());
    if (exactMatchUser) {
        return exactMatchUser.studentId;
    }

    // Handle new 10-char format (e.g., OLS001XYZ1) by checking if an ID is a prefix
    if (identifier.length >= 3) {
        const potentialIdPart = identifier.substring(2);

        // Sort by studentId length, descending, to match longer IDs first (e.g., "S100" before "S10").
        const sortedUsers = [...usersInSchool].sort((a, b) => b.studentId.length - a.studentId.length);

        const foundUser = sortedUsers.find(user => potentialIdPart.toLowerCase().startsWith(user.studentId.toLowerCase()));
        if (foundUser) {
            return foundUser.studentId;
        }
    }
    
    // Fallback for if the plain ID is just entered directly
     const fallbackUser = usersInSchool.find(user => user.studentId.toLowerCase() === identifier.toLowerCase());
    if (fallbackUser) {
        return fallbackUser.studentId;
    }

    return null; // No match found
};


/**
 * Creates a new school user (student, teacher, etc.).
 * @param userData The user's data, including their role.
 * @returns The newly created user.
 * @throws An error if the User ID or email already exists.
 */
export const createSchoolUser = (userData: Omit<User, 'role' | 'superadmin'> & { role: SchoolUserRole }): User => {
    const users = getUsers();
    const existingUser = users.find(u => u.studentId === userData.studentId);
    if (existingUser) {
        throw new Error('A user with this User ID already exists.');
    }
    
    if (userData.role !== 'student' && userData.email) {
        const existingEmail = users.find(u => u.email?.toLowerCase() === userData.email?.toLowerCase());
        if (existingEmail) {
            throw new Error('A user with this email already exists.');
        }
    }

    // Security Feature: Check for pending transfer
    const pendingTransfer = findPendingTransferForStudent(userData.studentId, userData.schoolId || '');
    if (pendingTransfer) {
        userData.pendingTransferAcceptance = true;
    }

    const newUser: User = {
        ...userData,
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
};


/**
 * Creates multiple school users from an array of user data (e.g., from a CSV upload).
 * Performs validation and checks for duplicates.
 * @param usersData An array of user data objects to create.
 * @param schoolId The ID of the school to assign all new users to.
 * @returns An object reporting the number of successes, failures, and a list of specific errors.
 */
export const createBulkSchoolUsers = async (
    usersData: (Omit<User, 'schoolId' | 'class' | 'stream' | 'role' | 'superadmin' | 'mustChangePassword'> & { role?: string })[],
    schoolId: string,
    targetClass: string,
    csvText: string
): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
    const allUsers = getUsers();
    const errors: string[] = [];
    let successCount = 0;
    const usersToSave: User[] = [];
    const schoolUserRoles: SchoolUserRole[] = ['student', 'teacher', 'head_of_department', 'canteen_seller', 'deputy_headteacher', 'carrier', 'parent', 'old_student', 'admin', 'admission_agent'];

    // Use a Set for efficient duplicate checking within the file
    const fileUserIds = new Set<string>();
    
    const Papa = (window as any).Papa;
    if (!Papa) {
        throw new Error("CSV parsing library (PapaParse) is not available.");
    }
    
    const parsedData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;


    parsedData.forEach((row: any, index: number) => {
        const lineNumber = index + 2; // Assuming CSV has a header row
        const userData: any = Object.keys(row).reduce((acc: any, key) => {
            acc[key.trim().toLowerCase().replace(/\s/g, '')] = row[key];
            return acc;
        }, {});

        try {
            if (!userData.name || !userData.studentid || !userData.password) {
                throw new Error(`Missing required fields (name, studentId, password).`);
            }
            
            if (allUsers.some(u => u.studentId.toLowerCase() === userData.studentid.toLowerCase())) {
                throw new Error(`User ID "${userData.studentid}" already exists in the system.`);
            }

            if (fileUserIds.has(userData.studentid.toLowerCase())) {
                throw new Error(`Duplicate User ID "${userData.studentid}" found in the file.`);
            }
            fileUserIds.add(userData.studentid.toLowerCase());
            
            const providedRole = userData.role?.trim().toLowerCase();
            let role: SchoolUserRole = 'student';
            if (providedRole) {
                if (schoolUserRoles.includes(providedRole as SchoolUserRole)) {
                    role = providedRole as SchoolUserRole;
                } else {
                     throw new Error(`Invalid role "${userData.role}". Valid roles are: ${schoolUserRoles.join(', ')}.`);
                }
            }

            // Security Feature: Check for pending transfer
            const pendingTransfer = findPendingTransferForStudent(userData.studentid, schoolId || '');

            const newUser: User = {
                name: userData.name,
                studentId: userData.studentid,
                password: userData.password,
                role: role, 
                mustChangePassword: true,
                schoolId,
                class: role === 'student' ? targetClass : undefined,
                stream: role === 'student' ? userData.stream : undefined,
                pendingTransferAcceptance: !!pendingTransfer,
            };
            usersToSave.push(newUser);
            successCount++;

        } catch (e) {
            errors.push(`Line ${lineNumber}: ${(e as Error).message}`);
        }
    });

    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    }

    if (successCount > 0) {
        saveUsers([...allUsers, ...usersToSave]);
    }

    return {
        successCount,
        errorCount: errors.length,
        errors,
    };
};



/**
 * Updates an existing school user's information.
 * @param userId The ID of the user to update (using the `studentId` field).
 * @param updatedData The new data for the user.
 * @returns The updated user.
 */
export const updateSchoolUser = (userId: string, updatedData: Partial<Omit<User, 'studentId'>>): User => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.studentId === userId);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }
    
    if (updatedData.email && updatedData.role !== 'student') {
        const existingEmail = users.find(u => u.email?.toLowerCase() === updatedData.email?.toLowerCase() && u.studentId !== userId);
        if (existingEmail) {
            throw new Error('A user with this email already exists.');
        }
    }

    const updatedUser = { ...users[userIndex], ...updatedData };
    
    users[userIndex] = updatedUser;
    saveUsers(users);
    return updatedUser;
};

/**
 * Deletes a school user by their ID.
 * @param userId The ID of the user to delete (using the `studentId` field).
 */
export const deleteSchoolUser = (userId: string): void => {
    let users = getUsers();
    users = users.filter(u => u.studentId !== userId);
    saveUsers(users);
};


/**
 * Resets a school user's password to a new, provided password.
 * @param userId The ID of the user (using the `studentId` field).
 * @param newPassword The new password to set for the user.
 * @throws An error if the user is not found.
 */
export const resetSchoolUserPassword = (userId: string, newPassword: string): void => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.studentId === userId);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }
    
    users[userIndex].password = newPassword;
    users[userIndex].mustChangePassword = true;
    saveUsers(users);
};

/**
 * Changes a user's password and removes the temporary password flag.
 * @param userId The ID of the user (studentId).
 * @param newPassword The new password to set.
 * @returns The updated user object.
 */
export const changePassword = (userId: string, newPassword: string): User => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.studentId === userId);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    const updatedUser: User = {
        ...users[userIndex],
        password: newPassword,
        mustChangePassword: false,
    };

    users[userIndex] = updatedUser;
    saveUsers(users);
    return updatedUser;
};

/**
 * Assigns a user as a canteen seller for a specific shop.
 * This is an atomic operation that handles unassigning previous owners.
 * @param userId The ID of the user to assign.
 * @param shopId The ID of the shop to assign them to.
 */
export const assignSellerToShop = (userId: string, shopId: string): void => {
    const users = getUsers();
    const shops = getShops();

    const targetUser = users.find(u => u.studentId === userId);
    const targetShop = shops.find(s => s.id === shopId);

    if (!targetUser) throw new Error("User to be assigned not found.");
    if (!targetShop) throw new Error("Shop not found.");

    if (targetShop.ownerId) {
        const currentOwner = users.find(u => u.studentId === targetShop.ownerId);
        if (currentOwner) {
            currentOwner.role = 'student';
            delete currentOwner.shopId;
        }
    }

    if (targetUser.shopId) {
        const oldShop = shops.find(s => s.id === targetUser.shopId);
        if (oldShop) {
            delete oldShop.ownerId;
        }
    }
    
    targetUser.role = 'canteen_seller';
    targetUser.shopId = shopId;
    targetShop.ownerId = userId;

    saveUsers(users);
    saveShops(shops);
};

/**
 * Unassigns the current seller from a shop.
 * @param shopId The ID of the shop.
 */
export const unassignSellerFromShop = (shopId: string): void => {
    const users = getUsers();
    const shops = getShops();

    const targetShop = shops.find(s => s.id === shopId);
    if (!targetShop || !targetShop.ownerId) return;

    const currentOwner = users.find(u => u.studentId === targetShop.ownerId);
    if (currentOwner) {
        currentOwner.role = 'student';
        delete currentOwner.shopId;
    }

    delete targetShop.ownerId;

    saveUsers(users);
    saveShops(shops);
};

/**
 * Assigns a user as a carrier for a specific shop.
 * @param userId The ID of the user to assign.
 * @param shopId The ID of the shop to assign them to.
 */
export const assignCarrierToShop = (userId: string, shopId: string): void => {
    const users = getUsers();
    const shops = getShops();
    
    const targetUser = users.find(u => u.studentId === userId);
    const targetShop = shops.find(s => s.id === shopId);
    
    if (!targetUser) throw new Error("User to be assigned not found.");
    if (!targetShop) throw new Error("Shop not found.");
    
    // Set user role
    targetUser.role = 'carrier';
    
    // Add to shop's carrier list
    if (!targetShop.carrierIds) {
        targetShop.carrierIds = [];
    }
    if (!targetShop.carrierIds.includes(userId)) {
        targetShop.carrierIds.push(userId);
    }
    
    saveUsers(users);
    saveShops(shops);
};

/**
 * Unassigns a carrier from a shop.
 * @param userId The ID of the user to unassign.
 * @param shopId The ID of the shop.
 */
export const unassignCarrierFromShop = (userId: string, shopId: string): void => {
    const users = getUsers();
    const shops = getShops();
    
    const targetUser = users.find(u => u.studentId === userId);
    const targetShop = shops.find(s => s.id === shopId);

    if (!targetUser) throw new Error("User to be unassigned not found.");
    if (!targetShop || !targetShop.carrierIds) return;
    
    // Remove from carrier list
    targetShop.carrierIds = targetShop.carrierIds.filter(id => id !== userId);
    
    // If they are no longer a carrier for any other shop, revert their role
    const isCarrierForOtherShops = shops.some(s => s.carrierIds?.includes(userId));
    if (!isCarrierForOtherShops) {
        targetUser.role = 'student'; // Revert to a default role
    }
    
    saveUsers(users);
    saveShops(shops);
};

// --- Internal Results Management ---
const calculateGrade = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    if (score >= 40) return 'P';
    return 'F';
};

export const saveGradesForSubject = (
    schoolId: string,
    className: string,
    stream: string | undefined,
    subjectName: string,
    term: string,
    grades: { studentId: string; score: number; remarks: string }[]
): void => {
    const allUsers = getUsers();
    const classStudents = allUsers.filter(u => 
        u.schoolId === schoolId &&
        u.class === className &&
        (stream ? u.stream === stream : true) &&
        u.role === 'student'
    );

    const studentIdsInClass = new Set(classStudents.map(s => s.studentId));

    // Update scores for the provided students
    grades.forEach(({ studentId, score, remarks }) => {
        if (!studentIdsInClass.has(studentId)) {
            console.warn(`Attempted to save grade for student ${studentId} who is not in the selected class. Skipping.`);
            return;
        }

        const studentIndex = allUsers.findIndex(u => u.studentId === studentId);
        if (studentIndex === -1) return;

        const student = allUsers[studentIndex];
        if (!student.internalExams) student.internalExams = [];

        let termResult = student.internalExams.find(r => r.term === term);
        if (!termResult) {
            termResult = { term, subjects: [], average: 0, classPosition: '' };
            student.internalExams.push(termResult);
        }

        let subjectPerf = termResult.subjects.find(s => s.name === subjectName);
        if (!subjectPerf) {
            subjectPerf = { name: subjectName, score: 0, grade: '', remarks: '' };
            termResult.subjects.push(subjectPerf);
        }

        subjectPerf.score = Math.max(0, Math.min(100, score)); // Clamp score
        subjectPerf.grade = calculateGrade(subjectPerf.score);
        subjectPerf.remarks = remarks;

        allUsers[studentIndex] = student;
    });

    // Recalculate averages and positions for the entire class for that term
    const studentAverages: { studentId: string; average: number }[] = [];

    classStudents.forEach(student => {
        const studentRef = allUsers.find(u => u.studentId === student.studentId)!;
        const termResult = studentRef.internalExams?.find(r => r.term === term);

        if (termResult) {
            const totalScore = termResult.subjects.reduce((sum, s) => sum + s.score, 0);
            const average = termResult.subjects.length > 0 ? totalScore / termResult.subjects.length : 0;
            termResult.average = average;
            studentAverages.push({ studentId: student.studentId, average });
        }
    });

    // Sort by average to determine rank
    studentAverages.sort((a, b) => b.average - a.average);

    let rank = 0;
    let lastAverage = -1;
    const totalStudentsInClass = classStudents.length;

    studentAverages.forEach((avgData, index) => {
        if (avgData.average !== lastAverage) {
            rank = index + 1;
            lastAverage = avgData.average;
        }

        const studentIndex = allUsers.findIndex(u => u.studentId === avgData.studentId);
        if (studentIndex > -1) {
            const termResult = allUsers[studentIndex].internalExams?.find(r => r.term === term);
            if (termResult) {
                termResult.classPosition = `${rank} out of ${totalStudentsInClass}`;
            }
        }
    });

    saveUsers(allUsers);
};


const normalizeClassName = (name: string | undefined): string => {
    if (!name) return '';
    let normalized = name.toUpperCase().replace(/[\s.-]/g, '');
    normalized = normalized.replace(/^SENIOR/, 'S');
    normalized = normalized.replace(/^FORM/, 'F');
    if (normalized.startsWith('F')) {
        normalized = 'S' + normalized.substring(1);
    }
    return normalized;
};


export const bulkUploadInternalResults = (
    csvText: string,
    schoolId: string,
    classId: string,
    stream: string | undefined
): { successCount: number; errorCount: number; errors: string[] } => {
    const allUsers = getUsers();
    const errors: string[] = [];
    const classesForSchool = getClassesForSchool(schoolId);
    const selectedClass = classesForSchool.find(c => c.id === classId);

    if (!selectedClass) {
        throw new Error("The selected class could not be found.");
    }

    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error("CSV file is empty or contains only a header.");
    }

    const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/"/g, '').toLowerCase().replace(/\s/g, ''));
    
    const required = ['studentid', 'term', 'subject', 'score'];
    const missing = required.filter(h => !header.includes(h));
    if (missing.length > 0) {
        throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
    }

    const studentIdIndex = header.indexOf('studentid');
    const termIndex = header.indexOf('term');
    const subjectIndex = header.indexOf('subject');
    const scoreIndex = header.indexOf('score');

    const allUsersMap = new Map(allUsers.map(u => [u.studentId.toLowerCase(), u]));
    const resultsByTerm: Record<string, { studentId: string, subject: string, score: number, studentName: string }[]> = {};

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const studentId = values[studentIdIndex]?.trim();
        const term = values[termIndex]?.trim();
        const subject = values[subjectIndex]?.trim();
        const score = parseInt(values[scoreIndex]?.trim(), 10);

        if (!studentId || !term || !subject || isNaN(score)) {
            errors.push(`Line ${i + 1}: Contains invalid or missing data.`);
            continue;
        }

        const student = allUsersMap.get(studentId.toLowerCase());
        if (!student) {
            errors.push(`Line ${i + 1}: Student with ID "${studentId}" not found.`);
            continue;
        }

        const studentClassNormalized = normalizeClassName(student.class);
        const selectedClassNormalized = normalizeClassName(selectedClass.name);

        const isClassMismatch = studentClassNormalized !== selectedClassNormalized;
        
        if (student.schoolId !== schoolId || isClassMismatch) {
            throw new Error("The class of one or more students in your file doesn't match the selected class. Please check your CSV and try again.");
        }
        
        const isStreamMismatch = stream && (student.stream?.toLowerCase() !== stream.toLowerCase());
        
        if (isStreamMismatch) {
             errors.push(`Line ${i + 1}: Student "${student.name}" (${studentId}) does not match the selected stream "${stream}".`);
            continue;
        }

        if (!resultsByTerm[term]) {
            resultsByTerm[term] = [];
        }
        resultsByTerm[term].push({ studentId, subject, score, studentName: student.name });
    }

    if (errors.length > 0) {
        return { successCount: 0, errorCount: errors.length, errors };
    }

    for (const term in resultsByTerm) {
        const termData = resultsByTerm[term];
        const studentResultsInTerm: Record<string, { subjects: { name: string, score: number }[] }> = {};

        termData.forEach(row => {
            if (!studentResultsInTerm[row.studentId]) {
                studentResultsInTerm[row.studentId] = { subjects: [] };
            }
            studentResultsInTerm[row.studentId].subjects.push({ name: row.subject, score: row.score });
        });

        let studentAverages = Object.entries(studentResultsInTerm).map(([studentId, data]) => {
            const totalScore = data.subjects.reduce((sum, s) => sum + s.score, 0);
            const average = data.subjects.length > 0 ? totalScore / data.subjects.length : 0;
            const subjectsWithGrades = data.subjects.map(s => ({ ...s, grade: calculateGrade(s.score) }));
            return { studentId, average, subjects: subjectsWithGrades };
        });

        studentAverages.sort((a, b) => b.average - a.average);
        
        let rank = 1;
        const rankedStudents = studentAverages.map((student, index) => {
            if (index > 0 && student.average < studentAverages[index - 1].average) {
                rank = index + 1;
            }
            return { ...student, rank };
        });
        
        const totalStudentsInTerm = rankedStudents.length;

        rankedStudents.forEach(rankedStudent => {
            const studentIndex = allUsers.findIndex(u => u.studentId.toLowerCase() === rankedStudent.studentId.toLowerCase());
            if (studentIndex > -1) {
                const student = allUsers[studentIndex];
                if (!student.internalExams) student.internalExams = [];

                const newResult: InternalExamResult = {
                    term,
                    subjects: rankedStudent.subjects,
                    average: rankedStudent.average,
                    classPosition: `${rankedStudent.rank} out of ${totalStudentsInTerm}`
                };

                const existingResultIndex = student.internalExams.findIndex(e => e.term.toLowerCase() === term.toLowerCase());
                if (existingResultIndex > -1) {
                    student.internalExams[existingResultIndex] = newResult;
                } else {
                    student.internalExams.push(newResult);
                }
                allUsers[studentIndex] = student;
            }
        });
    }

    const uniqueStudentsUpdatedCount = new Set(Object.values(resultsByTerm).flat().map(r => r.studentId)).size;
    
    if (uniqueStudentsUpdatedCount > 0) {
        saveUsers(allUsers);
    }

    return { successCount: uniqueStudentsUpdatedCount, errorCount: errors.length, errors };
};

export const createSchoolUserFromAdmission = (admission: CompletedAdmission, schoolId: string): { studentId: string; tempPass: string } => {
    const admissionData = admission.data;
    const studentName = 'candidateName' in admissionData ? admissionData.candidateName : admissionData.name;
    const indexNo = 'indexNumber' in admissionData ? admissionData.indexNumber : admissionData.indexNo;
    
    const studentId = `${schoolId}-${indexNo.replace(/[\/\s]/g, '')}`;
    const tempPass = Math.random().toString(36).slice(-8);

    let unebData: UnebPassSlip | undefined = undefined;

    if ('level' in admissionData) {
        unebData = admissionData;
    } else {
        const year = admissionData.yearOfExamination;
        const examType = admissionData.examinationType || '';
        const level: 'P.L.E' | 'U.C.E' | 'U.A.C.E' =
            examType.includes('ADVANCED') ? 'U.A.C.E' :
            examType.includes('PRIMARY') ? 'P.L.E' : 'U.C.E';

        unebData = {
            indexNo: admissionData.indexNumber,
            name: admissionData.candidateName,
            year: year,
            level: level,
            subjects: admissionData.subjects.map(s => ({ name: s.subjectName, grade: s.gradeNumber })),
            dateOfBirth: admissionData.dateOfBirth,
            schoolName: admissionData.schoolName,
            schoolAddress: admissionData.schoolAddress,
            entryCode: admissionData.entryCode,
            aggregate: admissionData.gradeAggregate,
            result: admissionData.overallResult,
        };
    }

    const newUser: Omit<User, 'role' | 'superadmin'> & { role: SchoolUserRole } = {
        name: studentName,
        studentId: studentId,
        schoolId: schoolId,
        class: admission.targetClass,
        role: 'student',
        password: tempPass,
        mustChangePassword: true,
        dateOfBirth: admission.data.dateOfBirth,
        unebPassSlip: unebData,
        accountStatus: 'active',
        gender: admission.gender,
    };
    
    createSchoolUser(newUser);

    return { studentId, tempPass };
};

export const createTemporaryUserFromAdmission = (admissionData: UnebPassSlip | ExtractedUnebSlipData, schoolId: string, gender: 'Male' | 'Female'): { studentId: string; tempPass: string } => {
    const indexNo = 'indexNumber' in admissionData ? admissionData.indexNumber : admissionData.indexNo;
    const studentName = 'candidateName' in admissionData ? admissionData.candidateName : admissionData.name;
    
    const newUser: User = {
        name: studentName,
        studentId: indexNo,
        schoolId: schoolId,
        password: 'Student.New',
        mustChangePassword: true,
        role: 'student',
        accountStatus: 'temporary',
        unebPassSlip: 'level' in admissionData ? admissionData : undefined,
        gender: gender,
    };
    
    const users = getUsers();
    const existingUser = users.find(u => u.studentId === newUser.studentId);
    if (existingUser) {
        // If a temporary user already exists, just update their schoolId and reset password flag
        existingUser.schoolId = schoolId;
        existingUser.mustChangePassword = true;
        existingUser.password = 'Student.New';
        existingUser.gender = gender;
        updateSchoolUser(existingUser.studentId, existingUser);
    } else {
        users.push(newUser);
        saveUsers(users);
    }

    return { studentId: indexNo, tempPass: 'Student.New' };
};

export const disableTemporaryAccount = (studentId: string): void => {
    updateSchoolUser(studentId, { accountStatus: 'disabled' });
    // The automatic deletion after 30 days is a complex background task.
    // For this simulation, we'll just leave the account as 'disabled'.
};

export const transferStudent = (studentId: string, newSchoolId: string): void => {
    updateSchoolUser(studentId, { schoolId: newSchoolId });
};

export const bulkUpdateStudentsStatus = (studentIds: string[], status: User['accountStatus']): void => {
    const users = getUsers();
    let updatedCount = 0;
    const newUsers = users.map(user => {
        if ('studentId' in user && studentIds.includes(user.studentId)) {
            user.accountStatus = status;
            updatedCount++;
        }
        return user;
    });
    if (updatedCount > 0) {
        saveUsers(newUsers);
    }
};

export const bulkUpdateStudentsClass = (studentIds: string[], newClass: string, newStream: string): void => {
    const users = getUsers();
    let updatedCount = 0;
    const newUsers = users.map(user => {
        if ('studentId' in user && studentIds.includes(user.studentId)) {
            user.class = newClass;
            user.stream = newStream;
            updatedCount++;
        }
        return user;
    });
    if (updatedCount > 0) {
        saveUsers(newUsers);
    }
};
