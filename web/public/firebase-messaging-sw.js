// Alfa News Background Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyA-tbQSwOlQvwJTQz9nKH-Fo8pI0ZLTW8c",
    authDomain: "alfa-news-31bf7.firebaseapp.com",
    projectId: "alfa-news-31bf7",
    storageBucket: "alfa-news-31bf7.firebasestorage.app",
    messagingSenderId: "930598073690",
    appId: "1:930598073690:web:d8e361bf98e422ace92f63"
});

const messaging = firebase.messaging();

function getEdgeProxiedImage(url) {
    if (!url || typeof url !== 'string') return undefined;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return undefined;
    if (trimmed.includes('wsrv.nl')) return trimmed;
    if (
        trimmed.includes('firebasestorage.googleapis.com') ||
        trimmed.includes('firebasestorage.app') ||
        trimmed.includes('storage.googleapis.com')
    ) {
        return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=640&output=webp&q=75`;
    }
    return trimmed;
}

function resolveTargetUrl(payload) {
    const data = payload?.data || {};
    if (data.webUrl && data.webUrl.startsWith('http')) return data.webUrl;
    if (data.newsId) return `https://alfanews.app/news/${encodeURIComponent(data.newsId)}`;
    if (payload?.fcmOptions?.link) return payload.fcmOptions.link;
    if (data.url && data.url.startsWith('http')) return data.url;
    if (data.actionUrl && data.actionUrl.startsWith('alfanews://news/')) {
        const id = data.actionUrl.replace('alfanews://news/', '').trim();
        if (id) return `https://alfanews.app/news/${encodeURIComponent(id)}`;
    }
    return 'https://alfanews.app/';
}

// Handle background messages (data-only fallback; Hybrid webpush.notification messages are displayed natively by FCM SDK)
messaging.onBackgroundMessage((payload) => {
    if (payload?.notification) {
        // Hybrid FCM payload already contains a notification block handled natively by Firebase Messaging SW
        return;
    }

    const data = payload?.data || {};
    const notificationTitle = data.title || 'ఆల్ఫా న్యూస్';
    const imageUrl = getEdgeProxiedImage(data.imageUrl || data.image);
    const targetUrl = resolveTargetUrl(payload);

    const notificationOptions = {
        body: data.body || '',
        icon: '/app_icon.png',
        badge: '/app_icon.png',
        tag: data.slotTag || data.channelId || 'alfa_news_push',
        renotify: data.silent !== 'true',
        ...(imageUrl ? { image: imageUrl } : {}),
        data: {
            url: targetUrl,
            newsId: data.newsId || ''
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks -> focus existing tab or open exact article URL
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notifData = event.notification?.data || {};
    const fcmLink = notifData?.FCM_MSG?.fcmOptions?.link;
    const fcmNewsId = notifData?.FCM_MSG?.data?.newsId;
    const targetUrl =
        notifData.url ||
        fcmLink ||
        (fcmNewsId ? `https://alfanews.app/news/${encodeURIComponent(fcmNewsId)}` : null) ||
        'https://alfanews.app/';

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
