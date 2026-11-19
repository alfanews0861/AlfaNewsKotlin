import { db, app } from './firebase';
import * as _firestore from 'firebase/firestore';
import * as _messaging from 'firebase/messaging';
import * as _functions from 'firebase/functions';
import { getDistrictTopicName, getEdgeProxiedImageUrl } from '../utils/notificationHelpers';

const { doc, setDoc, arrayUnion } = _firestore as any;
const { getMessaging, getToken, onMessage } = _messaging as any;
const { getFunctions, httpsCallable } = _functions as any;

const VAPID_KEY = 'BGYAhkRQ0Wr8u18LCWTg7nkA-QOWNktBzgRaviW_yZt4MOESNNGtRWJLpsD0YhnD8hlixiLKwCHB-2r4WfWVN-0';
const STORAGE_TOKEN_KEY = 'alfa_web_fcm_token';
const STORAGE_ENABLED_KEY = 'alfa_web_push_enabled';
const STORAGE_DISTRICT_TOPIC_KEY = 'alfa_web_district_topic';

export type WebPushPermissionStatus = 'unsupported' | 'denied' | 'granted' | 'default';

export interface WebPushRegistrationResult {
  success: boolean;
  status: WebPushPermissionStatus;
  token?: string;
  error?: string;
}

export function getWebPushStatus(): WebPushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission as WebPushPermissionStatus;
}

export function isWebPushSubscribed(): boolean {
  if (typeof window === 'undefined') return false;
  return getWebPushStatus() === 'granted' && localStorage.getItem(STORAGE_ENABLED_KEY) === 'true';
}

async function subscribeTopics(token: string, topics: string[]): Promise<void> {
  const functions = getFunctions(app, 'asia-south1');
  const subscribeFn = httpsCallable(functions, 'subscribeToNewsTopic');
  await Promise.all(
    topics.map((topic) =>
      subscribeFn({ token, topic }).catch((err: any) => {
        console.warn(`[WebPush] Topic subscribe failed for ${topic}:`, err?.message || err);
      })
    )
  );
}

async function unsubscribeTopic(token: string, topic: string): Promise<void> {
  try {
    const functions = getFunctions(app, 'asia-south1');
    const unsubscribeFn = httpsCallable(functions, 'unsubscribeFromNewsTopic');
    await unsubscribeFn({ token, topic });
  } catch (err: any) {
    console.warn(`[WebPush] Topic unsubscribe failed for ${topic}:`, err?.message || err);
  }
}

/**
 * Requests browser push permission, registers the service worker & FCM token,
 * saves token for authenticated users (and locally for guests), and subscribes
 * to `all_users`, `breaking_news`, and optional canonical district topic.
 */
export const requestNotificationPermission = async (
  options?: string | { userId?: string | null; district?: string | null }
): Promise<WebPushRegistrationResult> => {
  const userId = typeof options === 'string' ? options : options?.userId || null;
  const district = typeof options === 'string' ? null : options?.district || localStorage.getItem('user_local_district');

  try {
    const currentStatus = getWebPushStatus();
    if (currentStatus === 'unsupported') {
      return { success: false, status: 'unsupported', error: 'ఈ బ్రౌజర్‌లో నోటిఫికేషన్లు అందుబాటులో లేవు.' };
    }

    let permission: NotificationPermission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      localStorage.setItem(STORAGE_ENABLED_KEY, 'false');
      return {
        success: false,
        status: permission as WebPushPermissionStatus,
        error: 'నోటిఫికేషన్ అనుమతి నిరాకరించబడింది. బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి.',
      };
    }

    let registration: ServiceWorkerRegistration | undefined;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (swErr) {
      console.warn('[WebPush] Explicit SW registration fallback:', swErr);
    }

    const messaging = getMessaging(app);
    const token: string = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });

    if (!token) {
      return { success: false, status: 'granted', error: 'నోటిఫికేషన్ టోకెన్ పొందలేకపోయాము.' };
    }

    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_ENABLED_KEY, 'true');

    if (userId && userId !== 'guest-user') {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          fcmTokens: arrayUnion(token),
          webFcmToken: token,
          pushEnabled: true,
          notificationsEnabled: true,
          lastTokenUpdate: Date.now(),
        },
        { merge: true }
      ).catch((e: any) => console.warn('[WebPush] User doc token sync failed:', e?.message || e));
    }

    const topicsToSubscribe = ['all_users', 'breaking_news'];
    if (district) {
      const distTopic = getDistrictTopicName(district);
      if (distTopic.startsWith('district_')) {
        topicsToSubscribe.push(distTopic);
        localStorage.setItem(STORAGE_DISTRICT_TOPIC_KEY, distTopic);
      }
    }

    await subscribeTopics(token, topicsToSubscribe);
    return { success: true, status: 'granted', token };
  } catch (error: any) {
    console.error('[WebPush] Registration error:', error);
    return {
      success: false,
      status: getWebPushStatus(),
      error: error?.message || 'నోటిఫికేషన్ యాక్టివేషన్ విఫలమైంది.',
    };
  }
};

/**
 * Keeps a subscribed web browser synced with the user's selected district topic.
 */
export const syncWebDistrictTopic = async (district: string | null): Promise<void> => {
  if (typeof window === 'undefined' || !isWebPushSubscribed()) return;
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) return;

  const prevTopic = localStorage.getItem(STORAGE_DISTRICT_TOPIC_KEY);
  const nextTopic = district ? getDistrictTopicName(district) : null;

  if (prevTopic && prevTopic !== nextTopic && prevTopic.startsWith('district_')) {
    await unsubscribeTopic(token, prevTopic);
  }
  if (nextTopic && nextTopic.startsWith('district_') && nextTopic !== prevTopic) {
    await subscribeTopics(token, [nextTopic]);
    localStorage.setItem(STORAGE_DISTRICT_TOPIC_KEY, nextTopic);
  }
};

/**
 * Listens for foreground FCM messages while the web tab is active and displays a native alert.
 */
export const listenForForegroundMessages = (
  onForegroundAlert?: (alert: { title: string; body: string; newsId?: string; imageUrl?: string }) => void
): (() => void) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return () => {};
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload: any) => {
      const title = payload?.notification?.title || payload?.data?.title || 'ఆల్ఫా న్యూస్';
      const body = payload?.notification?.body || payload?.data?.body || '';
      const newsId = payload?.data?.newsId || '';
      const rawImage = payload?.notification?.image || payload?.data?.imageUrl || '';
      const imageUrl = getEdgeProxiedImageUrl(rawImage);

      if (onForegroundAlert) {
        onForegroundAlert({ title, body, newsId, imageUrl });
      }

      if (Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: '/app_icon.png',
          badge: '/app_icon.png',
          ...(imageUrl ? { image: imageUrl } : {}),
        } as NotificationOptions);
        notif.onclick = () => {
          window.focus();
          if (newsId) {
            window.location.href = `/news/${encodeURIComponent(newsId)}`;
          }
          notif.close();
        };
      }
    });
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
  } catch {
    return () => {};
  }
};
