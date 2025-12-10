// services/presenceService.ts

const PRESENCE_KEY = '360_smart_school_presence';
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // Users are considered online if active within the last 2 minutes.

/**
 * Retrieves the raw presence data from localStorage.
 * @returns A record mapping user IDs to their last-seen timestamp.
 */
const getPresenceData = (): Record<string, number> => {
    const data = localStorage.getItem(PRESENCE_KEY);
    return data ? JSON.parse(data) : {};
};

/**
 * Saves the presence data back to localStorage.
 * @param data The presence data object to save.
 */
const savePresenceData = (data: Record<string, number>) => {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(data));
};

/**
 * Marks a user as currently online by updating their timestamp.
 * This should be called periodically by the active user to maintain their online status.
 * @param userId The ID of the user to mark as active.
 */
export const heartbeat = (userId: string): void => {
    const data = getPresenceData();
    data[userId] = Date.now();
    savePresenceData(data);
};

/**
 * Checks if a user is considered online based on their last heartbeat timestamp.
 * @param userId The ID of the user to check.
 * @returns true if the user's last activity was within the defined threshold, false otherwise.
 */
export const isOnline = (userId: string): boolean => {
    const data = getPresenceData();
    const lastSeen = data[userId];
    if (!lastSeen) {
        return false;
    }
    // Check if the time since the last heartbeat is less than our threshold.
    return (Date.now() - lastSeen) < ONLINE_THRESHOLD_MS;
};
