
// Alfa News Background Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyA-tbQSwOlQvwJTQz9nKH-Fo8pI0ZLTW8c",
    authDomain: "alfa-news-31bf7.firebaseapp.com",
    projectId: "alfa-news-31bf7",
    storageBucket: "alfa-news-31bf7.firebasestorage.app",
    messagingSenderId: "930598073690",
    appId: "1:930598073690:web:d8e361bf98e422ace92f63"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Background Message:', payload);
    
    // Explicitly show notification if payload.notification is missing but data is present
    const notificationTitle = payload.notification?.title || payload.data?.title || "Alfa News";
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || "",
        icon: '/icon.png',
        badge: '/badge.png',
        data: {
            url: payload.data?.url || payload.fcmOptions?.link || '/'
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const targetUrl = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
