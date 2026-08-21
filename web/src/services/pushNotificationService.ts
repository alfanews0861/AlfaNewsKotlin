
import { db, app } from './firebase';
import * as _firestore from 'firebase/firestore';
import * as _messaging from 'firebase/messaging';
import * as _functions from 'firebase/functions';

const { doc, updateDoc, arrayUnion } = _firestore as any;
const { getMessaging, getToken, onMessage } = _messaging as any;
const { getFunctions, httpsCallable } = _functions as any;

/**
 * Requests permission and registers token to Firebase and subscribes to topic.
 */
export const requestNotificationPermission = async (userId: string) => {
    try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        
        if (permission === 'granted') {
            const messaging = getMessaging(app);
            // Use the valid VAPID Key provided
            const token = await getToken(messaging, {
                vapidKey: 'BGYAhkRQ0Wr8u18LCWTg7nkA-QOWNktBzgRaviW_yZt4MOESNNGtRWJLpsD0YhnD8hlixiLKwCHB-2r4WfWVN-0' 
            });

            if (token) {
                console.log("FCM Token generated:", token);
                
                // 1. Save token to User Profile for targeted sends
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token),
                    pushEnabled: true,
                    lastTokenUpdate: Date.now()
                });

                // 2. FORCE Subscribe to Global News Topic via Backend
                // This is critical for broadcasts to work
                try {
                    const functions = getFunctions(app, 'asia-south1');
                    const subscribeFn = httpsCallable(functions, 'subscribeToNewsTopic');
                    const subResult: any = await subscribeFn({ token, topic: 'all_users' });
                    
                    if (subResult.data?.success) {
                        console.log("Successfully subscribed to news alerts.");
                    }
                } catch (subError) {
                    console.error("Topic subscription failed:", subError);
                }
            }
        } else {
            console.warn("Notification permission denied by user.");
        }
    } catch (error) {
        console.error("Push Registration Error:", error);
    }
};

export const listenForForegroundMessages = () => {
    try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload: any) => {
            console.log("Received foreground notification:", payload);
            // Browser usually doesn't show a banner for foreground messages unless we trigger it
            if (payload.notification) {
                new Notification(payload.notification.title, {
                    body: payload.notification.body,
                    icon: '/icon.png'
                });
            }
        });
    } catch (e) {}
};
