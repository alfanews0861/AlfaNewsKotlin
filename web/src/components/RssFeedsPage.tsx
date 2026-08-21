
import React, { useState, useEffect, useCallback } from 'react';
import { RssFeed } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const StatusOkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="8" /></svg>;
const StatusErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="8" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;

// Helper function to validate URL
const isValidUrl = (string: string): boolean => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

// Helper to format timestamps safely
const formatTime = (ts: any) => {
    if (!ts) return 'Never';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return date.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const RssManagementPage: React.FC = () => {
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // RSS State
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [rssUrl, setRssUrl] = useState('');
    const [rssCategory, setRssCategory] = useState('స్థానిక');
    const [editingRssId, setEditingRssId] = useState<string | null>(null);

    // Manual Trigger State
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);

    // Updated Category List
    const categories = [
        'స్థానిక', 
        'రాజకీయం', 
        'ఆంధ్ర ప్రదేశ్',
        'తెలంగాణ',
        'వినోదం', 
        'క్రీడలు', 
        'వ్యాపారం', 
        'టెక్నాలజీ', 
        'లైఫ్ స్టైల్',
        'క్రైమ్', 
        'భక్తి', 
        'జాతీయం', 
        'అంతర్జాతీయం', 
        'వ్యవసాయం', 
        'విద్య/ఉద్యోగాలు'
    ];

    const handleFirebaseError = (error: any, context: string) => {
        console.error(`Error ${context}:`, error);
        if (error.code === 'permission-denied') {
            alert('డేటాబేస్ అనుమతి లోపం.');
        } else {
            alert(`${context} విఫలమైంది: ${error.message}`);
        }
    };

    const fetchRssFeeds = useCallback(async () => {
        setIsFetching(true);
        try {
            const feedsCollectionRef = collection(db, 'rss_feeds');
            const q = query(feedsCollectionRef, orderBy('category'));
            const querySnapshot = await getDocs(q);
            const fetchedFeeds = querySnapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            } as RssFeed));
            setFeeds(fetchedFeeds);
        } catch (error: any) {
            handleFirebaseError(error, 'RSS ఫీడ్‌లను పొందడం');
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchRssFeeds();
    }, [fetchRssFeeds]);

    const resetRssForm = () => { setRssUrl(''); setRssCategory('స్థానిక'); setEditingRssId(null); };
    const handleRssEdit = (feed: RssFeed) => { setEditingRssId(feed.id); setRssUrl(feed.url); setRssCategory(feed.category); window.scrollTo(0, 0); };
    const handleRssDelete = async (id: string) => { if (window.confirm('ఈ ఫీడ్‌ను తొలగించాలనుకుంటున్నారా?')) { try { await deleteDoc(doc(db, 'rss_feeds', id)); fetchRssFeeds(); } catch (e: any) { handleFirebaseError(e, 'ఫీడ్‌ను తొలగించడం'); } } };
    
    // Toggle Pause Functionality
    const handleTogglePause = async (feed: RssFeed) => {
        const newStatus = !feed.isPaused;
        const confirmMsg = newStatus 
            ? "ఈ ఫీడ్‌ను తాత్కాలికంగా పాజ్ చేయాలనుకుంటున్నారా? ఆటోమేటిక్ వార్తల సేకరణ ఆగిపోతుంది." 
            : "ఈ ఫీడ్‌ను మళ్ళీ ప్రారంభించాలనుకుంటున్నారా?";
            
        if (!window.confirm(confirmMsg)) return;

        try {
            await updateDoc(doc(db, 'rss_feeds', feed.id), { isPaused: newStatus });
            // Optimistic update
            setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, isPaused: newStatus } : f));
        } catch (e: any) {
            handleFirebaseError(e, 'స్టేటస్ మార్చడం');
        }
    };

    const handleRssSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!isValidUrl(rssUrl)) { alert('సరైన URLను నమోదు చేయండి.'); return; } 
        setIsSubmitting(true); 
        try { 
            if (editingRssId) { 
                await updateDoc(doc(db, 'rss_feeds', editingRssId), { url: rssUrl, category: rssCategory }); 
            } else { 
                // Default isPaused to false
                await addDoc(collection(db, 'rss_feeds'), { url: rssUrl, category: rssCategory, lastStatus: 'active', lastFetchTime: null, isPaused: false }); 
            } 
            resetRssForm(); 
            fetchRssFeeds(); 
        } catch (e: any) { 
            handleFirebaseError(e, 'ఫీడ్‌ను సేవ్ చేయడం'); 
        } finally { 
            setIsSubmitting(false); 
        } 
    };
    
    const handleManualTrigger = async () => {
        const functions = getFunctions(app, 'asia-south1');
        const functionName = 'processRssFeeds';
        
        if (!window.confirm(`RSS ఫీడ్ ప్రాసెసింగ్‌ను ప్రారంభించాలనుకుంటున్నారా? ఇది కేవలం 'ఆక్టివ్' ఫీడ్‌లను మాత్రమే ప్రాసెస్ చేస్తుంది.`)) {
            return;
        }

        setIsProcessing(true);
        setStatusLog(['సర్వర్‌ను సంప్రదిస్తోంది... దయచేసి వేచి ఉండండి.']);
        try {
            const callableFunction = httpsCallable(functions, functionName);
            const result = await callableFunction();
            const data = result.data as { success: boolean; message: string; log?: string };
            
            if (data.log) {
                setStatusLog(data.log.split('\n'));
            } else {
                 setStatusLog([data.message]);
            }
            fetchRssFeeds();
        } catch (error: any) {
            console.error(`Error processing:`, error);
            setStatusLog([`లోపం: ${error.message}`]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div>
            <div className="mb-8 p-6 bg-gray-50 border rounded-lg">
                <h3 className="text-2xl font-ramabhadra font-normal text-gray-800 mb-3">మాన్యువల్ చర్యలు</h3>
                <div className="flex flex-wrap gap-4">
                    <button onClick={handleManualTrigger} disabled={isProcessing} className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-green-400 disabled:cursor-not-allowed text-xl">
                        {isProcessing ? 'ప్రాసెస్ జరుగుతోంది...' : 'RSS ఫీడ్‌లను ప్రాసెస్ చేయి'}
                    </button>
                    <button onClick={fetchRssFeeds} disabled={isFetching} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 text-xl">
                        రిఫ్రెష్ స్టేటస్
                    </button>
                </div>
                 {(isProcessing || statusLog.length > 0) && (
                    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-inner max-h-60 overflow-y-auto">
                        <div className="text-sm font-mono space-y-1 text-gray-700">
                            {statusLog.map((line, index) => (
                                <p key={index}>{line}</p>
                            ))}
                        </div>
                    </div>
                 )}
            </div>

            <div>
                <form onSubmit={handleRssSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8 space-y-4">
                    <h3 className="text-2xl font-ramabhadra font-normal text-gray-800">{editingRssId ? 'RSS ఫీడ్‌ను ఎడిట్ చేయండి' : 'కొత్త RSS ఫీడ్‌ను జోడించండి'}</h3>
                    <div>
                        <label htmlFor="rssUrl" className="block text-xl font-medium text-gray-700 mb-1">RSS ఫీడ్ URL</label>
                        <input type="url" id="rssUrl" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-xl focus:ring-2 focus:ring-red-500" placeholder="https://example.com/feed.xml" required />
                    </div>
                    <div>
                        <label htmlFor="rssCategory" className="block text-xl font-medium text-gray-700 mb-1">కేటగిరి</label>
                        <select id="rssCategory" value={rssCategory} onChange={(e) => setRssCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-xl focus:ring-2 focus:ring-red-500">
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-3">
                        <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-red-400 disabled:cursor-not-allowed text-xl">
                            {isSubmitting ? 'ప్రాసెస్ జరుగుతోంది...' : editingRssId ? 'ఫీడ్‌ను అప్‌డేట్ చేయి' : 'ఫీడ్‌ను జోడించు'}
                        </button>
                        {editingRssId && <button type="button" onClick={resetRssForm} className="px-5 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition text-xl">రద్దు</button>}
                    </div>
                </form>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-2xl font-ramabhadra font-normal text-gray-800 mb-4 border-b pb-2">జోడించిన RSS ఫీడ్‌లు</h3>
                    {isFetching ? <p className="text-gray-600 text-xl">ఫీడ్‌లు లోడ్ అవుతున్నాయి...</p> : (
                        // Removed max-h-96 and overflow-y-auto to allow full page scroll
                        <div className="space-y-3">
                            {feeds.length === 0 
                             ? <p className="text-gray-500 text-xl">ఫీడ్‌లు ఏవీ కనుగొనబడలేదు.</p> 
                             : feeds.map(feed => (
                                <div key={feed.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border transition-colors ${feed.isPaused ? 'bg-gray-200 opacity-80' : 'bg-gray-50'} ${feed.lastStatus === 'error' && !feed.isPaused ? 'border-red-200 bg-red-50' : ''}`}>
                                    <div className="truncate pr-4 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {feed.isPaused ? (
                                                <span className="text-xs font-bold bg-gray-600 text-white px-2 py-0.5 rounded">PAUSED</span>
                                            ) : (
                                                feed.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />
                                            )}
                                            <p className="font-semibold text-gray-800 text-xl truncate break-all">{feed.url}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-sm text-gray-500 items-center">
                                            <span className="bg-white border px-2 py-0.5 rounded-full">{feed.category}</span>
                                            <span className="text-xs">
                                                Last Check: {formatTime(feed.lastFetchTime)}
                                            </span>
                                            
                                            {/* Processed/Failed Counts */}
                                            {feed.lastFetchTime && (
                                                <>
                                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                                        Processed: {feed.lastProcessedCount || 0}
                                                    </span>
                                                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                                        Failed/Skipped: {feed.lastFailedCount || 0}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {feed.lastStatus === 'error' && feed.lastError && !feed.isPaused && (
                                            <p className="text-red-600 text-sm mt-1 font-mono">{feed.lastError}</p>
                                        )}
                                    </div>
                                    <div className="flex space-x-3 shrink-0 mt-2 sm:mt-0 items-center">
                                        <button 
                                            onClick={() => handleTogglePause(feed)} 
                                            className={`p-2 rounded-full ${feed.isPaused ? 'text-green-600 hover:bg-green-100' : 'text-yellow-600 hover:bg-yellow-100'}`}
                                            title={feed.isPaused ? "Resume Feed" : "Pause Feed"}
                                        >
                                            {feed.isPaused ? <PlayIcon /> : <PauseIcon />}
                                        </button>
                                        <button onClick={() => handleRssEdit(feed)} className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                        <button onClick={() => handleRssDelete(feed.id)} className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RssManagementPage;
