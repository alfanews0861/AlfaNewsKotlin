
import React, { useState, useEffect, useCallback } from 'react';
import { NewsPost, User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { analyzeNewsMetadata } from '../services/geminiService';
import { Sparkles } from 'lucide-react';

const { collection, query, orderBy, limit, getDocs, doc, deleteDoc, Timestamp, updateDoc, startAfter } = _firestore as any;
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

    const fetchPosts = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            const newsCollectionRef = collection(db, 'news');
            let q;
            
            const constraints = [orderBy('timestamp', 'desc'), limit(50)];
            if (isLoadMore && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }
            
            q = query(newsCollectionRef, ...constraints);
            
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
            setHasMore(querySnapshot.docs.length === 50);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
            setLoadingMore(false);
        }
    }, [lastDoc]);

    useEffect(() => { fetchPosts(); }, []);

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
        (post.reporter?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg font-mallanna text-black">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                <h2 className="text-2xl font-ramabhadra flex items-center gap-2">
                    <span className="w-2 h-6 bg-red-600 rounded-full"></span>
                    వార్తల నిర్వహణ
                </h2>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="వార్తలను వెతకండి..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                                <p className="font-bold truncate text-lg">{post.headline?.telugu || 'No Headline'}</p>
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
                                onClick={() => fetchPosts(true)}
                                disabled={loadingMore}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-8 rounded-xl transition-all disabled:opacity-50 border border-gray-200"
                            >
                                {loadingMore ? 'లోడ్ అవుతోంది...' : 'మరిన్ని వార్తలు (Load More)'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManagePostsPage;
