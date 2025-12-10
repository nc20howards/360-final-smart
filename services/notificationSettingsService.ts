// services/notificationSettingsService.ts

const NOTIFICATION_SETTINGS_KEY = '360_smart_school_notification_settings';

export interface NotificationPreferences {
    receivePushNotifications: boolean; // Master toggle
    groupMessages: boolean;
    directMessages: boolean;
    orderUpdates: boolean;
    schoolAnnouncements: boolean;
}

const getDefaultPreferences = (): NotificationPreferences => ({
    receivePushNotifications: true,
    groupMessages: true,
    directMessages: true,
    orderUpdates: true,
    schoolAnnouncements: true,
});

const getAllSettings = (): Record<string, NotificationPreferences> => {
    const data = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return data ? JSON.parse(data) : {};
};

const saveAllSettings = (settings: Record<string, NotificationPreferences>) => {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
};

export const getNotificationSettingsForUser = (userId: string): NotificationPreferences => {
    const allSettings = getAllSettings();
    // Merge with defaults to ensure all properties exist for users who haven't set them yet.
    return {
        ...getDefaultPreferences(),
        ...(allSettings[userId] || {}),
    };
};

export const saveNotificationSettingsForUser = (userId: string, preferences: NotificationPreferences): void => {
    const allSettings = getAllSettings();
    allSettings[userId] = preferences;
    saveAllSettings(allSettings);
};
