
import React, { useState, useEffect, useCallback } from 'react';
import { NewsPost, User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { analyzeNewsMetadata } from '../services/geminiService';
import { Sparkles } from 'lucide-react';

const { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, Timestamp, updateDoc, startAfter } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

const BroadcastIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;

interface ManagePostsPageProps {
  onEditPost: (post: NewsPost) => void;
  currentUser?: User; 
}

const ManagePostsPage: React.FC<ManagePostsPageProps> = ({ onEditPost, currentUser }) => {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState<string | null>(null);
    const [isCategorizing, setIsCategorizing] = useState(false);
    const [categorizationProgress, setCategorizationProgress] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const isReporter = Boolean(currentUser && (
        currentUser.role === UserRole.REPORTER || 
        currentUser.role === UserRole.STAFF_REPORTER ||
        Boolean(currentUser.assignedMandal || (currentUser as any).mandal)
    ));
    const isAdminOrEditor = Boolean(currentUser && (
        currentUser.role === UserRole.ADMIN ||
        (currentUser.role as any) === 'EDITOR' ||
        currentUser.email === 'alfanews0861@gmail.com' ||
        currentUser.phone?.includes('9173811009')
    ));
    const uid = currentUser?.id || '';
    const phone10 = (currentUser?.phone || '').replace(/[^0-9]/g, '').slice(-10);

    const [selectedReporter, setSelectedReporter] = useState<string>('');
    const [reporterList, setReporterList] = useState<User[]>([]);
    const [loadAll, setLoadAll] = useState(false);

    useEffect(() => {
        if (isAdminOrEditor) {
            const loadReporters = async () => {
                try {
                    const snap = await getDocs(query(collection(db, 'users'), limit(300)));
                    const reps: User[] = [];
                    snap.docs.forEach((d: any) => {
                        const data = d.data();
                        const u = { id: d.id, ...data } as User;
                        if (u.role === UserRole.REPORTER || u.role === UserRole.STAFF_REPORTER || (u as any).role === 'NEWS_DESK' || u.assignedMandal || (u as any).mandal) {
                            reps.push(u);
                        }
                    });
                    reps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    setReporterList(reps);
                } catch (e) {
                    console.error("Error loading reporters:", e);
                }
            };
            loadReporters();
        }
    }, [isAdminOrEditor]);

    const fetchPosts = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            const newsCollectionRef = collection(db, 'news');
            const targetReporterId = selectedReporter || (isReporter ? uid : '');
            const queryLimit = (loadAll || isLoadMore) ? 50 : 10;

            if (targetReporterId) {
                // 🛡️ Reporter View: Fetch latest 10 news by default for instant loading
                const targetRep = isReporter ? currentUser : reporterList.find(r => r.id === targetReporterId);
                const targetPhone10 = (targetRep?.phone || '').replace(/[^0-9]/g, '').slice(-10);
                const targetName = targetRep?.name || '';

                const queries = [
                    query(newsCollectionRef, where('reporter.id', '==', targetReporterId), limit(queryLimit)),
                    query(newsCollectionRef, where('originalReporterId', '==', targetReporterId), limit(queryLimit)),
                    query(newsCollectionRef, where('reporterId', '==', targetReporterId), limit(queryLimit)),
                    query(newsCollectionRef, where('userId', '==', targetReporterId), limit(queryLimit)),
                    query(newsCollectionRef, where('reporter', '==', targetReporterId), limit(queryLimit)),
                ];
                if (targetPhone10) {
                    queries.push(query(newsCollectionRef, where('reporter.id', '==', targetPhone10), limit(queryLimit)));
                    queries.push(query(newsCollectionRef, where('reporter.id', '==', `+91${targetPhone10}`), limit(queryLimit)));
                    queries.push(query(newsCollectionRef, where('originalReporterId', '==', targetPhone10), limit(queryLimit)));
                    queries.push(query(newsCollectionRef, where('originalReporterId', '==', `+91${targetPhone10}`), limit(queryLimit)));
                }
                if (targetName) {
                    queries.push(query(newsCollectionRef, where('reporter.name', '==', targetName), limit(queryLimit)));
                }

                const snapshots = await Promise.all(queries.map(qItem => getDocs(qItem).catch(() => ({ docs: [] }))));
                const postsMap = new Map<string, NewsPost>();

                snapshots.forEach((snap: any) => {
                    snap.docs?.forEach((docItem: any) => {
                        const data = docItem.data();
                        postsMap.set(docItem.id, {
                            id: docItem.id,
                            ...data,
                            timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (typeof data.timestamp === 'number' ? data.timestamp : Date.now())
                        } as NewsPost);
                    });
                });

                const fetchedPosts = Array.from(postsMap.values())
                    .sort((a, b) => b.timestamp - a.timestamp);
                const limited = loadAll ? fetchedPosts : fetchedPosts.slice(0, 10);
                setPosts(limited);
                setHasMore(fetchedPosts.length > 10 && !loadAll);
            } else {
                // Admin Global Management: Latest 10 posts by default for instant speed
                const constraints = [orderBy('timestamp', 'desc'), limit(queryLimit)];
                if (isLoadMore && lastDoc) {
                    constraints.push(startAfter(lastDoc));
                }
                
                const q = query(newsCollectionRef, ...constraints);
                const querySnapshot = await getDocs(q);
                const fetchedPosts = querySnapshot.docs.map((doc: any) => ({
                     id: doc.id, 
                     ...doc.data(), 
                     timestamp: doc.data().timestamp instanceof Timestamp ? doc.data().timestamp.toMillis() : (typeof doc.data().timestamp === 'number' ? doc.data().timestamp : Date.now())
                } as NewsPost));

                if (isLoadMore) {
                    setPosts(prev => [...prev, ...fetchedPosts]);
                } else {
                    setPosts(fetchedPosts);
                }
                
                setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
                setHasMore(querySnapshot.docs.length === queryLimit);
            }
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
            setLoadingMore(false);
        }
    }, [isReporter, uid, phone10, selectedReporter, reporterList, lastDoc, loadAll]);

    useEffect(() => { 
        setLastDoc(null);
        setLoadAll(false);
        fetchPosts(false); 
    }, [selectedReporter]);

    const handleDelete = async (postId: string) => {
        if (!window.confirm("ఈ వార్తను శాశ్వతంగా తొలగించాలా?")) return;
        try {
            await deleteDoc(doc(db, 'news', postId));
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (e) { alert("తొలగించడం విఫలమైంది."); }
    };

    const handleBroadcast = async (post: NewsPost) => {
        const mode = window.confirm(`"${post.headline.telugu}"\n\nఈ వార్తను సౌండ్ (Alert) తో పంపాలా? \n(Cancel నొక్కితే నిశ్శబ్దంగా (Silent) వెళ్తుంది)`) ? 'alert' : 'silent';
        if (!window.confirm(`${mode === 'alert' ? '🔊 అలర్ట్' : '🔇 నిశ్శబ్దం'} పద్ధతిలో అందరికీ పంపాలా?`)) return;

        setIsBroadcasting(post.id);
        try {
            const functions = getFunctions(app, 'asia-south1');
            const sendPush = httpsCallable(functions, 'triggerPushBroadcast');
            await sendPush({
                title: "🔴 బ్రేకింగ్ న్యూస్",
                body: post.headline.telugu,
                actionUrl: `#/s/${post.id}`,
                topic: 'all_users',
                silent: mode === 'silent'
            });
            alert(`పుష్ నోటిఫికేషన్ పంపబడింది!`);
        } catch (e: any) { alert("విఫలమైంది: " + e.message); } finally { setIsBroadcasting(null); }
    };

    const handleSmartCategorizeAll = async () => {
        if (!window.confirm("లోడ్ అయిన వార్తలన్నింటినీ AI ద్వారా తిరిగి కేటగిరీలుగా విభజించాలా? ఇది కొంచెం సమయం పట్టవచ్చు.")) return;
        
        setIsCategorizing(true);
        setCategorizationProgress(0);
        
        let successCount = 0;
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            try {
                const metadata = await analyzeNewsMetadata(post.headline.telugu, post.content.telugu);
                
                // Update categories array: keep 'Local' and District if they exist, but replace the main category
                const otherCats = post.categories?.filter(c => c === 'Local' || [...TS_DISTRICTS, ...AP_DISTRICTS].includes(c)) || [];
                const finalCategories = Array.from(new Set([metadata.category, ...otherCats]));
                
                await updateDoc(doc(db, 'news', post.id), {
                    categories: finalCategories,
                    keywords: metadata.keywords || [],
                    tone: metadata.tone || 'తటస్థ వార్త'
                });
                successCount++;
            } catch (e) {
                console.error(`Failed to categorize post ${post.id}:`, e);
            }
            setCategorizationProgress(Math.round(((i + 1) / posts.length) * 100));
        }
        
        setIsCategorizing(false);
        alert(`${successCount} వార్తలు విజయవంతంగా కేటగిరీలుగా విభజించబడ్డాయి!`);
        fetchPosts();
    };

    const filteredPosts = posts.filter(post => 
        (post.headline?.telugu || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (post.content?.telugu || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.reporter?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.mandal || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.categories || []).some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg font-mallanna text-black">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-ramabhadra flex items-center gap-2">
                        <span className="w-2 h-6 bg-red-600 rounded-full"></span>
                        వార్తల నిర్వహణ
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full whitespace-nowrap">
                        {searchTerm || loadAll ? `మొత్తం: ${filteredPosts.length} వార్తలు` : 'తాజా 10 వార్తలు'}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {isAdminOrEditor && (
                        <select
                            value={selectedReporter}
                            onChange={(e) => setSelectedReporter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        >
                            <option value="">అన్ని తాజా వార్తలు (All Global News)</option>
                            {uid && <option value={uid}>నా వార్తలు (My Posts)</option>}
                            <optgroup label="విలేకరులు (Reporters)">
                                {reporterList.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name || 'Reporter'} {r.assignedMandal ? `(${r.assignedMandal})` : (r.district ? `(${r.district})` : '')} {r.phone ? `- ${r.phone}` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    )}
                    <input 
                        type="text" 
                        placeholder="వార్తలను వెతకండి..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {currentUser?.role === UserRole.ADMIN && (
                        <button 
                            onClick={handleSmartCategorizeAll} 
                            disabled={isCategorizing || loading}
                            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                            {isCategorizing ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>{categorizationProgress}%</span>
                                </div>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span className="hidden md:inline">AI Smart Categorize</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div> : (
                <div className="space-y-4">
                    {filteredPosts.length === 0 && <p className="text-center text-gray-500 py-10">వార్తలు ఏవీ లేవు.</p>}
                    {filteredPosts.map(post => (
                        <div key={post.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-3 rounded-xl border bg-gray-50">
                            <img src={post.mediaUrl} className="w-16 h-16 shrink-0 rounded-lg object-cover bg-gray-200" alt="News" referrerPolicy="no-referrer" />
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
                                    <p className="font-bold truncate text-lg">{post.headline?.telugu || 'No Headline'}</p>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {(post.categories?.[0] === 'General' ? 'జనరల్' : (post.categories?.[0] || 'జనరల్'))} • {post.reporter?.name || 'Unknown'}
                                    {post.originalUrl && post.originalUrl.startsWith('http') && (
                                        <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-2">
                                            (Source: {(() => {
                                                try {
                                                    return new URL(post.originalUrl).hostname.replace('www.', '');
                                                } catch (e) {
                                                    return 'Link';
                                                }
                                            })()})
                                        </a>
                                    )}
                                </p>
                                {post.timestamp && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        📅 పబ్లిష్ అయిన సమయం: {(() => {
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
                            <div className="flex items-center gap-1 mt-2 md:mt-0 self-end md:self-auto">
                                {currentUser?.role === UserRole.ADMIN && (
                                    <button onClick={() => handleBroadcast(post)} disabled={!!isBroadcasting} className={`p-2 rounded-full ${isBroadcasting === post.id ? 'text-orange-500' : 'text-blue-600 hover:bg-blue-100'}`} title="Broadcast">
                                        {isBroadcasting === post.id ? <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div> : <BroadcastIcon />}
                                    </button>
                                )}
                                <button onClick={() => onEditPost(post)} className="p-2 text-green-600 hover:bg-green-50 rounded-full" title="Edit">✎</button>
                                <button onClick={() => handleDelete(post.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Delete"><DeleteIcon /></button>
                                {currentUser?.role === UserRole.ADMIN && (
                                    <button 
                                        onClick={() => handleBroadcast(post)} 
                                        disabled={!!isBroadcasting} 
                                        className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                                    >
                                        సెండ్ నోటిఫికేషన్
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <div className="pt-6 flex justify-center">
                            <button 
                                onClick={() => {
                                    setLoadAll(true);
                                    fetchPosts(true);
                                }}
                                disabled={loadingMore}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-8 rounded-xl transition-all disabled:opacity-50 border border-gray-200"
                            >
                                {loadingMore ? 'లోడ్ అవుతోంది...' : 'మరిన్ని పాత వార్తలు (Load More Older News)'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManagePostsPage;
