
// services/notificationService.ts

import { Notification } from '../types';

const NOTIFICATIONS_KEY = '360_smart_school_notifications';

// Helper to get all notifications from localStorage
const getNotifications = (): Notification[] => {
    const notifications = localStorage.getItem(NOTIFICATIONS_KEY);
    return notifications ? JSON.parse(notifications) : [];
};

// Helper to save all notifications to localStorage
const saveNotifications = (notifications: Notification[]) => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
};

/**
 * Retrieves all notifications for a specific user, sorted by newest first.
 * @param recipientId The ID of the user (studentId or adminId).
 * @returns An array of notifications for the user.
 */
export const getNotificationsForUser = (recipientId: string): Notification[] => {
    const allNotifications = getNotifications();
    // FIX: Explicitly type sort parameters to prevent type inference issues.
    return allNotifications
        .filter(n => n.recipientId === recipientId)
        .sort((a: Notification, b: Notification) => b.timestamp - a.timestamp);
};

/**
 * Creates multiple notifications for a list of recipients (broadcast).
 * @param title The title of the notification.
 * @param message The message body of the notification.
 * @param recipientIds An array of user IDs to send the notification to.
 */
export const createBroadcastNotification = (title: string, message: string, recipientIds: string[]): void => {
    const allNotifications = getNotifications();
    const newNotifications: Notification[] = recipientIds.map(recipientId => ({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recipientId,
        title,
        message,
        timestamp: Date.now(),
        isRead: false,
    }));
    saveNotifications([...allNotifications, ...newNotifications]);
};

/**
 * Marks a single notification as read.
 * @param notificationId The ID of the notification to mark as read.
 */
export const markAsRead = (notificationId: string): void => {
    const allNotifications = getNotifications();
    const notificationIndex = allNotifications.findIndex(n => n.id === notificationId);
    if (notificationIndex > -1) {
        allNotifications[notificationIndex].isRead = true;
        saveNotifications(allNotifications);
    }
};

/**
 * Marks all unread notifications for a user as read.
 * @param recipientId The ID of the user.
 */
export const markAllAsRead = (recipientId: string): void => {
    const allNotifications = getNotifications();
    allNotifications.forEach(n => {
        if (n.recipientId === recipientId && !n.isRead) {
            n.isRead = true;
        }
    });
    saveNotifications(allNotifications);
};
