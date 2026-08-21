import React, { useState, useEffect, useCallback } from 'react';
import { FacebookFeed, AP_DISTRICTS, TS_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const FacebookIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const StatusOkIcon = () => <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>;
const StatusErrorIcon = () => <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>;

const FacebookScrapingPage: React.FC = () => {
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    
    const [feeds, setFeeds] = useState<FacebookFeed[]>([]);
    const [url, setUrl] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [category, setCategory] = useState('స్థానిక');
    const [stateSelection, setStateSelection] = useState('');
    const [district, setDistrict] = useState('');
    const [mandal, setMandal] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const categories = ['స్థానిక', 'రాజకీయం', 'ఆంధ్ర ప్రదేశ్', 'తెలంగాణ', 'వినోదం', 'క్రీడలు', 'వ్యాపారం', 'టెక్నాలజీ', 'లైఫ్ స్టైల్', 'క్రైమ్', 'భక్తి', 'జాతీయం', 'అంతర్జాతీయం', 'వ్యవసాయం', 'విద్య/ఉద్యోగాలు'];

    const fetchFeeds = useCallback(async () => {
        setIsFetching(true);
        try {
            const q = query(collection(db, 'facebook_feeds'), orderBy('sourceName'));
            const snap = await getDocs(q);
            setFeeds(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as FacebookFeed)));
        } catch (error: any) { console.error(error); } finally { setIsFetching(false); }
    }, []);

    useEffect(() => { fetchFeeds(); }, [fetchFeeds]);

    const resetForm = () => { 
        setUrl(''); 
        setSourceName(''); 
        setCategory('స్థానిక'); 
        setStateSelection('');
        setDistrict('');
        setMandal('');
        setEditingId(null); 
    };

    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSubmitting(true); 
        try { 
            const payload = { 
                url, 
                sourceName, 
                category,
                state: category === 'స్థానిక' ? stateSelection : '',
                district: category === 'స్థానిక' ? district : '',
                mandal: category === 'స్థానిక' ? mandal : ''
            };
            if (editingId) await updateDoc(doc(db, 'facebook_feeds', editingId), payload); 
            else await addDoc(collection(db, 'facebook_feeds'), { 
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
        if (!window.confirm(`ఫేస్బుక్ స్క్రాపింగ్‌ను ప్రారంభించాలా?`)) return;
        setIsProcessing(true);
        setStatusLog(['ఫేస్బుక్ స్కానింగ్ ప్రారంభమైంది...']);
        try {
            const processFn = httpsCallable(getFunctions(app, 'asia-south1'), 'processFacebookFeeds');
            const result: any = await processFn();
            setStatusLog(result.data.log?.split('\n') || [result.data.message]);
            fetchFeeds();
        } catch (error: any) { setStatusLog([`Error: ${error.message}`]); } finally { setIsProcessing(false); }
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
            <div className="bg-[#1877F2] p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row justify-between items-center shadow-xl shadow-blue-100 gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                        <FacebookIcon />
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra text-white leading-tight">Facebook Scraper</h2>
                        <p className="text-blue-100 text-sm font-bold uppercase tracking-widest opacity-80">ఫేస్బుక్ మానిటరింగ్ డ్యాష్‌బోర్డ్</p>
                    </div>
                </div>
                <button onClick={handleManualTrigger} disabled={isProcessing} className="bg-white text-[#1877F2] px-10 py-3 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    {isProcessing ? <div className="w-5 h-5 border-3 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div> : '🚀'}
                    {isProcessing ? 'స్కానింగ్...' : 'Scrape Now'}
                </button>
            </div>

            {statusLog.length > 0 && (
                <div className="mb-8 p-4 bg-black rounded-[1.5rem] text-green-400 font-mono text-xs max-h-40 overflow-y-auto shadow-inner border border-gray-800">
                    {statusLog.map((l, i) => <div key={i}>{`> ${l}`}</div>)}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-4 mb-10">
                <h3 className="font-ramabhadra text-2xl text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-[#1877F2] rounded-full"></span>
                    {editingId ? 'సోర్స్‌ను సవరించండి' : 'కొత్త ఫేస్బుక్ సోర్స్‌ను చేర్చండి'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">సోర్స్ పేరు (Label)</label>
                        <input type="text" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="eg: AP News Page" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all font-semibold" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Page ID / Username</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="eg: apnews" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all font-semibold" required />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">కేటగిరి</label>
                         <select value={category} onChange={e => {
                             setCategory(e.target.value);
                             if(e.target.value !== 'స్థానిక') {
                                 setStateSelection('');
                                 setDistrict('');
                                 setMandal('');
                             }
                         }} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    {category === 'స్థానిక' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">రాష్ట్రం</label>
                            <select value={stateSelection} onChange={e => {
                                setStateSelection(e.target.value);
                                setDistrict('');
                                setMandal('');
                            }} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none" required>
                                <option value="">రాష్ట్రాన్ని ఎంచుకోండి</option>
                                <option value="AP">ఆంధ్ర ప్రదేశ్</option>
                                <option value="TS">తెలంగాణ</option>
                            </select>
                        </div>
                    )}
                </div>
                
                {category === 'స్థానిక' && stateSelection && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">జిల్లా</label>
                            <select value={district} onChange={e => setDistrict(e.target.value)} className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none" required>
                                <option value="">జిల్లాను ఎంచుకోండి</option>
                                {(stateSelection === 'AP' ? AP_DISTRICTS : TS_DISTRICTS).map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">మండలం</label>
                            <input type="text" value={mandal} onChange={e => setMandal(e.target.value)} placeholder="మండలం పేరు" className="w-full border p-4 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 transition-all font-semibold" required />
                        </div>
                    </div>
                )}

                <button type="submit" disabled={isSubmitting} className="bg-[#1877F2] text-white w-full py-4 rounded-2xl font-bold text-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all">
                    {isSubmitting ? 'సేవ్ అవుతోంది...' : editingId ? 'అప్‌డేట్ చేయి' : 'సోర్స్‌ను సేవ్ చేయి'}
                </button>
                {editingId && <button onClick={resetForm} className="w-full text-gray-500 font-bold py-2">రద్దు (Cancel)</button>}
            </form>

            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-ramabhadra text-2xl text-gray-800">యాక్టివ్ సోర్స్‌లు ({feeds.length})</h3>
                    <button onClick={fetchFeeds} className="text-xs font-black text-[#1877F2] uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full">Refresh Stats</button>
                </div>
                
                {isFetching && feeds.length === 0 ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div></div>
                ) : feeds.map(feed => (
                    <div key={feed.id} className="bg-white p-5 rounded-[2rem] border shadow-sm hover:border-blue-200 transition-all group">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    {feed.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />}
                                    <span className="font-black text-2xl text-gray-800 truncate">{feed.sourceName}</span>
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.category}</span>
                                    {feed.category === 'స్థానిక' && feed.district && (
                                        <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.district}</span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-xs truncate font-bold bg-gray-50 p-2 rounded-xl mb-4 border border-gray-100">{feed.url}</p>
                                
                                {/* Stats Row */}
                                <div className="grid grid-cols-4 gap-2">
                                    <StatItem label="నేటివి (Today)" value={feed.todayProcessedCount || 0} color="text-[#1877F2]" />
                                    <StatItem label="ప్రాసెస్డ్" value={feed.totalProcessedCount || 0} color="text-green-600" />
                                    <StatItem label="విఫలం" value={feed.totalFailedCount || 0} color="text-red-500" />
                                    <StatItem label="మొత్తం" value={(feed.totalProcessedCount || 0) + (feed.totalFailedCount || 0)} color="text-[#1877F2]" />
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
                                        setCategory(feed.category || 'స్థానిక');
                                        setStateSelection(feed.state || '');
                                        setDistrict(feed.district || '');
                                        setMandal(feed.mandal || '');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} className="p-4 bg-blue-50 rounded-2xl text-[#1877F2] active:scale-90 transition-all"><EditIcon /></button>
                                    <button onClick={async () => { if (window.confirm("ఈ సోర్స్‌ను తొలగించాలా?")) { await deleteDoc(doc(db, 'facebook_feeds', feed.id)); fetchFeeds(); } }} className="p-4 bg-red-50 rounded-2xl text-red-600 active:scale-90 transition-all"><DeleteIcon /></button>
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

export default FacebookScrapingPage;
