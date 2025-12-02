import React, { useState, useEffect } from 'react';
import * as pushNotificationService from '../services/pushNotificationService';

const NotificationPermissionBanner: React.FC = () => {
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    
    useEffect(() => {
        setPermissionStatus(pushNotificationService.getPermissionStatus());
    }, []);

    const handleRequestPermission = async () => {
        const newStatus = await pushNotificationService.requestPermission();
        setPermissionStatus(newStatus);
    };

    if (permissionStatus !== 'default') {
        return null;
    }

    return (
        <div className="bg-cyan-800 text-white p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 shadow-lg animate-slide-in-left-fade">
            <div className="flex items-center space-x-3">
                 <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <p className="font-semibold text-center sm:text-left">Get notified of new messages and group activity.</p>
            </div>
            <button 
                onClick={handleRequestPermission} 
                className="flex-shrink-0 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-md font-bold transition-colors"
            >
                Enable Notifications
            </button>
        </div>
    );
};

export default NotificationPermissionBanner;