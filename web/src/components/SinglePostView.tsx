
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { NewsPost, Language, User } from '../types';
import NewsCard from './NewsCard';

const { doc, getDoc, Timestamp } = _firestore as any;

interface SinglePostViewProps {
    postId: string;
    language: Language;
    currentUser: User | null;
    onLoginRequest: () => void;
    onGoHome: () => void;
    onReporterClick?: (id: string) => void;
}

const SinglePostView: React.FC<SinglePostViewProps> = ({ postId, language, currentUser, onLoginRequest, onGoHome, onReporterClick }) => {
    const [post, setPost] = useState<NewsPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const docRef = doc(db, 'news', postId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (typeof data.timestamp === 'number' ? data.timestamp : Date.now());
                    setPost({ id: docSnap.id, ...data, timestamp } as NewsPost);
                } else {
                    setError('వార్త అందుబాటులో లేదు.');
                }
            } catch (e) {
                console.error(e);
                setError('లోపం జరిగింది.');
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [postId]);

    const handleOpenApp = () => {
        const packageName = "com.alfanews.telugu";
        const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}&referrer=news_id%3D${postId}`;
        const intentUrl = `intent://share/${postId}#Intent;scheme=alfanews;package=${packageName};S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
        window.location.href = intentUrl;
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-black"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

    if (error || !post) {
        return <div className="h-full flex flex-col items-center justify-center bg-black text-white p-4 text-center"><p className="mb-4 text-gray-400">{error || 'News not found'}</p><button onClick={onGoHome} className="bg-red-600 px-6 py-2 rounded-full font-bold">హోమ్ పేజీకి వెళ్ళండి</button></div>;
    }

    return (
        <div className="h-full w-full bg-black relative flex flex-col">
            <div className="bg-red-600 text-white p-3 flex justify-between items-center shrink-0 z-50 shadow-md">
                <div className="flex flex-col"><span className="text-xs font-bold opacity-90">ఆల్ఫా న్యూస్ యాప్ లో చూడండి</span><span className="text-[10px] opacity-75">మరిన్ని వార్తల కోసం యాప్ డౌన్లోడ్ చేసుకోండి</span></div>
                <button onClick={handleOpenApp} className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-gray-100">OPEN APP</button>
            </div>
            <button onClick={onGoHome} className="absolute top-16 left-4 z-40 bg-black/50 p-2 rounded-full text-white hover:bg-black/70 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="flex-1 overflow-hidden">
                <NewsCard post={post} language={language} onProfileClick={onLoginRequest} currentUser={currentUser} onCategoryClick={() => {}} onReporterClick={onReporterClick || (() => {})} />
            </div>
        </div>
    );
};

export default SinglePostView;
