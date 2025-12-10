
// services/classService.ts
import { SchoolClass, User } from '../types';

const CLASSES_KEY = '360_smart_school_classes';

// Internal helper to get raw user data for migrations
const getUsers = (): User[] => {
    const users = localStorage.getItem('360_smart_school_users');
    return users ? JSON.parse(users) : [];
};

// Internal helper to save raw user data during migrations
const saveUsers = (users: User[]) => {
    localStorage.setItem('360_smart_school_users', JSON.stringify(users));
};

export const getClasses = (): SchoolClass[] => {
    const data = localStorage.getItem(CLASSES_KEY);
    if (!data) return [];
    // Backward compatibility: add level if missing
    const classes = JSON.parse(data) as any[];
    return classes.map(c => {
        if (!c.level) {
            const name = c.name.toUpperCase().replace(/[\s.-]/g, '');
            if (['S5', 'S6'].includes(name)) {
                c.level = 'A-Level';
            } else {
                c.level = 'O-Level';
            }
        }
        return c;
    });
};

const saveClasses = (classes: SchoolClass[]) => {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
};

export const getClassesForSchool = (schoolId: string): SchoolClass[] => {
    // Sort to ensure S.1 comes before S.2, etc.
    return getClasses()
        .filter(c => c.schoolId === schoolId)
        // FIX: Explicitly type sort parameters to prevent type inference issues.
        .sort((a: SchoolClass, b: SchoolClass) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
};

export const createClass = (schoolId: string, name: string, level: 'O-Level' | 'A-Level', streams: string[]): SchoolClass => {
    const allClasses = getClasses();
    const schoolClasses = allClasses.filter(c => c.schoolId === schoolId);

    if (schoolClasses.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`A class named "${name}" already exists for this school.`);
    }

    const newClass: SchoolClass = {
        id: `class_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        schoolId,
        name,
        level,
        streams: [...new Set(streams)], // Ensure unique streams
    };

    allClasses.push(newClass);
    saveClasses(allClasses);
    return newClass;
};

export const createDefaultClassesForSchool = (schoolId: string): void => {
    const defaultClasses = [
        { name: 'S.1', level: 'O-Level' as const },
        { name: 'S.2', level: 'O-Level' as const },
        { name: 'S.3', level: 'O-Level' as const },
        { name: 'S.4', level: 'O-Level' as const },
        { name: 'S.5', level: 'A-Level' as const },
        { name: 'S.6', level: 'A-Level' as const },
    ];
    
    for (const c of defaultClasses) {
        try {
            createClass(schoolId, c.name, c.level, []);
        } catch (e) {
            // Ignore if class already exists
            console.warn(`Could not create default class ${c.name}: ${(e as Error).message}`);
        }
    }
};

export const updateClass = (classId: string, schoolId: string, name: string, streams: string[]): SchoolClass => {
    const allClasses = getClasses();
    const classIndex = allClasses.findIndex(c => c.id === classId);

    if (classIndex === -1) {
        throw new Error("Class not found.");
    }

    const updatedClass: SchoolClass = {
        ...allClasses[classIndex],
        name,
        streams: [...new Set(streams)], // Ensure unique streams
    };

    allClasses[classIndex] = updatedClass;
    saveClasses(allClasses);
    return updatedClass;
};

export const deleteClass = (classId: string): void => {
    // Deleting default classes is disallowed by removing the UI button.
    // This function is kept for potential future use or debugging but should not be called from the main UI.
    console.warn("Attempted to delete a class. This operation is disabled for default classes.");
};

// FIX: Implement missing stream management functions.
export const addClassStream = (classId: string, streamName: string): void => {
    const allClasses = getClasses();
    const classIndex = allClasses.findIndex(c => c.id === classId);
    if (classIndex === -1) {
        throw new Error("Class not found.");
    }
    const targetClass = allClasses[classIndex];
    if (targetClass.streams.some(s => s.toLowerCase() === streamName.toLowerCase())) {
        throw new Error(`Stream "${streamName}" already exists in this class.`);
    }
    targetClass.streams.push(streamName);
    allClasses[classIndex] = targetClass;
    saveClasses(allClasses);
};

export const updateClassStream = (classId: string, oldStreamName: string, newStreamName: string): void => {
    const allClasses = getClasses();
    const classIndex = allClasses.findIndex(c => c.id === classId);
    if (classIndex === -1) {
        throw new Error("Class not found.");
    }
    const targetClass = allClasses[classIndex];
    const streamIndex = targetClass.streams.findIndex(s => s.toLowerCase() === oldStreamName.toLowerCase());
    if (streamIndex === -1) {
        throw new Error(`Stream "${oldStreamName}" not found in this class.`);
    }
    if (targetClass.streams.some(s => s.toLowerCase() === newStreamName.toLowerCase() && s.toLowerCase() !== oldStreamName.toLowerCase())) {
        throw new Error(`Stream "${newStreamName}" already exists in this class.`);
    }

    // Update class stream
    targetClass.streams[streamIndex] = newStreamName;
    allClasses[classIndex] = targetClass;
    saveClasses(allClasses);

    // Update students
    const allUsers = getUsers();
    let usersUpdated = false;
    allUsers.forEach(user => {
        if (user.class === targetClass.name && user.stream === oldStreamName) {
            user.stream = newStreamName;
            usersUpdated = true;
        }
    });
    if (usersUpdated) {
        saveUsers(allUsers);
    }
};

export const removeClassStream = (classId: string, streamName: string): void => {
    const allClasses = getClasses();
    const classIndex = allClasses.findIndex(c => c.id === classId);
    if (classIndex === -1) {
        throw new Error("Class not found.");
    }
    const targetClass = allClasses[classIndex];
    const initialStreamCount = targetClass.streams.length;
    targetClass.streams = targetClass.streams.filter(s => s.toLowerCase() !== streamName.toLowerCase());
    if (targetClass.streams.length === initialStreamCount) {
        // No change, stream didn't exist
        return;
    }

    // Update class streams
    allClasses[classIndex] = targetClass;
    saveClasses(allClasses);

    // Update students
    const allUsers = getUsers();
    let usersUpdated = false;
    allUsers.forEach(user => {
        if (user.class === targetClass.name && user.stream === streamName) {
            user.stream = ''; // Unassign stream as per UI message
            usersUpdated = true;
        }
    });
    if (usersUpdated) {
        saveUsers(allUsers);
    }
};
