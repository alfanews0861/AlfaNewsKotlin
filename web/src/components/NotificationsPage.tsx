
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { AppNotification, User, NotificationType } from '../types';

const { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } = _firestore as any;

interface NotificationsPageProps {
    user: User;
    onAction: (actionUrl: string) => void;
}

const NotificationIcon = ({ type }: { type: NotificationType }) => {
    switch (type) {
        case NotificationType.NEWS: return <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">🗞️</div>;
        case NotificationType.ENGAGEMENT: return <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">❤️</div>;
        case NotificationType.PROMOTION: return <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">🎖️</div>;
        default: return <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">🔔</div>;
    }
};

const NotificationsPage: React.FC<NotificationsPageProps> = ({ user, onAction }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user.id) return;

        const notifRef = collection(db, 'users', user.id, 'notifications');
        const q = query(notifRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const items = snapshot.docs.map((d: any) => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : (d.data().timestamp || Date.now())
            } as AppNotification));
            setNotifications(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user.id]);

    const markAsRead = async (notif: AppNotification) => {
        if (notif.read) {
            if (notif.actionUrl) onAction(notif.actionUrl);
            return;
        }
        try {
            const docRef = doc(db, 'users', user.id, 'notifications', notif.id);
            await updateDoc(docRef, { read: true });
            if (notif.actionUrl) onAction(notif.actionUrl);
        } catch (e) { console.error(e); }
    };

    const clearAll = async () => {
        if (!window.confirm("అన్ని నోటిఫికేషన్లను తొలగించాలా?")) return;
        const batch = writeBatch(db);
        notifications.forEach(n => {
            const ref = doc(db, 'users', user.id, 'notifications', n.id);
            batch.delete(ref);
        });
        await batch.commit();
    };

    if (loading) return <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="bg-white min-h-full font-mallanna animate-fade-in">
            <div className="p-4 flex justify-between items-center border-b sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-ramabhadra text-gray-800">నోటిఫికేషన్లు</h2>
                {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-red-600 font-bold text-sm bg-red-50 px-3 py-1 rounded-full">Clear All</button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl">కొత్త నోటిఫికేషన్లు ఏవీ లేవు.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {notifications.map(notif => (
                        <div 
                            key={notif.id} 
                            onClick={() => markAsRead(notif)}
                            className={`p-4 flex gap-4 items-start cursor-pointer transition-colors ${notif.read ? 'bg-white' : 'bg-blue-50'}`}
                        >
                            <NotificationIcon type={notif.type} />
                            <div className="flex-1 min-w-0">
                                <h3 className={`text-lg font-bold truncate ${notif.read ? 'text-gray-700' : 'text-black'}`}>{notif.title}</h3>
                                <p className="text-gray-600 text-base leading-snug line-clamp-2">{notif.body}</p>
                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
                                    {new Date(notif.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' })}
                                </p>
                            </div>
                            {!notif.read && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-2 shrink-0"></div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
