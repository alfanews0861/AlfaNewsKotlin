import React, { useState, useEffect, useCallback } from 'react';
import { NewsPost, User, UserRole } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { RefreshCw, Search, Trash2, Edit3 } from 'lucide-react';

const { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, Timestamp } = _firestore as any;

interface ManagePostsPageProps {
  onEditPost: (post: NewsPost) => void;
  currentUser?: User; 
  onViewPost?: (post: NewsPost) => void;
}

const ManagePostsPage: React.FC<ManagePostsPageProps> = ({ onEditPost, currentUser, onViewPost }) => {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'all' | 'my'>('all');

    const uid = currentUser?.id || '';
    const isAdmin = Boolean(currentUser && (
        currentUser.role === UserRole.ADMIN ||
        (currentUser.role as any) === 'EDITOR' ||
        currentUser.email === 'alfanews0861@gmail.com' ||
        currentUser.phone?.includes('9173811009')
    ));

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const newsCollectionRef = collection(db, 'news');
            const shouldFetchAll = isAdmin && viewMode === 'all';

            if (shouldFetchAll) {
                // 🚀 ADMIN VIEW: తాజా గ్లోబల్ వార్తలు (Live latest news from all reporters ordered by timestamp desc)
                const q = query(newsCollectionRef, orderBy('timestamp', 'desc'), limit(100));
                const snap = await getDocs(q);
                const fetchedPosts = snap.docs.map((docItem: any) => {
                    const data = docItem.data();
                    let ts = data.timestamp;
                    if (ts && typeof ts.toMillis === 'function') {
                        ts = ts.toMillis();
                    } else if (typeof ts !== 'number') {
                        ts = Date.now();
                    }
                    return {
                        id: docItem.id,
                        ...data,
                        timestamp: ts
                    } as NewsPost;
                });
                setPosts(fetchedPosts);
            } else {
                // 🛡️ REPORTER VIEW: కేవలం విలేకరి UID ఆధారంగా మాత్రమే
                const targetUid = uid;
                if (!targetUid) {
                    setPosts([]);
                    setLoading(false);
                    return;
                }

                const queries = [
                    query(newsCollectionRef, where('originalReporterId', '==', targetUid), orderBy('timestamp', 'desc'), limit(100)),
                    query(newsCollectionRef, where('reporter.id', '==', targetUid), orderBy('timestamp', 'desc'), limit(100)),
                ];

                const snapshots = await Promise.all(
                    queries.map(qItem => getDocs(qItem).catch(() => ({ docs: [] })))
                );
                const postsMap = new Map<string, NewsPost>();

                snapshots.forEach((snap: any) => {
                    snap.docs?.forEach((docItem: any) => {
                        const data = docItem.data();
                        let ts = data.timestamp;
                        if (ts && typeof ts.toMillis === 'function') {
                            ts = ts.toMillis();
                        } else if (typeof ts !== 'number') {
                            ts = Date.now();
                        }
                        postsMap.set(docItem.id, {
                            id: docItem.id,
                            ...data,
                            timestamp: ts
                        } as NewsPost);
                    });
                });

                const fetchedPosts = Array.from(postsMap.values())
                    .sort((a, b) => b.timestamp - a.timestamp);
                setPosts(fetchedPosts);
            }
        } catch (error) { 
            console.error("Error fetching posts:", error); 
        } finally { 
            setLoading(false); 
        }
    }, [isAdmin, viewMode, uid]);

    useEffect(() => { 
        fetchPosts(); 
    }, [fetchPosts]);

    const handleDelete = async (postId: string) => {
        if (!window.confirm("ఈ వార్తను శాశ్వతంగా తొలగించాలా?")) return;
        try {
            await deleteDoc(doc(db, 'news', postId));
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (e) {
            alert("తొలగించడం విఫలమైంది.");
        }
    };

    const filteredPosts = posts.filter(post => {
        const q = searchTerm.toLowerCase();
        return (post.headline?.telugu || '').toLowerCase().includes(q) || 
            (post.content?.telugu || '').toLowerCase().includes(q) ||
            (post.reporter?.name || '').toLowerCase().includes(q) ||
            (post.reporter?.id || '').toLowerCase().includes(q) ||
            (post.originalReporterId || '').toLowerCase().includes(q) ||
            (post.categories || []).some(c => c.toLowerCase().includes(q)) ||
            (post.location || '').toLowerCase().includes(q) ||
            (post.district || '').toLowerCase().includes(q);
    });

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg font-mallanna text-black">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-ramabhadra flex items-center gap-2">
                        <span className="w-2 h-6 bg-red-600 rounded-full"></span>
                        వార్తల నిర్వహణ
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full whitespace-nowrap">
                        మొత్తం: {filteredPosts.length} వార్తలు
                    </span>
                    <button
                        onClick={fetchPosts}
                        disabled={loading}
                        className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 transition-all disabled:opacity-50"
                        title="రీఫ్రెష్ చేయండి"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {isAdmin && (
                        <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-bold border border-gray-200">
                            <button
                                onClick={() => setViewMode('all')}
                                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'all' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:text-black'}`}
                            >
                                అన్ని తాజా వార్తలు
                            </button>
                            <button
                                onClick={() => setViewMode('my')}
                                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'my' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:text-black'}`}
                            >
                                నా వార్తలు
                            </button>
                        </div>
                    )}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="వార్త లేదా విలేకరి పేరు / UID వెతకండి..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-300 rounded-lg pl-9 pr-4 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                </div>
            </div>
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-500">వార్తలు లోడ్ అవుతున్నాయి...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPosts.length === 0 && (
                        <p className="text-center text-gray-500 py-10">
                            {searchTerm ? "వెతికిన వార్తలు ఏవీ లేవు." : "వార్తలు ఏవీ లేవు."}
                        </p>
                    )}
                    {filteredPosts.map(post => (
                        <div 
                            key={post.id} 
                            onClick={() => {
                                if (onViewPost) {
                                    onViewPost(post);
                                } else {
                                    window.location.hash = `#/news/${post.id}`;
                                }
                            }}
                            className="flex flex-col md:flex-row items-start md:items-center gap-4 p-3 rounded-xl border bg-gray-50 hover:bg-gray-100/70 transition-colors cursor-pointer group"
                        >
                            {post.mediaUrl ? (
                                <img src={post.mediaUrl} className="w-16 h-16 shrink-0 rounded-lg object-cover bg-gray-200" alt="News" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No Image</div>
                            )}
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {(() => {
                                        const status = (post.status || (post.approved ? 'PUBLISHED' : 'PENDING')).toUpperCase();
                                        let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                                        let badgeText = 'పరిశీలనలో ఉంది... (PENDING)';
                                        if (post.approved || status === 'PUBLISHED') {
                                            badgeClass = 'bg-green-100 text-green-800 border-green-300';
                                            badgeText = 'LIVE';
                                        } else if (status === 'REJECTED') {
                                            badgeClass = 'bg-red-100 text-red-800 border-red-300';
                                            badgeText = 'తిరస్కరించబడింది';
                                        } else if (status === 'FAILED') {
                                            badgeClass = 'bg-red-100 text-red-800 border-red-300';
                                            badgeText = 'విఫలమైంది';
                                        } else if (status === 'PROCESSING_VIDEO' || status === 'PROCESSING_VIDEO_START') {
                                            badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
                                            badgeText = 'సిద్ధమవుతోంది...';
                                        }
                                        return (
                                            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${badgeClass}`}>
                                                {badgeText}
                                            </span>
                                        );
                                    })()}
                                    <p className="font-bold truncate text-base md:text-lg group-hover:text-red-600 transition-colors">{post.headline?.telugu || 'No Headline'}</p>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {(post.categories?.[0] === 'General' ? 'జనరల్' : (post.categories?.[0] || 'జనరల్'))} • {post.reporter?.name || 'Alfa News'}
                                    {post.district ? ` (${post.district})` : ''}
                                </p>
                                {post.timestamp && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        📅 {(() => {
                                            try {
                                                const d = new Date(post.timestamp);
                                                const dateStr = d.toLocaleDateString('te-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                                                const timeStr = d.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                                return `${dateStr} ${timeStr}`;
                                            } catch (e) {
                                                return new Date(post.timestamp).toLocaleString();
                                            }
                                        })()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 md:mt-0 self-end md:self-auto">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditPost(post);
                                    }} 
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full border border-gray-200" 
                                    title="Edit"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(post.id);
                                    }} 
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-full border border-gray-200" 
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManagePostsPage;
