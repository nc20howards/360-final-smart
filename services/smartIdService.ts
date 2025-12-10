import { SmartIDSettings, User } from '../types';

const SMART_ID_SETTINGS_KEY = '360_smart_school_smart_id_settings';

const getAllSettings = (): SmartIDSettings[] => {
    const data = localStorage.getItem(SMART_ID_SETTINGS_KEY);
    return data ? JSON.parse(data) : [];
};

const saveAllSettings = (allSettings: SmartIDSettings[]) => {
    localStorage.setItem(SMART_ID_SETTINGS_KEY, JSON.stringify(allSettings));
};

const getDefaultSettings = (schoolId: string): SmartIDSettings => ({
    schoolId,
    primaryColor: '#2D6CDF', // A nice default blue
    textColor: '#FFFFFF', // White text for the blue background
    customFields: [
        { id: `field_${Date.now()}`, label: 'Emergency Contact', userProperty: 'contactNumber' }
    ],
    templateType: 'default',
});

export const getSmartIdSettings = (schoolId: string): SmartIDSettings => {
    const allSettings = getAllSettings();
    const schoolSettings = allSettings.find(s => s.schoolId === schoolId);
    // Merge with defaults to ensure new properties like templateType exist
    return {
        ...getDefaultSettings(schoolId),
        ...schoolSettings,
    };
};

export const saveSmartIdSettings = (settings: SmartIDSettings): void => {
    const allSettings = getAllSettings();
    const schoolIndex = allSettings.findIndex(s => s.schoolId === settings.schoolId);
    if (schoolIndex > -1) {
        allSettings[schoolIndex] = settings;
    } else {
        allSettings.push(settings);
    }
    saveAllSettings(allSettings);
};

export const setTemplateType = (schoolId: string, type: 'default' | 'custom'): void => {
    const settings = getSmartIdSettings(schoolId);
    settings.templateType = type;
    saveSmartIdSettings(settings);
};

// A list of user properties that make sense to show on an ID card
export const availableUserProperties: { key: keyof User; label: string }[] = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'name', label: 'Full Name' },
    { key: 'class', label: 'Class' },
    { key: 'stream', label: 'Stream' },
    { key: 'email', label: 'Email' },
    { key: 'contactNumber', label: 'Contact Number' },
    { key: 'role', label: 'Role' },
    { key: 'bio', label: 'Bio' },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'address', label: 'Address' },
];