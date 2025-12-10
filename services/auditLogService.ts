
// services/auditLogService.ts

import { AuditLogEntry } from '../types';
import { getUsers } from './studentService';
import { getAllAdminUsers } from './userService';

const AUDIT_LOG_KEY = '360_smart_school_audit_logs';

const getLogs = (): AuditLogEntry[] => {
    const logs = localStorage.getItem(AUDIT_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
};

const saveLogs = (logs: AuditLogEntry[]) => {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
};

/**
 * Retrieves all audit logs, sorted with the most recent entries first.
 * @returns An array of all AuditLogEntry objects.
 */
export const getAllLogs = (): AuditLogEntry[] => {
    // FIX: Explicitly type sort parameters to prevent type inference issues.
    return getLogs().sort((a: AuditLogEntry, b: AuditLogEntry) => b.timestamp - a.timestamp); // Show newest first
};

/**
 * Creates and saves a new audit log entry.
 * @param userId The ID of the user performing the action.
 * @param userName The name of the user.
 * @param action A string identifier for the action (e.g., 'PAPER_UPLOAD').
 * @param details A record object containing relevant data about the action.
 */
export const logAction = (userId: string, userName: string, action: string, details: Record<string, any>) => {
    const logs = getLogs();
    
    // Attempt to resolve the schoolId for better filtering
    let schoolId: string | undefined = undefined;
    
    // Check students/staff
    const student = getUsers().find(u => u.studentId === userId);
    if (student) {
        schoolId = student.schoolId;
    } else {
        // Check admins
        const admin = getAllAdminUsers().find(u => u.id === userId);
        if (admin && admin.assignedSchoolIds.length > 0) {
            schoolId = admin.assignedSchoolIds[0];
        }
    }

    const newLog: AuditLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        userId,
        userName,
        action,
        details,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`, // Simulate a local IP
        schoolId: schoolId // Save the resolved school ID
    };
    logs.push(newLog);
    saveLogs(logs);
};
