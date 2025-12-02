import { AdminUser } from '../types';

const ADMIN_USERS_KEY = '360_smart_school_admin_users';

// Helper to get admin users from localStorage
const getAdminUsers = (): AdminUser[] => {
    const users = localStorage.getItem(ADMIN_USERS_KEY);
    return users ? JSON.parse(users) : [];
};

// Helper to save admin users to localStorage
const saveAdminUsers = (users: AdminUser[]) => {
    localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(users));
};

/**
 * Retrieves all registered admin users.
 * @returns An array of all admin users.
 */
export const getAllAdminUsers = (): AdminUser[] => {
    return getAdminUsers();
};

/**
 * Creates a new admin user with a provided password.
 * @param userData The user data to register, including the password.
 * @returns The newly created user.
 * @throws An error if a user with the same email already exists.
 */
export const createAdminUser = (userData: Omit<AdminUser, 'id'>): AdminUser => {
    const users = getAdminUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingUser) {
        throw new Error('A user with this email already exists.');
    }
    const newUser: AdminUser = {
        ...userData,
        id: `user_${Date.now()}`, // Simple unique ID
    };
    users.push(newUser);
    saveAdminUsers(users);
    return newUser;
};

/**
 * Updates an existing admin user's profile information.
 * @param userId The ID of the user to update.
 * @param updatedData The new data for the user.
 * @returns The updated user.
 * @throws An error if the user is not found or if the new email is taken.
 */
export const updateAdminUser = (userId: string, updatedData: Omit<AdminUser, 'id'>): AdminUser => {
    const users = getAdminUsers();
    let updatedUser: AdminUser | undefined;

    const existingUserWithEmail = users.find(u => u.email.toLowerCase() === updatedData.email.toLowerCase() && u.id !== userId);
    if (existingUserWithEmail) {
        throw new Error('A user with this email already exists.');
    }
    
    const newUsers = users.map(user => {
        if (user.id === userId) {
            // Preserve existing password if not provided in the update
            const password = updatedData.password || user.password;
            updatedUser = {
                ...user,
                ...updatedData,
                password,
            };
            return updatedUser;
        }
        return user;
    });

    if (!updatedUser) {
        throw new Error('User not found.');
    }

    saveAdminUsers(newUsers);
    return updatedUser;
};

/**
 * Resets a user's password to a new, specified password.
 * @param userId The ID of the user whose password will be reset.
 * @param newPassword The new password to set for the user.
 * @throws An error if the user is not found.
 */
export const resetAdminUserPassword = (userId: string, newPassword: string): void => {
    const users = getAdminUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }
    
    users[userIndex].password = newPassword;
    saveAdminUsers(users);
};


/**
 * Deletes an admin user by their ID.
 * @param userId The ID of the user to delete.
 */
export const deleteAdminUser = (userId: string): void => {
    let users = getAdminUsers();
    users = users.filter(user => user.id !== userId);
    saveAdminUsers(users);
};

/**
 * Assigns a specific headteacher to a school, ensuring any previous headteacher is unassigned.
 * @param schoolId The ID of the school.
 * @param headteacherId The ID of the headteacher to assign, or null to unassign.
 */
export const assignHeadteacherToSchool = (schoolId: string, headteacherId: string | null): void => {
    const users = getAdminUsers();

    // Find the newly selected headteacher
    const newHeadteacher = users.find(u => u.id === headteacherId);

    // If a new headteacher is selected, ensure they are not already assigned elsewhere.
    if (newHeadteacher && newHeadteacher.assignedSchoolIds.length > 0 && !newHeadteacher.assignedSchoolIds.includes(schoolId)) {
        throw new Error(`${newHeadteacher.name} is already assigned to another school.`);
    }

    // Unassign the school from any and all current headteachers
    users.forEach(user => {
        if (user.role === 'headteacher' && user.assignedSchoolIds.includes(schoolId)) {
            user.assignedSchoolIds = user.assignedSchoolIds.filter(id => id !== schoolId);
        }
    });

    // Assign the school to the new headteacher, if one was provided
    if (newHeadteacher) {
        if (!newHeadteacher.assignedSchoolIds.includes(schoolId)) {
            newHeadteacher.assignedSchoolIds.push(schoolId);
        }
    }

    saveAdminUsers(users);
};