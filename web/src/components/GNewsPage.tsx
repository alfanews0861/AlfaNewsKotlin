
import React, { useState, useEffect } from 'react';
import { app, db } from '../services/firebase';
import * as _functions from 'firebase/functions';
import * as _firestore from 'firebase/firestore';

const { getFunctions, httpsCallable } = _functions as any;
const { doc, onSnapshot, collection, query, where, getDocs, Timestamp, orderBy, limit, setDoc } = _firestore as any;

const ALL_DISTRICTS = [
    'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం', 'జయశంకర్ భూపాలపల్లి', 
    'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం', 'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్', 
    'మంచిర్యాల', 'మెదక్', 'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్', 
    'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట', 'సూర్యాపేట', 
    'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి', 'అల్లూరి సీతారామరాజు', 'అనकाపల్లి', 'అనంతపురం', 
    'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ', 'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 
    'కర్నూలు', 'నందయాల', 'ఎన్టీఆర్', 'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 
    'శ్రీ సత్యసాయి', 'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
];

const SPECIAL_CATEGORIES = [
    'Cinema', 'Entertainment', 'Health', 'National', 'International', 'Sports', 'Gadgets', 'Lifestyle', 'Food', 'General', 'State'
];

const CATEGORY_MAP: Record<string, string> = {
    'Cinema': 'సినిమా',
    'Entertainment': 'వినోదం',
    'Health': 'ఆరోగ్యం',
    'National': 'జాతీయ',
    'International': 'అంతర్జాతీయ',
    'Sports': 'క్రీడలు',
    'Gadgets': 'టెక్నాలజీ',
    'Lifestyle': 'జీవనశైలి',
    'Food': 'ఆహారం',
    'General': 'జనరల్',
    'State': 'రాష్ట్ర'
};

const GNewsPage: React.FC = () => {
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    
    const [isAutoFetchEnabled, setIsAutoFetchEnabled] = useState(false);
    const [fetchState, setFetchState] = useState<any>(null);
    const [totalToday, setTotalToday] = useState(0);
    const [districtStats, setDistrictStats] = useState<Record<string, number>>({});
    const [syncLogs, setSyncLogs] = useState<any[]>([]);

    // Detail Modal State
    const [detailDistrict, setDetailDistrict] = useState<string | null>(null);
    const [districtNews, setDistrictNews] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        const fetchTodayStats = async () => {
            try {
                const now = new Date();
                now.setHours(0,0,0,0);
                const startOfToday = Timestamp.fromDate(now);
                const q = query(collection(db, 'news'), where('timestamp', '>=', startOfToday));
                const snap = await getDocs(q);
                
                setTotalToday(snap.size);
                
                const stats: Record<string, number> = {};
                snap.docs.forEach((doc: any) => {
                    const data = doc.data();
                    const cat = data.category;
                    const dist = data.district || 'General';
                    
                    // Prioritize special categories for grouping
                    if (SPECIAL_CATEGORIES.includes(cat)) {
                        stats[cat] = (stats[cat] || 0) + 1;
                    } else {
                        stats[dist] = (stats[dist] || 0) + 1;
                    }
                });
                setDistrictStats(stats);
            } catch (e) {}
        };
        fetchTodayStats();

        const unsubConfig = onSnapshot(doc(db, 'system_settings', 'gnews_config'), (snap: any) => {
            if (snap.exists()) setIsAutoFetchEnabled(snap.data().isEnabled || false);
        });

        const unsubState = onSnapshot(doc(db, 'system_settings', 'fetch_state'), (snap: any) => {
            if (snap.exists()) setFetchState(snap.data());
        });

        const syncLogsQuery = query(collection(db, 'gnews_sync_logs'), orderBy('timestamp', 'desc'), limit(15));
        const unsubSync = onSnapshot(syncLogsQuery, (snap: any) => {
            setSyncLogs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubConfig(); unsubState(); unsubSync(); };
    }, []);

    const toggleAutoFetch = async () => {
        const newState = !isAutoFetchEnabled;
        setIsAutoFetchEnabled(newState);
        try {
            await setDoc(doc(db, 'system_settings', 'gnews_config'), { isEnabled: newState }, { merge: true });
        } catch (e: any) { alert(e.message); }
    };

    const handleManualFetch = async () => {
        if (!selectedDistrict) return;
        setLoading(true);
        setLogs([`శోధన ప్రారంభమైంది: ${selectedDistrict}...`]);
        try {
            const functions = getFunctions(app, 'asia-south1');
            const fetchGNewsFn = httpsCallable(functions, 'fetchGNews');
            const result: any = await fetchGNewsFn({ districtName: selectedDistrict });
            if (result.data.success) {
                setLogs(prev => [...prev, `గూగుల్‌లో ${result.data.totalFound || 0} వార్తలు దొరికాయి.`, `వాటిలో ${result.data.processed || 0} కొత్త వార్తలు సేవ్ అయ్యాయి.`]);
            }
        } catch (error: any) { 
            setLogs(prev => [...prev, `లోపం: ${error.message}`]); 
        } finally { setLoading(false); }
    };

    const showDistrictDetails = async (name: string) => {
        setDetailDistrict(name);
        setLoadingDetails(true);
        setDistrictNews([]);
        try {
            const now = new Date();
            now.setHours(0,0,0,0);
            const startOfToday = Timestamp.fromDate(now);
            
            let q;
            if (SPECIAL_CATEGORIES.includes(name)) {
                q = query(
                    collection(db, 'news'), 
                    where('category', '==', name),
                    where('timestamp', '>=', startOfToday),
                    orderBy('timestamp', 'desc')
                );
            } else {
                q = query(
                    collection(db, 'news'), 
                    where('district', '==', name),
                    where('timestamp', '>=', startOfToday),
                    orderBy('timestamp', 'desc')
                );
            }
            const snap = await getDocs(q);
            setDistrictNews(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error fetching district details:", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 font-mallanna text-black pb-24 animate-fade-in relative">
            
            {/* Detail Modal */}
            {detailDistrict && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-2xl font-ramabhadra text-gray-800">{CATEGORY_MAP[detailDistrict] || detailDistrict}</h3>
                                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">నేటి వార్తలు</p>
                            </div>
                            <button onClick={() => setDetailDistrict(null)} className="p-2 bg-white rounded-full shadow-sm hover:text-red-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loadingDetails ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-gray-500 font-bold">వార్తలను సేకరిస్తున్నాము...</p>
                                </div>
                            ) : districtNews.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 italic">ఈ జిల్లాలో ఈరోజు ఇంకా ఏ వార్తలు నమోదు కాలేదు.</div>
                            ) : (
                                districtNews.map((item, i) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-blue-50 transition-colors">
                                        <div className="flex justify-between items-start gap-3 mb-1">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-100/50 rounded-full">
                                                {item.reporter?.name || 'SYSTEM'}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {item.timestamp?.toMillis ? new Date(item.timestamp.toMillis()).toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-bold leading-tight text-gray-800">{item.headline?.telugu}</h4>
                                        {item.originalUrl && (
                                            <p className="text-[10px] text-gray-400 mt-2 truncate max-w-full italic">{item.originalUrl}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-center">
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Alfa News GNews Monitor v1.2</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isAutoFetchEnabled ? 'bg-green-600' : 'bg-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra leading-none mb-1 text-gray-800">సిస్టమ్ కంట్రోల్</h2>
                        <p className={`font-bold uppercase tracking-tighter text-sm ${isAutoFetchEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                            {isAutoFetchEnabled ? '● ఆటోమేటిక్ మోడ్ ఆన్ లో ఉంది' : '○ ఆటోమేటిక్ మోడ్ ఆపివేయబడింది'}
                        </p>
                    </div>
                </div>
                <button onClick={toggleAutoFetch} className={`px-8 py-3 rounded-2xl font-bold text-xl transition-all shadow-md active:scale-95 ${isAutoFetchEnabled ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-600 text-white shadow-green-200'}`}>
                    {isAutoFetchEnabled ? 'సిస్టమ్‌ను ఆపు' : 'సిస్టమ్‌ను ప్రారంభించు'}
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-blue-100 font-bold uppercase text-xs tracking-widest mb-2">నేటి మొత్తం వార్తలు</p>
                        <h3 className="text-6xl font-black leading-none">{totalToday}</h3>
                        <p className="mt-4 text-blue-100 text-sm italic font-bold">గత 24 గంటలలో డేటాబేస్ లో సేవ్ అయినవి</p>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center">
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2">చివరి యాక్టివిటీ సమయం</p>
                    <h3 className="text-4xl font-bold text-gray-800">
                         {fetchState?.lastRun ? new Date(fetchState.lastRun.toMillis()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '--:--'}
                    </h3>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-gray-500 font-bold text-sm">నెక్స్ట్ షెడ్యూల్: 30 నిమిషాలకు ఒకసారి</p>
                    </div>
                </div>
            </div>

            {/* District Stats Grid */}
            <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
                <h3 className="font-ramabhadra text-xl text-gray-800 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                    జిల్లాల వారీగా నేటి వార్తలు
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(districtStats).length > 0 ? (
                        Object.entries(districtStats).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, count]) => (
                            <button 
                                key={name} 
                                onClick={() => showDistrictDetails(name)}
                                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-1 group hover:border-blue-500 hover:bg-white transition-all shadow-sm active:scale-95"
                            >
                                <span className="text-3xl font-black text-gray-800 group-hover:text-blue-600 leading-none">{count}</span>
                                <span className="text-xs font-bold text-gray-400 truncate w-full text-center">
                                    {CATEGORY_MAP[name] || name}
                                </span>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full py-10 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 italic">
                             ఈరోజు ఇంకా ఏ జిల్లా వార్తలు రాలేదు.
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Scan Control */}
            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-2xl font-ramabhadra mb-2">మ్యాన్యువల్ జీన్యూస్ స్కానింగ్</h3>
                    <p className="text-gray-400 mb-8 leading-snug text-lg">ఆటోమేటిక్ సిస్టమ్ కాకుండా, మీకు ఇప్పుడే ఏదైనా ఒక జిల్లా వార్తలు కావాలంటే కింద ఎంచుకుని స్కాన్ చేయండి.</p>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                        <select 
                            value={selectedDistrict} 
                            onChange={(e) => setSelectedDistrict(e.target.value)} 
                            className="flex-1 bg-white/10 border border-white/20 p-4 rounded-2xl text-xl outline-none focus:bg-white/20 transition-all font-bold text-white backdrop-blur-md"
                        >
                            <option value="" className="text-black">జిల్లాను ఎంచుకోండి</option>
                            {ALL_DISTRICTS.map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                        </select>
                        <button 
                            onClick={handleManualFetch} 
                            disabled={loading || !selectedDistrict}
                            className="bg-white text-black font-bold px-12 py-4 rounded-2xl text-xl shadow-xl active:scale-95 transition-all disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center gap-3"
                        >
                            {loading ? <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin"></div> : '🔍'}
                            {loading ? 'స్కానింగ్...' : 'ఇప్పుడే స్కాన్ చేయి'}
                        </button>
                    </div>
                    {logs.length > 0 && (
                        <div className="mt-6 p-5 bg-black/50 rounded-2xl font-mono text-sm text-green-400 border border-white/10 shadow-inner">
                            {logs.map((log, i) => <div key={i}>{`> ${log}`}</div>)}
                        </div>
                    )}
                </div>
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Sync Activity Logs Feed */}
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
                <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-ramabhadra text-xl text-gray-800">సిస్టమ్ లైవ్ యాక్టివిటీ (గత 15)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                                <th className="px-6 py-5">Source</th>
                                <th className="px-6 py-5">జిల్లా / సైట్</th>
                                <th className="px-6 py-5">సమయం</th>
                                <th className="px-6 py-5 text-center">దొరికినవి</th>
                                <th className="px-6 py-5 text-center">సేవ్ అయినవి</th>
                                <th className="px-6 py-5">స్టేటస్</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {syncLogs.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">యాక్టివిటీ హిస్టరీ లేదు.</td></tr>
                            ) : syncLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                                            log.status === 'Auto-Scrape' ? 'bg-purple-100 text-purple-700' : 
                                            log.status === 'RSS-Scrape' ? 'bg-orange-100 text-orange-700' : 
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {log.status === 'Auto-Scrape' ? '🌐 SCRAPER' : 
                                             log.status === 'RSS-Scrape' ? '📡 RSS' : 
                                             '🔎 GNEWS'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-bold text-gray-700">{log.district}</td>
                                    <td className="px-6 py-5 text-sm text-gray-400 font-bold whitespace-nowrap">
                                        {log.timestamp?.toMillis ? new Date(log.timestamp.toMillis()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td className="px-6 py-5 text-center font-bold text-gray-400">{log.foundCount || 0}</td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`font-black text-lg ${log.savedCount > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                            {log.savedCount || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-xs text-gray-500 italic max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-blue-600 transition-all">
                                            {log.note || 'Done'}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GNewsPage;
