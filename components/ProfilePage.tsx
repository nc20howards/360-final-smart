import React, { useState, useRef } from 'react';
import { User, AdminUser, SchoolClass } from '../types';
import * as studentService from '../services/studentService';
import * as userService from '../services/userService';
import * as notificationSettingsService from '../services/notificationSettingsService';
import { NotificationPreferences } from '../services/notificationSettingsService';

// Helper function to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Type guard to differentiate User and AdminUser
const isSchoolUser = (user: User | AdminUser): user is User => {
    return 'studentId' in user;
};

interface ProfilePageProps {
    user: User | AdminUser;
    onClose: () => void;
    onProfileUpdate: (updatedUser: User | AdminUser) => void;
    classes?: SchoolClass[];
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onClose, onProfileUpdate, classes = [] }) => {
    const [formData, setFormData] = useState(user);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentUserId = isSchoolUser(user) ? user.studentId : user.id;

    const [notificationSettings, setNotificationSettings] = useState<NotificationPreferences>(() => 
        notificationSettingsService.getNotificationSettingsForUser(currentUserId)
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'class') {
            // When class changes, reset the stream
            setFormData(prev => ({ ...prev, [name]: value, stream: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleNotificationSettingChange = (key: keyof NotificationPreferences, value: boolean) => {
        setNotificationSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                setFormData(prev => ({ ...prev, avatarUrl: base64 }));
            } catch (err) {
                setError("Failed to upload image.");
            }
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError('');
        try {
            let updatedUser;
            if (isSchoolUser(formData)) {
                updatedUser = studentService.updateSchoolUser(formData.studentId, formData);
            } else {
                updatedUser = userService.updateAdminUser(formData.id, formData);
            }
            notificationSettingsService.saveNotificationSettingsForUser(currentUserId, notificationSettings);
            onProfileUpdate(updatedUser);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    const userRole = isSchoolUser(formData) ? formData.role : (formData as AdminUser).role;
    const canEditEmail = !isSchoolUser(formData) || !['student'].includes(userRole);
    const selectedClass = classes.find(c => c.name === (formData as User).class);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[150] p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl text-white">
                <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Edit Profile</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>
                <main className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md">{error}</div>}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {/* Avatar Section */}
                        <div className="flex-shrink-0 text-center">
                            <img
                                src={formData.avatarUrl || `https://picsum.photos/seed/${isSchoolUser(formData) ? formData.studentId : formData.id}/150`}
                                alt="Profile Avatar"
                                className="w-32 h-32 rounded-full object-cover border-4 border-gray-700"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 text-sm text-cyan-400 hover:underline"
                            >
                                Change Picture
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                            />
                             <input
                                name="avatarUrl"
                                value={formData.avatarUrl || ''}
                                onChange={handleInputChange}
                                placeholder="Or paste image URL"
                                className="mt-2 w-full text-xs p-1 bg-gray-700 rounded"
                            />
                        </div>
                        {/* Form Fields Section */}
                        <div className="flex-grow space-y-4 w-full">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full p-2 bg-gray-700 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Contact Number</label>
                                    <input
                                        name="contactNumber"
                                        value={formData.contactNumber || ''}
                                        onChange={handleInputChange}
                                        placeholder="e.g., +256 7..."
                                        className="w-full p-2 bg-gray-700 rounded-md"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                                <input
                                    name="email"
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={handleInputChange}
                                    disabled={!canEditEmail}
                                    className="w-full p-2 bg-gray-700 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                                />
                            </div>
                             {isSchoolUser(formData) && (formData.role === 'student') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Class</label>
                                        <select
                                            name="class"
                                            value={(formData as User).class || ''}
                                            onChange={handleInputChange}
                                            disabled={classes.length === 0}
                                            className="w-full p-2 bg-gray-700 rounded-md disabled:bg-gray-600"
                                        >
                                            <option value="">-- Select Class --</option>
                                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Stream</label>
                                        <select
                                            name="stream"
                                            value={(formData as User).stream || ''}
                                            onChange={handleInputChange}
                                            disabled={!selectedClass || selectedClass.streams.length === 0}
                                            className="w-full p-2 bg-gray-700 rounded-md disabled:bg-gray-600"
                                        >
                                            <option value="">-- Select Stream --</option>
                                            {selectedClass?.streams.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
                                <textarea
                                    name="bio"
                                    value={formData.bio || ''}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Tell us a little about yourself..."
                                    className="w-full p-2 bg-gray-700 rounded-md"
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleInputChange}
                                    rows={2}
                                    placeholder="Your physical address"
                                    className="w-full p-2 bg-gray-700 rounded-md"
                                />
                            </div>
                        </div>
                    </div>
                     <div className="border-t border-gray-700 pt-4 mt-4">
                        <h3 className="text-lg font-semibold text-white mb-3">Notification Settings</h3>
                        <div className="space-y-3">
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                <span className="font-medium text-gray-200">Receive Push Notifications</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={notificationSettings.receivePushNotifications}
                                        onChange={e => handleNotificationSettingChange('receivePushNotifications', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </div>
                            </label>
                            {notificationSettings.receivePushNotifications && (
                                <div className="pl-4 space-y-2 border-l-2 border-gray-600 animate-fade-in-up">
                                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                        <span className="text-gray-300">New Group Messages</span>
                                        <input type="checkbox" checked={notificationSettings.groupMessages} onChange={e => handleNotificationSettingChange('groupMessages', e.target.checked)} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-500 rounded"/>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                        <span className="text-gray-300">New Direct Messages</span>
                                        <input type="checkbox" checked={notificationSettings.directMessages} onChange={e => handleNotificationSettingChange('directMessages', e.target.checked)} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-500 rounded"/>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                        <span className="text-gray-300">Canteen Order Updates</span>
                                        <input type="checkbox" checked={notificationSettings.orderUpdates} onChange={e => handleNotificationSettingChange('orderUpdates', e.target.checked)} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-500 rounded"/>
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-700/50">
                                        <span className="text-gray-300">School Announcements</span>
                                        <input type="checkbox" checked={notificationSettings.schoolAnnouncements} onChange={e => handleNotificationSettingChange('schoolAnnouncements', e.target.checked)} className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-500 rounded"/>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
                <footer className="p-4 bg-gray-900/50 rounded-b-lg flex justify-end space-x-3">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Cancel</button>
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:bg-gray-500"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ProfilePage;
