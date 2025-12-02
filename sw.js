// sw.js

// Listener for the 'install' event.
// This is triggered when the service worker is first registered.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
});

// Listener for the 'activate' event.
// This is triggered after installation, when the service worker takes control.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
});

// Listener for the 'notificationclick' event.
// This is triggered when a user clicks on a notification.
self.addEventListener('notificationclick', (event) => {
  // Close the notification pop-up
  event.notification.close();

  // Logic to focus on the app window or open it if not already open.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window for the app is already open, focus it.
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window.
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});