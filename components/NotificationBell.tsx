import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '../types';
import { getNotificationsForUser, markAsRead, markAllAsRead } from '../services/notificationService';
import * as pushNotificationService from '../services/pushNotificationService';
import * as notificationSettingsService from '../services/notificationSettingsService';
import { NotificationPreferences } from '../services/notificationSettingsService';

interface NotificationBellProps {
    userId: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prevNotificationsRef = useRef<Notification[]>([]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const refreshNotifications = () => {
        const userNotifications = getNotificationsForUser(userId);
        setNotifications(userNotifications);
    };

    useEffect(() => {
        refreshNotifications();
        const interval = setInterval(refreshNotifications, 5000);
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        // Don't run on initial load or if notifications haven't changed
        if (prevNotificationsRef.current.length === 0 || notifications.length === prevNotificationsRef.current.length) {
            prevNotificationsRef.current = notifications;
            return;
        }

        const oldIds = new Set(prevNotificationsRef.current.map(n => n.id));
        const newUnreadNotifications = notifications.filter(n => !n.isRead && !oldIds.has(n.id));

        if (newUnreadNotifications.length > 0) {
            const settings = notificationSettingsService.getNotificationSettingsForUser(userId);

            if (!settings.receivePushNotifications) {
                prevNotificationsRef.current = notifications;
                return;
            }

            newUnreadNotifications.forEach(n => {
                let canShow = false;
                const title = n.title.toLowerCase();

                if (title.includes("new message in") && settings.groupMessages) {
                    canShow = true;
                } else if (title.includes("new message from") && settings.directMessages) {
                    canShow = true;
                } else if ((title.includes("new order") || title.includes("awaiting delivery")) && settings.orderUpdates) {
                    canShow = true;
                } else if (settings.schoolAnnouncements) { // Fallback for announcements and others
                    // Avoid re-notifying for messages if those toggles are off
                    if ((title.includes("new message in") && !settings.groupMessages) || (title.includes("new message from") && !settings.directMessages)) {
                       // do nothing
                    } else {
                        canShow = true;
                    }
                }

                if (canShow) {
                    pushNotificationService.showNotification(n.title, { body: n.message, tag: n.id });
                }
            });
        }

        prevNotificationsRef.current = notifications;
    }, [notifications, userId]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleMarkOneAsRead = (notificationId: string) => {
        markAsRead(notificationId);
        refreshNotifications();
    };
    
    const handleMarkAllAsRead = () => {
        markAllAsRead(userId);
        refreshNotifications();
    };
    
    const timeSince = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return "Just now";
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="relative text-gray-400 hover:text-white transition-colors"
                title="Notifications"
                aria-label="Toggle notifications panel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="flex justify-between items-center p-3 border-b border-gray-700">
                        <h4 className="font-bold text-white">Notifications</h4>
                        {notifications.length > 0 && (
                            <button onClick={handleMarkAllAsRead} className="text-sm text-cyan-400 hover:underline disabled:text-gray-500" disabled={unreadCount === 0}>
                                Mark all as read
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`p-3 border-b border-gray-700 last:border-b-0 flex items-start space-x-3 transition-colors ${!n.isRead ? 'bg-gray-700/50 hover:bg-gray-700' : 'hover:bg-gray-800/50'}`}
                                >
                                    {!n.isRead && (
                                         <button onClick={() => handleMarkOneAsRead(n.id)} title="Mark as read" className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 bg-cyan-500 rounded-full hover:bg-cyan-400 focus:outline-none ring-offset-2 ring-offset-gray-700/50 focus:ring-2 focus:ring-cyan-400"></button>
                                    )}
                                    <div className={`flex-grow ${n.isRead ? 'pl-5' : ''}`}>
                                        <p className="font-semibold text-white">{n.title}</p>
                                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.message}</p>
                                        <p className="text-xs text-gray-500 mt-1">{timeSince(n.timestamp)}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="p-4 text-center text-gray-400">You have no notifications.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
