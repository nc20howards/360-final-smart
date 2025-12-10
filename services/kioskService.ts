
import { KioskLogEntry } from '../types';

const KIOSK_LOGS_KEY = '360_smart_school_kiosk_logs';

export const getKioskLogs = (schoolId: string): KioskLogEntry[] => {
    const allLogs = JSON.parse(localStorage.getItem(KIOSK_LOGS_KEY) || '[]');
    return (allLogs as KioskLogEntry[]).filter(l => l.schoolId === schoolId).sort((a, b) => b.timestamp - a.timestamp);
};

export const logKioskAction = (
    schoolId: string, 
    type: KioskLogEntry['type'], 
    description: string, 
    userId?: string, 
    userName?: string,
    details?: any
) => {
    const allLogs = JSON.parse(localStorage.getItem(KIOSK_LOGS_KEY) || '[]');
    const newLog: KioskLogEntry = {
        id: `klog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        schoolId,
        type,
        timestamp: Date.now(),
        description,
        userId,
        userName,
        details
    };
    allLogs.push(newLog);
    localStorage.setItem(KIOSK_LOGS_KEY, JSON.stringify(allLogs));
};
