// services/pushNotificationService.ts

/**
 * Checks the current notification permission status.
 * @returns 'granted', 'denied', or 'default'.
 */
export const getPermissionStatus = (): NotificationPermission => {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
};

/**
 * Requests permission from the user to show notifications.
 * @returns The new permission state.
 */
export const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
        return 'denied';
    }
    const permission = await Notification.requestPermission();
    return permission;
};

/**
 * Shows a notification to the current user via the registered service worker.
 * @param title The title of the notification.
 * @param options The notification options (body, icon, tag, etc.).
 */
export const showNotification = (title: string, options: NotificationOptions): void => {
    if (getPermissionStatus() !== 'granted') {
        return; // Don't show if permission is not granted
    }

    if (!('serviceWorker' in navigator)) {
        return; // Service worker not supported
    }

    navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
            ...options,
            icon: 'https://cdn-icons-png.flaticon.com/512/812/812844.png', // A generic school icon
            badge: 'https://cdn-icons-png.flaticon.com/512/812/812844.png',
        });
    });
};