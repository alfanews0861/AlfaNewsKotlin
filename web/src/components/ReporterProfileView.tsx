
import React, { useState, useEffect } from 'react';
import { User, NewsPost, Language, UserRole, AnalyticsEventType } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { logAnalyticsEvent } from '../services/analyticsService';

const { doc, getDoc, collection, query, where, orderBy, getDocs, Timestamp, limit } = _firestore as any;

// Unified wsrv.nl proxy helper
const getProxiedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes('firebasestorage.googleapis.com') || url.startsWith('data:') || url.includes('wsrv.nl')) return url;
    let cleanUrl = url.startsWith('//') ? `https:${url}` : url;
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&n=-1`;
};

interface ReporterProfileViewProps {
    reporterId: string;
    onBack: () => void;
    onPostClick: (postId: string) => void;
    currentUser: User | null;
}

const ReporterProfileView: React.FC<ReporterProfileViewProps> = ({ reporterId, onBack, onPostClick, currentUser }) => {
    const [reporter, setReporter] = useState<User | null>(null);
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Log Reporter Follow/Interest
                logAnalyticsEvent(AnalyticsEventType.REPORTER_FOLLOW, { id: 'reporter_view', categories: [], reporter: { id: reporterId, name: '' } } as any, currentUser?.id);
                
                // Handling for the new Virtual Reporters from BOT_ prefix
                if (reporterId.startsWith('BOT_')) {
                    const botName = reporterId.replace('BOT_', '');
                    setReporter({
                        id: reporterId,
                        name: botName,
                        role: UserRole.REPORTER,
                        photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(botName)}&background=random`
                    } as User);
                } 
                // Legacy SYSTEM handles
                else if (reporterId.startsWith('SYSTEM_')) {
                    setReporter({
                        id: reporterId,
                        name: reporterId === 'SYSTEM_RSS' ? 'Web Desk' : (reporterId === 'SYSTEM_SOCIAL' ? 'Social Desk' : 'News Desk'),
                        role: UserRole.REPORTER,
                        photoUrl: 'https://ui-avatars.com/api/?name=Alfa+News&background=random'
                    } as User);
                } 
                // Regular logged in users
                else {
                    const userRef = doc(db, 'users', reporterId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        setReporter({ id: userSnap.id, ...userSnap.data() } as User);
                    }
                }

                const newsRef = collection(db, 'news');
                const q = query(newsRef, where('reporter.id', '==', reporterId), orderBy('timestamp', 'desc'), limit(50));
                const querySnapshot = await getDocs(q);
                const fetchedPosts = querySnapshot.docs.map((doc: any) => {
                    const data = doc.data();
                    const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (typeof data.timestamp === 'number' ? data.timestamp : Date.now());
                    return { id: doc.id, ...data, timestamp } as NewsPost;
                });
                fetchedPosts.sort((a: NewsPost, b: NewsPost) => b.timestamp - a.timestamp);
                setPosts(fetchedPosts);
            } catch (e) {
                console.error("Error fetching reporter profile:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [reporterId]);

    if (loading) {
        return <div className="h-full w-full bg-white flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (!reporter && !loading) {
        return <div className="h-full w-full bg-white flex flex-col items-center justify-center p-4"><p className="text-gray-500">Reporter profile not found.</p><button onClick={onBack} className="mt-4 text-blue-600 underline">Back</button></div>;
    }

    return (
        <div className="h-full w-full bg-gray-50 flex flex-col overflow-y-auto pb-20 animate-fade-in font-mallanna">
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="p-4 flex items-center gap-2 border-b border-gray-100">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="font-bold text-lg text-gray-800">రిపోర్టర్ ప్రొఫైల్</span>
                </div>
            </div>
            <div className="bg-white p-6 mb-2 flex flex-col items-center text-center shadow-sm">
                <img src={getProxiedUrl(reporter?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(reporter?.name || 'R')}&background=random`)} alt={reporter?.name} className="w-24 h-24 rounded-full border-4 border-gray-100 shadow-md object-cover mb-3" />
                <h1 className="font-ramabhadra text-2xl text-gray-900 mb-1">{reporter?.name}</h1>
                <p className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase tracking-wider mb-2">{reporter?.role}</p>
                <div className="flex gap-8 mt-6 border-t border-gray-100 pt-4 w-full justify-center">
                    <div className="text-center"><span className="block font-bold text-xl text-gray-900">{posts.length}</span><span className="text-xs text-gray-500 uppercase">పోస్ట్లు</span></div>
                </div>
            </div>
            <div className="p-2">
                <h3 className="text-lg font-bold text-gray-700 px-2 mb-2 font-ramabhadra border-b pb-1">వార్తలు (Stories)</h3>
                <div className="grid grid-cols-2 gap-2">
                    {posts.map(post => (
                        <div key={post.id} onClick={() => onPostClick(post.id)} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 active:scale-95 transition-transform">
                            <div className="h-32 bg-gray-200 relative">
                                {post.mediaType === 'image' ? (
                                    <img src={getProxiedUrl(post.mediaUrl)} alt="Thumb" className="w-full h-full object-cover object-top" />
                                ) : (
                                    <video src={post.mediaUrl} className="w-full h-full object-cover" preload="none" />
                                )}
                            </div>
                            <div className="p-2">
                                <h4 className="font-mallanna text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 h-9">{post.headline.telugu}</h4>
                                <p className="text-[10px] text-gray-400 text-right">{new Date(post.timestamp).toLocaleDateString('te-IN')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReporterProfileView;
