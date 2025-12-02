
import { User, AdminUser } from '../types';
import { getAllAdminUsers, updateAdminUser } from './userService';
import { getUsers } from './studentService';
import { logAction } from './auditLogService';

const SESSION_KEY = '360_smart_school_session';
const SUPERADMIN_ID = 'admin';
const SUPERADMIN_PASS = 'admin';


/**
 * Logs in a user by their student ID and password.
 * @param studentId The student ID to look for.
 * @param password The student's password.
 * @returns The found user or null if not found or password incorrect.
 */
export const loginUser = (studentId: string, password?: string): User | null => {
    // Check for hardcoded superadmin credentials (case-insensitive for ID)
    if (studentId.toLowerCase() === SUPERADMIN_ID && password === SUPERADMIN_PASS) {
        const superadminUser: User = {
            name: 'Super Admin',
            studentId: SUPERADMIN_ID,
            class: 'System Control',
            role: 'superadmin',
            password: SUPERADMIN_PASS,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(superadminUser));
        return superadminUser;
    }

    const users = getUsers();
    const user = users.find(u => u.studentId === studentId);

    if (user && user.accountStatus === 'disabled') {
        console.warn(`Login attempt for disabled account: ${studentId}`);
        return null; // Prevent login for disabled accounts
    }
    
    // For backward compatibility with students created before passwords were a thing.
    // In a real app, you'd run a migration. Here, we allow login if no password is set.
    const isPasswordMatch = !user?.password || user.password === password;

    if (user && isPasswordMatch) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    }
    return null;
};


/**
 * Logs in an administrative user by their email and password.
 * @param email The user's email.
 * @param password The user's password.
 * @returns The found AdminUser or null if credentials are invalid.
 */
export const loginAdminUser = (email: string, password: string): AdminUser | null => {
    const adminUsers = getAllAdminUsers();
    const user = adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (user && user.password === password) {
        const userWithLoginTime: AdminUser = { ...user, lastLogin: Date.now() };

        // The update function needs all properties except id.
        const { id, ...dataToUpdate } = userWithLoginTime;
        updateAdminUser(user.id, dataToUpdate);
        
        // Log the successful login action for auditing
        logAction(user.id, user.name, 'ADMIN_LOGIN_SUCCESS', { role: user.role });

        localStorage.setItem(SESSION_KEY, JSON.stringify(userWithLoginTime));
        return userWithLoginTime;
    }

    return null;
};

/**
 * Attempts to log in a user with a single set of credentials,
 * automatically determining if they are a student, superadmin, or admin.
 * @param identifier The user's student ID or email.
 * @param password The user's password.
 * @returns The logged-in user object or null if credentials are invalid.
 */
export const unifiedLogin = (identifier: string, password: string): User | AdminUser | null => {
    // First, try logging in as a student or superadmin.
    const studentOrSuperadmin = loginUser(identifier, password);
    if (studentOrSuperadmin) {
        return studentOrSuperadmin;
    }

    // If that fails, try logging in as an admin.
    const admin = loginAdminUser(identifier, password);
    if (admin) {
        return admin;
    }

    // If both fail, return null.
    return null;
};


/**
 * Checks if there is an active user session.
 * @returns The user object (User or AdminUser) from the session or null.
 */
export const checkSession = (): User | AdminUser | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
};

/**
 * Logs out the current user by clearing the session.
 */
export const logout = (): void => {
    localStorage.removeItem(SESSION_KEY);
};
