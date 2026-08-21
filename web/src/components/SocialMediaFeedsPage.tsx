
import React, { useState, useEffect, useCallback } from 'react';
import { SocialFeed, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, where } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const TwitterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const StatusOkIcon = () => <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>;
const StatusErrorIcon = () => <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>;

const SocialMediaFeedsPage: React.FC = () => {
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    
    const [feeds, setFeeds] = useState<SocialFeed[]>([]);
    const [url, setUrl] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [platform, setPlatform] = useState<'Twitter' | 'Facebook' | 'Instagram'>('Twitter');
    const [category, setCategory] = useState('రాజకీయం');
    const [state, setState] = useState('');
    const [district, setDistrict] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const [detailFeed, setDetailFeed] = useState<string | null>(null);
    const [todayNews, setTodayNews] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const categories = ['స్థానిక', 'రాజకీయం', 'ఆంధ్ర ప్రదేశ్', 'తెలంగాణ', 'వినోదం', 'క్రీడలు', 'వ్యాపారం', 'టెక్నాలజీ', 'లైఫ్ స్టైల్', 'క్రైమ్', 'భక్తి', 'జాతీయం', 'అంతర్జాతీయం', 'వ్యవసాయం', 'విద్య/ఉద్యోగాలు'];

    const fetchFeeds = useCallback(async () => {
        setIsFetching(true);
        try {
            const q = query(collection(db, 'social_feeds'), orderBy('sourceName'));
            const snap = await getDocs(q);
            setFeeds(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as SocialFeed)));
        } catch (error: any) { console.error(error); } finally { setIsFetching(false); }
    }, []);

    useEffect(() => { fetchFeeds(); }, [fetchFeeds]);

    const resetForm = () => { 
        setUrl(''); 
        setSourceName(''); 
        setPlatform('Twitter'); 
        setCategory('రాజకీయం'); 
        setState('');
        setDistrict('');
        setEditingId(null); 
    };

    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSubmitting(true); 
        try { 
            const payload: any = { url, sourceName, platform, category };
            if (category === 'స్థానిక') {
                payload.state = state;
                payload.district = district;
            }
            if (editingId) await updateDoc(doc(db, 'social_feeds', editingId), payload); 
            else await addDoc(collection(db, 'social_feeds'), { 
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
        if (!window.confirm(`సోషల్ మీడియా స్క్రాపింగ్‌ను ప్రారంభించాలా?`)) return;
        setIsProcessing(true);
        setStatusLog(['సోషల్ మీడియా స్కానింగ్ ప్రారంభమైంది...']);
        try {
            const processFn = httpsCallable(getFunctions(app, 'asia-south1'), 'processSocialFeeds');
            const result: any = await processFn();
            setStatusLog(result.data.log?.split('\n') || [result.data.message]);
            fetchFeeds();
        } catch (error: any) { setStatusLog([`Error: ${error.message}`]); } finally { setIsProcessing(false); }
    };

    const showTodayNews = async (sourceName?: string) => {
        setDetailFeed(sourceName || 'ALL');
        setLoadingDetails(true);
        setTodayNews([]);
        try {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const startOfToday = Timestamp.fromDate(now);

            let q;
            if (sourceName) {
                q = query(
                    collection(db, 'news'),
                    where('categories', 'array-contains', sourceName),
                    where('timestamp', '>=', startOfToday),
                    orderBy('timestamp', 'desc')
                );
            } else {
                q = query(
                    collection(db, 'news'),
                    where('categories', 'array-contains', 'Social'),
                    where('timestamp', '>=', startOfToday),
                    orderBy('timestamp', 'desc')
                );
            }
            const snap = await getDocs(q);
            setTodayNews(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error fetching today news:", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const formatLastCheck = (ts: any) => {
        if (!ts) return 'ఎప్పుడూ లేదు';
        const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('te-IN', { day: 'numeric', month: 'short' });
    };

    const StatItem = ({ label, value, color, onClick }: { label: string, value: number, color: string, onClick?: () => void }) => (
        <div 
            onClick={onClick}
            className={`bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col items-center justify-center min-w-[70px] ${onClick ? 'cursor-pointer hover:border-blue-500 hover:bg-white transition-all active:scale-95' : ''}`}
        >
            <span className={`text-lg font-black ${color}`}>{value || 0}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{label}</span>
        </div>
    );

    const totalToday = feeds.reduce((acc, f) => acc + (f.todayProcessedCount || 0), 0);

    return (
        <div className="font-mallanna text-black animate-fade-in relative">
            {/* Detail Modal */}
            {detailFeed && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-2xl font-ramabhadra text-gray-800">{detailFeed === 'ALL' ? 'నేటి సోషల్ వార్తలు' : detailFeed}</h3>
                                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">నేటి అప్‌డేట్స్</p>
                            </div>
                            <button onClick={() => setDetailFeed(null)} className="p-2 bg-white rounded-full shadow-sm hover:text-red-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loadingDetails ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-gray-500 font-bold">వార్తలను సేకరిస్తున్నాము...</p>
                                </div>
                            ) : todayNews.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 italic">ఈరోజు ఇంకా ఏ వార్తలు నమోదు కాలేదు.</div>
                            ) : (
                                todayNews.map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-blue-50 transition-colors">
                                        <div className="flex justify-between items-start gap-3 mb-1">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-100/50 rounded-full">
                                                {item.categories?.find((c: string) => c !== 'Social' && c !== 'Local' && c !== item.category) || 'SOCIAL'}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {item.timestamp?.toMillis ? new Date(item.timestamp.toMillis()).toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-bold leading-tight text-gray-800">{item.headline?.telugu}</h4>
                                        {item.originalUrl && (
                                            <a href={item.originalUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 mt-2 block truncate max-w-full italic hover:underline">
                                                {item.originalUrl}
                                            </a>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-center">
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Alfa News Social Monitor v1.0</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-blue-600 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between items-center shadow-xl shadow-blue-100 gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                        <TwitterIcon />
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra text-white leading-tight">Twitter Scraper</h2>
                        <p className="text-blue-100 text-sm font-bold uppercase tracking-widest opacity-80">ట్విట్టర్ (X) మానిటరింగ్ డ్యాష్‌బోర్డ్</p>
                    </div>
                </div>
                <button onClick={handleManualTrigger} disabled={isProcessing} className="bg-white text-blue-600 px-10 py-3 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    {isProcessing ? <div className="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : '🚀'}
                    {isProcessing ? 'స్కానింగ్...' : 'Scrape Now'}
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button 
                    onClick={() => showTodayNews()}
                    className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden text-left active:scale-95 transition-all"
                >
                    <div className="relative z-10">
                        <p className="text-blue-100 font-bold uppercase text-xs tracking-widest mb-2">నేటి మొత్తం సోషల్ వార్తలు</p>
                        <h3 className="text-6xl font-black leading-none">{totalToday}</h3>
                        <p className="mt-4 text-blue-100 text-sm italic font-bold">ఈరోజు సోషల్ మీడియా నుండి సేకరించినవి</p>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </button>
                
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center">
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2">యాక్టివ్ సోర్స్‌లు</p>
                    <h3 className="text-4xl font-bold text-gray-800">{feeds.length}</h3>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-gray-500 font-bold text-sm">నిరంతరం మానిటర్ చేయబడుతున్నాయి</p>
                    </div>
                </div>
            </div>

            {statusLog.length > 0 && (
                <div className="mb-8 p-4 bg-black rounded-[1.5rem] text-green-400 font-mono text-xs max-h-40 overflow-y-auto shadow-inner border border-gray-800">
                    {statusLog.map((l, i) => <div key={i}>{`> ${l}`}</div>)}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4 mb-10">
                <h3 className="font-ramabhadra text-2xl text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                    {editingId ? 'సోర్స్‌ను సవరించండి' : 'కొత్త సోషల్ సోర్స్‌ను చేర్చండి'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">సోర్స్ పేరు (Label)</label>
                        <input type="text" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="eg: KTR (BRS)" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all font-semibold" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">ప్లాట్‌ఫారమ్</label>
                        <select value={platform} onChange={e => setPlatform(e.target.value as any)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            <option value="Twitter">Twitter (X)</option>
                            <option value="Facebook">Facebook (Soon)</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Handle / ID</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="@username" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all font-semibold" required />
                    </div>
                    <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">కేటగిరి</label>
                         <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {category === 'స్థానిక' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">రాష్ట్రం</label>
                            <select value={state} onChange={e => { setState(e.target.value); setDistrict(''); }} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none" required>
                                <option value="">రాష్ట్రం ఎంచుకోండి</option>
                                <option value="Telangana">Telangana</option>
                                <option value="Andhra Pradesh">Andhra Pradesh</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">జిల్లా</label>
                            <select value={district} onChange={e => setDistrict(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none" required>
                                <option value="">జిల్లా ఎంచుకోండి</option>
                                {state === 'Telangana' && TS_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                                {state === 'Andhra Pradesh' && AP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white w-full py-4 rounded-2xl font-bold text-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all">
                    {isSubmitting ? 'సేవ్ అవుతోంది...' : editingId ? 'అప్‌డేట్ చేయి' : 'సోర్స్‌ను సేవ్ చేయి'}
                </button>
                {editingId && <button onClick={resetForm} className="w-full text-gray-500 font-bold py-2">రద్దు (Cancel)</button>}
            </form>

            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-ramabhadra text-2xl text-gray-800">యాక్టివ్ సోర్స్‌లు ({feeds.length})</h3>
                    <button onClick={fetchFeeds} className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full">Refresh Stats</button>
                </div>
                
                {isFetching && feeds.length === 0 ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : feeds.map(feed => (
                    <div key={feed.id} className="bg-white p-5 rounded-[2rem] border shadow-sm hover:border-blue-200 transition-all group">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    {feed.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />}
                                    <span className="font-black text-2xl text-gray-800 truncate">{feed.sourceName}</span>
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.category}</span>
                                    {feed.district && <span className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.district}</span>}
                                </div>
                                <p className="text-gray-400 text-xs truncate font-bold bg-gray-50 p-2 rounded-xl mb-4 border border-gray-100">{feed.url}</p>
                                
                                {/* Stats Row */}
                                <div className="grid grid-cols-4 gap-2">
                                    <StatItem 
                                        label="నేడు (Today)" 
                                        value={feed.todayProcessedCount || 0} 
                                        color="text-blue-600" 
                                        onClick={() => showTodayNews(feed.sourceName)}
                                    />
                                    <StatItem label="పోస్ట్స్" value={feed.totalProcessedCount || 0} color="text-green-600" />
                                    <StatItem label="విఫలం" value={feed.totalFailedCount || 0} color="text-red-500" />
                                    <StatItem label="మొత్తం" value={(feed.totalProcessedCount || 0) + (feed.totalFailedCount || 0)} color="text-gray-600" />
                                </div>
                            </div>
                            
                            <div className="flex sm:flex-col gap-2 justify-center shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-4">
                                <div className="hidden sm:block text-right mb-auto">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">చివరి చెక్</p>
                                    <p className="text-xs font-bold text-gray-600">{formatLastCheck(feed.lastFetchTime)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { 
                                        setEditingId(feed.id); setSourceName(feed.sourceName); setUrl(feed.url); 
                                        setPlatform(feed.platform); setCategory(feed.category || 'రాజకీయం');
                                        setState(feed.state || ''); setDistrict(feed.district || '');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} className="p-4 bg-blue-50 rounded-2xl text-blue-600 active:scale-90 transition-all"><EditIcon /></button>
                                    <button onClick={async () => { if (window.confirm("ఈ సోర్స్‌ను తొలగించాలా?")) { await deleteDoc(doc(db, 'social_feeds', feed.id)); fetchFeeds(); } }} className="p-4 bg-red-50 rounded-2xl text-red-600 active:scale-90 transition-all"><DeleteIcon /></button>
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

export default SocialMediaFeedsPage;
