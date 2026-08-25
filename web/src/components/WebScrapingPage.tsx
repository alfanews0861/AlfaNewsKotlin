
import React, { useState, useEffect, useCallback } from 'react';
import { ScrapingSource, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;
const StatusOkIcon = () => <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>;
const StatusErrorIcon = () => <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>;

const WebScrapingPage: React.FC = () => {
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    
    const [sources, setSources] = useState<ScrapingSource[]>([]);
    const [siteUrl, setSiteUrl] = useState('');
    const [siteName, setSiteName] = useState('');
    const [category, setCategory] = useState('జిల్లా వార్తలు');
    const [state, setState] = useState('TS');
    const [district, setDistrict] = useState('హైదరాబాద్');
    const [scrapeGroup, setScrapeGroup] = useState('1');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Filters
    const [searchFilter, setSearchFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('ALL');
    const [groupFilter, setGroupFilter] = useState('ALL');

    const categories = [
        'జిల్లా వార్తలు', 'రాజకీయం', 'ఆంధ్ర ప్రదేశ్', 'తెలంగాణ', 'వినోదం', 
        'క్రీడలు', 'వ్యాపారం', 'టెక్నాలజీ', 'లైఫ్ స్టైల్', 'క్రైమ్', 
        'భక్తి', 'జాతీయం', 'అంతర్జాతీయం', 'వ్యవసాయం', 'విద్య/ఉద్యోగాలు'
    ];

    const fetchSources = useCallback(async () => {
        setIsFetching(true);
        try {
            const snapshot = await getDocs(query(collection(db, 'scraping_sources'), orderBy('siteName')));
            setSources(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ScrapingSource)));
        } catch (error: any) { 
            console.error(error); 
        } finally { 
            setIsFetching(false); 
        }
    }, []);

    useEffect(() => { 
        fetchSources(); 
    }, [fetchSources]);

    const resetForm = () => { 
        setSiteUrl(''); 
        setSiteName(''); 
        setCategory('జిల్లా వార్తలు'); 
        setScrapeGroup('1');
        setEditingId(null); 
    };

    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!siteUrl.trim() || !siteName.trim()) {
            alert('దయచేసి సైట్ పేరు మరియు URL నమోదు చేయండి.');
            return;
        }

        setIsSubmitting(true); 
        try { 
            const isDistrictNews = category === 'జిల్లా వార్తలు' || category === 'స్థానిక' || category === 'జిల్లా వార్త';
            const payload: any = { 
                url: siteUrl.trim(), 
                siteName: siteName.trim(), 
                category, 
                group: parseInt(scrapeGroup, 10) || 1,
                state: isDistrictNews ? state : null, 
                district: isDistrictNews ? district : null 
            };

            if (isDistrictNews) {
                payload.meta = { location: district || state };
            }

            if (editingId) {
                await updateDoc(doc(db, 'scraping_sources', editingId), payload); 
            } else {
                await addDoc(collection(db, 'scraping_sources'), { 
                    ...payload, 
                    lastStatus: 'active', 
                    lastFetchTime: null, 
                    isPaused: false,
                    totalProcessedCount: 0,
                    totalFailedCount: 0,
                    todayProcessedCount: 0,
                    processed24h: 0,
                    failed24h: 0
                }); 
            }
            resetForm(); 
            fetchSources(); 
        } catch (e: any) { 
            alert(`లోపం: ${e.message}`); 
        } finally { 
            setIsSubmitting(false); 
        } 
    };

    const handleTogglePause = async (src: ScrapingSource) => {
        try {
            await updateDoc(doc(db, 'scraping_sources', src.id), {
                isPaused: !src.isPaused
            });
            fetchSources();
        } catch (e: any) {
            alert(`స్టేటస్ మార్చడంలో లోపం: ${e.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("ఈ స్క్రాపింగ్ సోర్స్‌ను ఖచ్చితంగా తొలగించాలా?")) return;
        try {
            await deleteDoc(doc(db, 'scraping_sources', id));
            fetchSources();
        } catch (e: any) {
            alert(`తొలగించడంలో లోపం: ${e.message}`);
        }
    };

    const handleManualTrigger = async (selectedGroupTrigger: number | null = null) => {
        const msg = selectedGroupTrigger 
            ? `గ్రూప్ ${selectedGroupTrigger} స్క్రాపింగ్ రన్ చేయాలా?` 
            : "అన్ని యాక్టివ్ సోర్స్‌ల కోసం మ్యాన్యువల్ స్క్రాపింగ్ రన్ చేయాలా?";
        if (!window.confirm(msg)) return;
        
        setIsProcessing(true);
        setStatusLog(['క్లౌడ్ ఫంక్షన్‌ను సంప్రదిస్తున్నాము...']);
        try {
            const processFn = httpsCallable(getFunctions(app, 'asia-south1'), 'processScrapingSources');
            const result: any = await processFn(selectedGroupTrigger ? { group: selectedGroupTrigger } : {});
            if (result.data && result.data.log) {
                setStatusLog(result.data.log.split('\n'));
            } else {
                setStatusLog([result.data?.message || 'స్క్రాపింగ్ విజయవంతంగా పూర్తయింది.']);
            }
            fetchSources();
        } catch (error: any) { 
            setStatusLog([`Error: ${error.message}`]); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    const formatLastCheck = (ts: any) => {
        if (!ts) return 'ఎప్పుడూ లేదు';
        const date = ts instanceof Timestamp ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : new Date(ts));
        return date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('te-IN', { day: 'numeric', month: 'short' });
    };

    const filteredSources = sources.filter(src => {
        if (searchFilter && !src.siteName.toLowerCase().includes(searchFilter.toLowerCase()) && !src.url.toLowerCase().includes(searchFilter.toLowerCase())) {
            return false;
        }
        if (stateFilter !== 'ALL' && src.state !== stateFilter) {
            return false;
        }
        if (groupFilter !== 'ALL' && (src.group || 1).toString() !== groupFilter) {
            return false;
        }
        return true;
    });

    const StatItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center min-w-[65px]">
            <span className={`text-base font-black ${color}`}>{value || 0}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{label}</span>
        </div>
    );

    return (
        <div className="font-mallanna text-black animate-fade-in pb-16">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 p-6 rounded-[2rem] mb-6 flex flex-col md:flex-row justify-between items-center shadow-xl text-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra leading-tight">Web Scraper Dashboard</h2>
                        <p className="text-purple-200 text-sm font-bold uppercase tracking-wider">ఆటోమేటిక్ వార్తా సేకరణ నిర్వహణ & సోర్సెస్</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => handleManualTrigger(null)} 
                        disabled={isProcessing} 
                        className="bg-white text-purple-700 px-6 py-2.5 rounded-2xl font-bold text-lg shadow-lg hover:bg-purple-50 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {isProcessing ? <div className="w-5 h-5 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></div> : '⚡'}
                        {isProcessing ? 'స్కానింగ్...' : 'Scrape All'}
                    </button>
                </div>
            </div>

            {/* Live Status Log Terminal */}
            {statusLog.length > 0 && (
                <div className="mb-6 p-4 bg-gray-950 rounded-[1.5rem] text-green-400 font-mono text-xs max-h-48 overflow-y-auto shadow-inner border border-gray-800">
                    <div className="flex justify-between items-center text-gray-400 border-b border-gray-800 pb-1 mb-2">
                        <span className="font-bold">SCRAPER EXECUTION LOG</span>
                        <button onClick={() => setStatusLog([])} className="hover:text-white text-gray-500 text-[10px]">Clear</button>
                    </div>
                    {statusLog.map((l, i) => <div key={i} className="py-0.5">{`> ${l}`}</div>)}
                </div>
            )}

            {/* Add / Edit Form */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 space-y-4 mb-8">
                <h3 className="font-ramabhadra text-2xl text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
                    {editingId ? 'సోర్స్‌ను సవరించండి (Edit Source)' : 'కొత్త వెబ్ సోర్స్‌ను చేర్చండి (Add Scraping Source)'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">సైట్ పేరు (Site Name)</label>
                        <input 
                            type="text" 
                            value={siteName} 
                            onChange={e => setSiteName(e.target.value)} 
                            placeholder="ఉదా: Eenadu Local, Sakshi District" 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 transition-all font-semibold" 
                            required 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">URL (Website / Category Link)</label>
                        <input 
                            type="url" 
                            value={siteUrl} 
                            onChange={e => setSiteUrl(e.target.value)} 
                            placeholder="https://example.com/district-news" 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 transition-all font-semibold" 
                            required 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">కేటగిరి (Category)</label>
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">రాష్ట్రం (State)</label>
                        <select 
                            value={state} 
                            onChange={e => {
                                setState(e.target.value);
                                setDistrict(e.target.value === 'TS' ? TS_DISTRICTS[0] : AP_DISTRICTS[0]);
                            }} 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="TS">తెలంగాణ (TS)</option>
                            <option value="AP">ఆంధ్రప్రదేశ్ (AP)</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">జిల్లా (District)</label>
                        <select 
                            value={district} 
                            onChange={e => setDistrict(e.target.value)} 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {(state === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">గ్రూప్ (Scrape Group)</label>
                        <select 
                            value={scrapeGroup} 
                            onChange={e => setScrapeGroup(e.target.value)} 
                            className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="1">Group 1</option>
                            <option value="2">Group 2</option>
                            <option value="3">Group 3</option>
                            <option value="4">Group 4</option>
                            <option value="5">Group 5</option>
                        </select>
                    </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="bg-purple-600 hover:bg-purple-700 text-white flex-1 py-3.5 rounded-2xl font-bold text-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'సేవ్ అవుతోంది...' : editingId ? 'సోర్స్‌ను అప్‌డేట్ చేయి (Update)' : 'సోర్స్‌ను భద్రపరచు (Save Source)'}
                    </button>
                    {editingId && (
                        <button 
                            type="button"
                            onClick={resetForm} 
                            className="px-6 py-3.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-2xl font-bold text-lg transition-colors"
                        >
                            రద్దు (Cancel)
                        </button>
                    )}
                </div>
            </form>

            {/* Filter and Source List */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-ramabhadra text-2xl text-gray-800">యాక్టివ్ సోర్స్‌లు ({filteredSources.length}/{sources.length})</h3>
                    </div>
                    
                    {/* Controls Row */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <input 
                            type="text"
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            placeholder="వెతకండి (Search site/url)..."
                            className="border border-gray-300 px-3 py-1.5 rounded-xl text-sm bg-white outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <select 
                            value={stateFilter} 
                            onChange={e => setStateFilter(e.target.value)} 
                            className="border border-gray-300 px-3 py-1.5 rounded-xl text-sm bg-white font-semibold outline-none"
                        >
                            <option value="ALL">అన్ని రాష్ట్రాలు</option>
                            <option value="TS">తెలంగాణ</option>
                            <option value="AP">ఆంధ్రప్రదేశ్</option>
                        </select>
                        <select 
                            value={groupFilter} 
                            onChange={e => setGroupFilter(e.target.value)} 
                            className="border border-gray-300 px-3 py-1.5 rounded-xl text-sm bg-white font-semibold outline-none"
                        >
                            <option value="ALL">అన్ని గ్రూపులు</option>
                            <option value="1">Group 1</option>
                            <option value="2">Group 2</option>
                            <option value="3">Group 3</option>
                            <option value="4">Group 4</option>
                            <option value="5">Group 5</option>
                        </select>
                        <button 
                            onClick={fetchSources} 
                            className="text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                            రిఫ్రెష్
                        </button>
                    </div>
                </div>

                {isFetching && sources.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredSources.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] border text-center text-gray-400 font-bold">
                        సోర్స్‌లు ఏవీ కనుగొనబడలేదు.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredSources.map(src => (
                            <div 
                                key={src.id} 
                                className={`bg-white p-5 rounded-[2rem] border transition-all ${
                                    src.isPaused 
                                        ? 'border-gray-200 bg-gray-50/70 opacity-80' 
                                        : src.lastStatus === 'error' 
                                        ? 'border-red-200 hover:border-red-300 shadow-sm' 
                                        : 'border-gray-200 hover:border-purple-200 shadow-sm'
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            {src.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />}
                                            <span className="font-black text-2xl text-gray-800 truncate">{src.siteName}</span>
                                            
                                            {src.isPaused && (
                                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                    PAUSED
                                                </span>
                                            )}
                                            
                                            <span className="text-[10px] bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full font-bold">
                                                {src.category}
                                            </span>

                                            {src.district && (
                                                <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                                                    {src.state ? `${src.state} - ` : ''}{src.district}
                                                </span>
                                            )}

                                            <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                                                Group {src.group || 1}
                                            </span>
                                        </div>

                                        <p className="text-gray-500 text-xs font-mono truncate bg-gray-50 p-2 rounded-xl mb-3 border border-gray-100">
                                            {src.url}
                                        </p>

                                        {/* Stats Row */}
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <StatItem label="24 గంటలు ✅" value={src.processed24h || 0} color="text-green-600" />
                                            <StatItem label="24 గంటలు ❌" value={src.failed24h || 0} color="text-red-500" />
                                            <StatItem label="నేటివి" value={src.todayProcessedCount || 0} color="text-blue-600" />
                                            <StatItem label="మొత్తం" value={(src.totalProcessedCount || 0) + (src.totalFailedCount || 0)} color="text-purple-600" />
                                            
                                            <div className="ml-auto text-right text-xs text-gray-500">
                                                <span className="font-semibold text-gray-400">చివరి చెక్: </span>
                                                <span className="font-bold text-gray-700">{formatLastCheck(src.lastFetchTime)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex lg:flex-col gap-2 justify-end lg:justify-center shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-3 lg:pt-0 lg:pl-4">
                                        <button 
                                            onClick={() => handleTogglePause(src)} 
                                            title={src.isPaused ? "Resume Scraping" : "Pause Scraping"}
                                            className={`p-3 rounded-2xl active:scale-90 transition-all ${
                                                src.isPaused ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                            }`}
                                        >
                                            {src.isPaused ? <PlayIcon /> : <PauseIcon />}
                                        </button>
                                        <button 
                                            onClick={() => { 
                                                setEditingId(src.id); 
                                                setSiteName(src.siteName); 
                                                setSiteUrl(src.url); 
                                                setCategory(src.category || 'జిల్లా వార్తలు');
                                                if (src.state) setState(src.state);
                                                if (src.district) setDistrict(src.district);
                                                setScrapeGroup((src.group || 1).toString());
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }} 
                                            title="Edit Source"
                                            className="p-3 bg-blue-100 hover:bg-blue-200 rounded-2xl text-blue-700 active:scale-90 transition-all"
                                        >
                                            <EditIcon />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(src.id)} 
                                            title="Delete Source"
                                            className="p-3 bg-red-100 hover:bg-red-200 rounded-2xl text-red-700 active:scale-90 transition-all"
                                        >
                                            <DeleteIcon />
                                        </button>
                                    </div>
                                </div>

                                {src.lastStatus === 'error' && src.lastError && (
                                    <div className="mt-3 p-2.5 bg-red-50 rounded-xl text-red-600 text-xs font-bold border border-red-100 flex items-center gap-2">
                                        <span>⚠ Error:</span>
                                        <span className="truncate">{src.lastError}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebScrapingPage;
