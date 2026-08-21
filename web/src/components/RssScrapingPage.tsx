
import React, { useState, useEffect, useCallback } from 'react';
import { RssFeed, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const StatusOkIcon = () => <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>;
const StatusErrorIcon = () => <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;

const RssScrapingPage: React.FC = () => {
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [rssUrl, setRssUrl] = useState('');
    const [category, setCategory] = useState('స్థానిక');
    const [state, setState] = useState('AP');
    const [district, setDistrict] = useState('హైదరాబాద్');
    const [editingId, setEditingId] = useState<string | null>(null);

    const categories = ['స్థానిక', 'రాజకీయం', 'ఆంధ్ర ప్రదేశ్', 'తెలంగాణ', 'వినోదం', 'క్రీడలు', 'వ్యాపారం', 'టెక్నాలజీ', 'లైఫ్ స్టైల్', 'క్రైమ్', 'భక్తి', 'జాతీయం', 'అంతర్జాతీయం', 'వ్యవసాయం', 'విద్య/ఉద్యోగాలు'];

    const fetchFeeds = useCallback(async () => {
        setIsFetching(true);
        try {
            const snapshot = await getDocs(query(collection(db, 'rss_feeds'), orderBy('category')));
            setFeeds(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as RssFeed)));
        } catch (error: any) { console.error(error); } finally { setIsFetching(false); }
    }, []);

    useEffect(() => { fetchFeeds(); }, [fetchFeeds]);

    const resetForm = () => { setRssUrl(''); setCategory('స్థానిక'); setEditingId(null); };

    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSubmitting(true); 
        try { 
            const payload = { url: rssUrl, category, state, district };
            if (editingId) await updateDoc(doc(db, 'rss_feeds', editingId), payload); 
            else await addDoc(collection(db, 'rss_feeds'), { 
                ...payload, 
                lastStatus: 'active', 
                lastFetchTime: null, 
                isPaused: false,
                totalProcessedCount: 0,
                totalFailedCount: 0,
                todayProcessedCount: 0
            }); 
            resetForm(); fetchFeeds(); 
        } catch (e: any) { alert(e.message); } finally { setIsSubmitting(false); } 
    };

    const handleManualTrigger = async () => {
        if (!window.confirm("RSS ఫీడ్ ప్రాసెసింగ్‌ను ప్రారంభించాలా?")) return;
        setIsProcessing(true);
        setStatusLog(['క్లౌడ్ ఫంక్షన్‌ను సంప్రదిస్తున్నాము...']);
        try {
            const processFn = httpsCallable(getFunctions(app, 'asia-south1'), 'processRssFeeds');
            const result: any = await processFn();
            setStatusLog(result.data.log.split('\n'));
            fetchFeeds();
        } catch (error: any) { setStatusLog([`Error: ${error.message}`]); } finally { setIsProcessing(false); }
    };

    const handleTogglePause = async (feed: RssFeed) => {
        const newStatus = !feed.isPaused;
        try {
            await updateDoc(doc(db, 'rss_feeds', feed.id), { isPaused: newStatus });
            fetchFeeds();
        } catch (e: any) { alert(e.message); }
    };

    const formatLastCheck = (ts: any) => {
        if (!ts) return 'ఎప్పుడూ లేదు';
        const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('te-IN', { day: 'numeric', month: 'short' });
    };

    const StatItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col items-center justify-center min-w-[70px]">
            <span className={`text-lg font-black ${color}`}>{value || 0}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{label}</span>
        </div>
    );

    return (
        <div className="font-mallanna text-black animate-fade-in">
            <div className="bg-orange-600 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between items-center shadow-xl shadow-orange-100 gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11c3.866 0 7 3.134 7 7M7 18a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra text-white leading-tight">RSS Feed Dashboard</h2>
                        <p className="text-orange-100 text-sm font-bold uppercase tracking-widest opacity-80">RSS ఫీడ్ వార్తా సేకరణ నిర్వహణ</p>
                    </div>
                </div>
                <button onClick={handleManualTrigger} disabled={isProcessing} className="bg-white text-orange-600 px-10 py-3 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    {isProcessing ? <div className="w-5 h-5 border-3 border-orange-600 border-t-transparent rounded-full animate-spin"></div> : '📡'}
                    {isProcessing ? 'ప్రాసెస్ అవుతోంది...' : 'Fetch RSS Now'}
                </button>
            </div>

            {statusLog.length > 0 && (
                <div className="mb-8 p-4 bg-black rounded-[1.5rem] text-green-400 font-mono text-xs max-h-40 overflow-y-auto shadow-inner border border-gray-800">
                    {statusLog.map((l, i) => <div key={i}>{`> ${l}`}</div>)}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4 mb-10">
                <h3 className="font-ramabhadra text-2xl text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-orange-600 rounded-full"></span>
                    {editingId ? 'ఫీడ్‌ను సవరించండి' : 'కొత్త RSS ఫీడ్‌ను చేర్చండి'}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">RSS URL</label>
                        <input type="url" value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="https://example.com/rss.xml" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50 transition-all font-semibold" required />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">కేటగిరి</label>
                         <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">రాష్ట్రం</label>
                        <select value={state} onChange={e => setState(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            <option value="AP">Andhra Pradesh</option>
                            <option value="TS">Telangana</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">జిల్లా</label>
                        <select value={district} onChange={e => setDistrict(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            {(state === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="bg-orange-600 text-white w-full py-4 rounded-2xl font-bold text-2xl shadow-xl shadow-orange-100 hover:bg-orange-700 active:scale-[0.98] transition-all">
                    {isSubmitting ? 'సేవ్ అవుతోంది...' : editingId ? 'అప్‌డేట్ చేయి' : 'ఫీడ్‌ను సేవ్ చేయి'}
                </button>
                {editingId && <button onClick={resetForm} className="w-full text-gray-500 font-bold py-2">రద్దు (Cancel)</button>}
            </form>

            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-ramabhadra text-2xl text-gray-800">యాక్టివ్ ఫీడ్‌లు ({feeds.length})</h3>
                    <button onClick={fetchFeeds} className="text-xs font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-full">Refresh Stats</button>
                </div>
                
                {isFetching && feeds.length === 0 ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : feeds.map(feed => (
                    <div key={feed.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm hover:border-orange-200 transition-all group ${feed.isPaused ? 'opacity-60' : ''}`}>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    {feed.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />}
                                    <span className="font-black text-xl text-gray-800 truncate">{feed.url}</span>
                                    <span className="text-[10px] bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.district}</span>
                                </div>
                                <p className="text-gray-400 text-xs truncate font-bold bg-gray-50 p-2 rounded-xl mb-4 border border-gray-100">{feed.category}</p>
                                
                                {/* Stats Row */}
                                <div className="grid grid-cols-4 gap-2">
                                    <StatItem label="నేటివి (Today)" value={feed.todayProcessedCount || 0} color="text-blue-600" />
                                    <StatItem label="ప్రాసెస్డ్" value={feed.totalProcessedCount || 0} color="text-green-600" />
                                    <StatItem label="విఫలం" value={feed.totalFailedCount || 0} color="text-red-500" />
                                    <StatItem label="మొత్తం" value={(feed.totalProcessedCount || 0) + (feed.totalFailedCount || 0)} color="text-orange-600" />
                                </div>
                            </div>
                            
                            <div className="flex sm:flex-col gap-2 justify-center shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-4">
                                <div className="hidden sm:block text-right mb-auto">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">చివరి చెక్</p>
                                    <p className="text-xs font-bold text-gray-600">{formatLastCheck(feed.lastFetchTime)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleTogglePause(feed)} className={`p-4 rounded-2xl active:scale-90 transition-all ${feed.isPaused ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                                        {feed.isPaused ? <PlayIcon /> : <PauseIcon />}
                                    </button>
                                    <button onClick={() => { 
                                        setEditingId(feed.id); setRssUrl(feed.url); 
                                        setDistrict(feed.district || ''); setCategory(feed.category || 'స్థానిక');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} className="p-4 bg-blue-50 rounded-2xl text-blue-600 active:scale-90 transition-all"><EditIcon /></button>
                                    <button onClick={async () => { if (window.confirm("ఈ ఫీడ్‌ను తొలగించాలా?")) { await deleteDoc(doc(db, 'rss_feeds', feed.id)); fetchFeeds(); } }} className="p-4 bg-red-50 rounded-2xl text-red-600 active:scale-90 transition-all"><DeleteIcon /></button>
                                </div>
                            </div>
                        </div>
                        {feed.lastStatus === 'error' && feed.lastError && (
                            <div className="mt-4 p-3 bg-red-50 rounded-2xl text-red-500 text-xs font-bold border border-red-100">
                                ⚠ Error: {feed.lastError}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RssScrapingPage;
