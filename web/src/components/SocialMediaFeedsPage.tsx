
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SocialFeed, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, where, limit, writeBatch } = _firestore as any;
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

    // Search, Filter & Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<'ALL' | 'AP' | 'TS' | 'GENERAL'>('ALL');
    const [filterDistrict, setFilterDistrict] = useState<string>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ERROR' | 'HAS_TODAY'>('ALL');
    const [sortBy, setSortBy] = useState<'name_asc' | 'today_desc' | 'total_desc' | 'last_checked' | 'errors_first'>('name_asc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    // Reset pagination to page 1 whenever any filter, search or page size changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterState, filterDistrict, filterCategory, filterStatus, sortBy, pageSize]);

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
            const payload: any = { 
                url: url.trim(), 
                sourceName: sourceName.trim(), 
                platform, 
                category,
                state: state ? state : null,
                district: district ? district : null
            };
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

    const parseItemDate = (item: any): Date | null => {
        const ts = item.timestamp || item.publishedAt || item.createdAt;
        if (!ts) return null;
        try {
            if (typeof ts.toDate === 'function') return ts.toDate();
            if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
            if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
            if (typeof ts === 'string' || typeof ts === 'number') {
                const d = new Date(ts);
                return isNaN(d.getTime()) ? null : d;
            }
        } catch (e) {}
        return null;
    };

    const isItemFromToday = (item: any): boolean => {
        const d = parseItemDate(item);
        if (!d) return false;
        const now = new Date();
        return d.getDate() === now.getDate() && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
    };

    const formatItemDateTime = (item: any): string => {
        const d = parseItemDate(item);
        if (!d) return '';
        try {
            const timeStr = d.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' });
            if (isItemFromToday(item)) {
                return `నేడు, ${timeStr}`;
            }
            const dateStr = d.toLocaleDateString('te-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${dateStr}, ${timeStr}`;
        } catch (e) {}
        return '';
    };

    const showTodayNews = async (sourceName?: string) => {
        setDetailFeed(sourceName || 'ALL');
        setLoadingDetails(true);
        setTodayNews([]);
        try {
            let items: any[] = [];
            
            if (sourceName && sourceName !== 'ALL') {
                // 1. Primary query: by categories array-contains sourceName ordered by timestamp desc
                try {
                    const q = query(
                        collection(db, 'news'),
                        where('categories', 'array-contains', sourceName),
                        orderBy('timestamp', 'desc'),
                        limit(30)
                    );
                    const snap = await getDocs(q);
                    items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                } catch (e) {
                    console.warn("Categories query failed:", e);
                }

                // 2. Fallback: by handle if sourceName yielded 0
                if (items.length === 0) {
                    const matchedFeed = feeds.find(f => f.sourceName === sourceName);
                    const handle = matchedFeed?.url?.replace(/^@+/, '')?.trim();
                    if (handle && handle !== sourceName) {
                        try {
                            const qHandle = query(
                                collection(db, 'news'),
                                where('categories', 'array-contains', `X (@${handle})`),
                                orderBy('timestamp', 'desc'),
                                limit(30)
                            );
                            const snapHandle = await getDocs(qHandle);
                            items = snapHandle.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                        } catch (err) {
                            console.warn("Handle query failed:", err);
                        }
                    }
                }
            } else {
                // ALL: Fetch recent 40 Social news
                try {
                    const qAll = query(
                        collection(db, 'news'),
                        where('categories', 'array-contains', 'Social'),
                        orderBy('timestamp', 'desc'),
                        limit(40)
                    );
                    const snapAll = await getDocs(qAll);
                    items = snapAll.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                } catch (e) {
                    console.warn("All social query failed:", e);
                }
            }

            setTodayNews(items);
        } catch (e) {
            console.error("Error fetching news:", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const resetAllDailyCounts = async () => {
        if (!window.confirm("అన్ని సోర్స్‌ల 'నేడు (Today)' కౌంటర్లను 0 కి రీసెట్ చేయాలా?\n(ఇది గత రోజుల నుండి మిగిలిపోయిన కౌంటర్లను క్లియర్ చేస్తుంది)")) return;
        setIsFetching(true);
        try {
            const batch = writeBatch(db);
            feeds.forEach(f => {
                batch.update(doc(db, 'social_feeds', f.id), { todayProcessedCount: 0 });
            });
            await batch.commit();
            await fetchFeeds();
            alert("అన్ని సోర్స్‌ల నేటి కౌంటర్లు విజయవంతంగా రీసెట్ అయ్యాయి!");
        } catch (e: any) {
            console.error("Error resetting daily counts:", e);
            alert("రీసెట్ చేయడంలో సమస్య: " + e.message);
        } finally {
            setIsFetching(false);
        }
    };

    const formatLastCheck = (ts: any) => {
        if (!ts) return 'ఎప్పుడూ లేదు';
        const date = ts instanceof Timestamp ? ts.toDate() : (ts?._seconds ? new Date(ts._seconds * 1000) : new Date(ts));
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

    // Compute category counts for filter dropdown
    const categoryListWithCounts = useMemo(() => {
        const map = new Map<string, number>();
        feeds.forEach(f => {
            const c = f.category || 'ఇతర';
            map.set(c, (map.get(c) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [feeds]);

    // Check if any filter is actively applied
    const isFilterActive = searchQuery.trim() !== '' || 
        filterState !== 'ALL' || 
        filterDistrict !== 'ALL' || 
        filterCategory !== 'ALL' || 
        filterStatus !== 'ALL' ||
        sortBy !== 'name_asc';

    const clearAllFilters = () => {
        setSearchQuery('');
        setFilterState('ALL');
        setFilterDistrict('ALL');
        setFilterCategory('ALL');
        setFilterStatus('ALL');
        setSortBy('name_asc');
    };

    // Filter and Sort feeds
    const filteredAndSortedFeeds = useMemo(() => {
        return feeds.filter(feed => {
            // 1. Search Query
            const q = searchQuery.trim().toLowerCase();
            if (q) {
                const matches = 
                    (feed.sourceName || '').toLowerCase().includes(q) || 
                    (feed.url || '').toLowerCase().includes(q) ||
                    (feed.district || '').toLowerCase().includes(q) ||
                    (feed.category || '').toLowerCase().includes(q) ||
                    (feed.state || '').toLowerCase().includes(q);
                if (!matches) return false;
            }

            // 2. State Filter
            if (filterState === 'AP') {
                const isAP = feed.state === 'Andhra Pradesh' || (feed.district && AP_DISTRICTS.includes(feed.district));
                if (!isAP) return false;
            } else if (filterState === 'TS') {
                const isTS = feed.state === 'Telangana' || (feed.district && TS_DISTRICTS.includes(feed.district));
                if (!isTS) return false;
            } else if (filterState === 'GENERAL') {
                if (feed.state || feed.district) return false;
            }

            // 3. District Filter
            if (filterDistrict !== 'ALL') {
                if (filterDistrict === 'WITH_DISTRICT') {
                    if (!feed.district) return false;
                } else if (filterDistrict === 'WITHOUT_DISTRICT') {
                    if (feed.district) return false;
                } else {
                    if (feed.district !== filterDistrict) return false;
                }
            }

            // 4. Category Filter
            if (filterCategory !== 'ALL') {
                if (feed.category !== filterCategory) return false;
            }

            // 5. Status Filter
            if (filterStatus === 'ACTIVE') {
                if (feed.lastStatus === 'error' || feed.isPaused) return false;
            } else if (filterStatus === 'ERROR') {
                if (feed.lastStatus !== 'error') return false;
            } else if (filterStatus === 'HAS_TODAY') {
                if (!feed.todayProcessedCount || feed.todayProcessedCount <= 0) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'today_desc') {
                return (b.todayProcessedCount || 0) - (a.todayProcessedCount || 0);
            }
            if (sortBy === 'total_desc') {
                return ((b.totalProcessedCount || 0) + (b.totalFailedCount || 0)) - ((a.totalProcessedCount || 0) + (a.totalFailedCount || 0));
            }
            if (sortBy === 'errors_first') {
                const aErr = a.lastStatus === 'error' ? 1 : 0;
                const bErr = b.lastStatus === 'error' ? 1 : 0;
                if (bErr !== aErr) return bErr - aErr;
                return (a.sourceName || '').localeCompare(b.sourceName || '');
            }
            if (sortBy === 'last_checked') {
                const getTs = (f: any) => {
                    const t = f.lastFetchTime;
                    if (!t) return 0;
                    if (t.toMillis) return t.toMillis();
                    if (t._seconds) return t._seconds * 1000;
                    return new Date(t).getTime() || 0;
                };
                return getTs(b) - getTs(a);
            }
            // default: name_asc
            return (a.sourceName || '').localeCompare(b.sourceName || '');
        });
    }, [feeds, searchQuery, filterState, filterDistrict, filterCategory, filterStatus, sortBy]);

    // Pagination Calculations
    const totalItems = filteredAndSortedFeeds.length;
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = pageSize === -1 ? 0 : (safePage - 1) * pageSize;

    const paginatedFeeds = useMemo(() => {
        if (pageSize === -1) return filteredAndSortedFeeds;
        return filteredAndSortedFeeds.slice(startIndex, startIndex + pageSize);
    }, [filteredAndSortedFeeds, startIndex, pageSize]);

    // Generate smart page numbers array
    const getPageNumbers = (current: number, total: number) => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages: (number | string)[] = [];
        if (current <= 4) {
            pages.push(1, 2, 3, 4, 5, '...', total);
        } else if (current >= total - 3) {
            pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
        } else {
            pages.push(1, '...', current - 1, current, current + 1, '...', total);
        }
        return pages;
    };

    const pageNumbers = useMemo(() => getPageNumbers(safePage, totalPages), [safePage, totalPages]);

    return (
        <div className="font-mallanna text-black animate-fade-in relative">
            {/* Detail Modal */}
            {detailFeed && (() => {
                const todayItems = todayNews.filter(isItemFromToday);
                const hasToday = todayItems.length > 0;
                const hasAny = todayNews.length > 0;

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                                <div>
                                    <h3 className="text-2xl font-ramabhadra text-gray-800">{detailFeed === 'ALL' ? 'సోషల్ మీడియా వార్తలు' : detailFeed}</h3>
                                    <p className="text-sm font-bold uppercase tracking-widest mt-1">
                                        {!hasAny ? (
                                            <span className="text-gray-400">వార్తలు నమోదు కాలేదు</span>
                                        ) : hasToday ? (
                                            <span className="text-green-600 font-extrabold flex items-center gap-1">
                                                ✓ ఈరోజు సేకరించినవి: {todayItems.length} వార్తలు (మొత్తం {todayNews.length})
                                            </span>
                                        ) : (
                                            <span className="text-amber-700 font-bold flex items-center gap-1">
                                                ℹ️ ఈరోజు కొత్త వార్తలు రాలేదు • గతంలో వచ్చినవి: {todayNews.length} వార్తలు
                                            </span>
                                        )}
                                    </p>
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
                                ) : !hasAny ? (
                                    <div className="py-20 text-center space-y-3">
                                        <div className="text-4xl">📭</div>
                                        <p className="text-gray-600 font-bold text-lg">ఈ సోర్స్ నుండి ఇంకా ఏ వార్తలూ సేకరించబడలేదు.</p>
                                        {detailFeed !== 'ALL' && feeds.find(f => f.sourceName === detailFeed)?.lastFetchTime && (
                                            <p className="text-xs text-gray-500 font-bold">
                                                చివరి చెక్ సమయం: {formatLastCheck(feeds.find(f => f.sourceName === detailFeed)?.lastFetchTime)}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    todayNews.map((item: any) => {
                                        const isToday = isItemFromToday(item);
                                        return (
                                            <div key={item.id} className={`p-4 rounded-2xl border transition-colors ${isToday ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-100 hover:bg-blue-50'}`}>
                                                <div className="flex justify-between items-start gap-2 mb-1.5 flex-wrap">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-2.5 py-0.5 bg-blue-100/70 rounded-full">
                                                            {item.categories?.find((c: string) => c !== 'Social' && c !== 'Local' && c !== item.category) || item.sourceName || 'SOCIAL'}
                                                        </span>
                                                        {isToday ? (
                                                            <span className="text-[9px] font-black text-green-700 uppercase tracking-wider px-2 py-0.5 bg-green-100 rounded-full border border-green-300">
                                                                ✓ నేటి వార్త
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-2 py-0.5 bg-gray-200/80 rounded-full">
                                                                {parseItemDate(item)?.toLocaleDateString('te-IN', { day: 'numeric', month: 'short' })} నాటిది
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-600 bg-white px-2 py-0.5 rounded-lg border border-gray-100">
                                                        {formatItemDateTime(item)}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold leading-snug text-gray-800">{item.headline?.telugu || item.headline}</h4>
                                                {item.content?.telugu && (
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content.telugu}</p>
                                                )}
                                                {item.originalUrl && (
                                                    <a href={item.originalUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 mt-2 block truncate max-w-full font-mono hover:underline">
                                                        🔗 {item.originalUrl}
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="p-4 border-t bg-gray-50 text-center">
                                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Alfa News Social Monitor v1.0</p>
                            </div>
                        </div>
                    </div>
                );
            })()}

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

                {/* State & District Assignment - Always Available */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                            <span>📍 ప్రాంతీయ కేటాయింపు (రాష్ట్రం & జిల్లా - ఐచ్ఛికం)</span>
                        </label>
                        {(state || district) && (
                            <button
                                type="button"
                                onClick={() => { setState(''); setDistrict(''); }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-full transition-all"
                            >
                                ✕ జిల్లా/రాష్ట్రం తొలగించు (Clear)
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">రాష్ట్రం (State)</label>
                            <select 
                                value={state} 
                                onChange={e => { 
                                    const newState = e.target.value;
                                    setState(newState); 
                                    if (newState === 'Telangana' && district && !TS_DISTRICTS.includes(district)) {
                                        setDistrict('');
                                    } else if (newState === 'Andhra Pradesh' && district && !AP_DISTRICTS.includes(district)) {
                                        setDistrict('');
                                    }
                                }} 
                                className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">రాష్ట్రం ఎంచుకోండి (ఐచ్ఛికం - None / All)</option>
                                <option value="Andhra Pradesh">ఆంధ్ర ప్రదేశ్ (Andhra Pradesh)</option>
                                <option value="Telangana">తెలంగాణ (Telangana)</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">జిల్లా (District)</label>
                            <select 
                                value={district} 
                                onChange={e => {
                                    const selDistrict = e.target.value;
                                    setDistrict(selDistrict);
                                    if (selDistrict) {
                                        if (TS_DISTRICTS.includes(selDistrict)) {
                                            setState('Telangana');
                                        } else if (AP_DISTRICTS.includes(selDistrict)) {
                                            setState('Andhra Pradesh');
                                        }
                                    }
                                }} 
                                className="w-full border p-4 rounded-2xl text-lg font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">జిల్లా లేదు / సాధారణ (None / General)</option>
                                {state === 'Telangana' ? (
                                    TS_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)
                                ) : state === 'Andhra Pradesh' ? (
                                    AP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)
                                ) : (
                                    <>
                                        <optgroup label={`── ఆంధ్ర ప్రదేశ్ జిల్లాలు (${AP_DISTRICTS.length}) ──`}>
                                            {AP_DISTRICTS.map(d => <option key={`ap-${d}`} value={d}>{d}</option>)}
                                        </optgroup>
                                        <optgroup label={`── తెలంగాణ జిల్లాలు (${TS_DISTRICTS.length}) ──`}>
                                            {TS_DISTRICTS.map(d => <option key={`ts-${d}`} value={d}>{d}</option>)}
                                        </optgroup>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="px-2">
                        {district ? (
                            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-bold flex items-center gap-2.5">
                                <span className="text-lg shrink-0">📍</span>
                                <div>
                                    ఈ ఖాతా <strong>{district}</strong> ({state || 'రాష్ట్రం'}) జిల్లాకు కేటాయించబడింది. 
                                    ఈ ఖాతా నుండి వచ్చే వార్తలు యాప్‌లో <strong>{district} లోకల్ ఫీడ్‌లో మాత్రమే</strong> కనిపిస్తాయి.
                                </div>
                            </div>
                        ) : state ? (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 font-bold flex items-center gap-2">
                                <span className="text-base shrink-0">🏛️</span>
                                <span>ఈ ఖాతా <strong>{state}</strong> రాష్ట్ర స్థాయికి కేటాయించబడింది. నిర్దిష్ట జిల్లా కేటాయించలేదు.</span>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                <span>🌐</span>
                                <span>జిల్లా లేదా రాష్ట్రం కేటాయించకపోతే, ఇది సాధారణ / కేటగిరీ వార్తగా పరిగణించబడుతుంది (ఉదా: భక్తి, రాజకీయం, జాతీయం).</span>
                            </p>
                        )}
                    </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white w-full py-4 rounded-2xl font-bold text-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all">
                    {isSubmitting ? 'సేవ్ అవుతోంది...' : editingId ? 'అప్‌డేట్ చేయి' : 'సోర్స్‌ను సేవ్ చేయి'}
                </button>
                {editingId && <button type="button" onClick={resetForm} className="w-full text-gray-500 font-bold py-2 hover:text-gray-800 transition-colors">రద్దు (Cancel)</button>}
            </form>

            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-center px-2 flex-wrap gap-2">
                    <div>
                        <h3 className="font-ramabhadra text-2xl text-gray-800">
                            యాక్టివ్ సోర్స్‌లు ({feeds.length})
                        </h3>
                        <p className="text-xs text-gray-400 font-bold">
                            జిల్లా కేటాయించినవి: {feeds.filter(f => !!f.district).length} • సాధారణమైనవి: {feeds.filter(f => !f.district).length}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button 
                            onClick={resetAllDailyCounts} 
                            disabled={isFetching}
                            className="text-xs font-black text-amber-700 uppercase tracking-widest bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-full transition-all"
                            title="అన్ని సోర్స్‌ల నేటి (Today) కౌంటర్లను 0 కి రీసెట్ చేస్తుంది"
                        >
                            🔄 నేటి లెక్కలు రీసెట్ (Reset Today)
                        </button>
                        <button onClick={fetchFeeds} className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-all">Refresh Stats</button>
                    </div>
                </div>

                {/* Search, Multi-Filter & Sort Controls */}
                <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
                    {/* Row 1: Search Bar & Sort Dropdown */}
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="సోర్స్ పేరు, @హ్యాండిల్, జిల్లా లేదా కేటగిరి ద్వారా వెతకండి..."
                                className="w-full pl-10 pr-9 py-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-medium"
                            />
                            <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔍</span>
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')} 
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-xs font-bold"
                                    title="వెతుకులాట క్లియర్ చేయి"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Sort Selector */}
                        <div className="w-full md:w-auto shrink-0 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 shrink-0">సార్టింగ్:</span>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                                className="w-full md:w-auto border py-2.5 px-3 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="name_asc">🔤 పేరు (A → Z)</option>
                                <option value="today_desc">🔥 నేటి వార్తలు (ఎక్కువ నుంచి)</option>
                                <option value="total_desc">📊 మొత్తం పోస్ట్‌లు (ఎక్కువ నుంచి)</option>
                                <option value="last_checked">⏱️ చివరిగా చెక్ చేసినవి</option>
                                <option value="errors_first">⚠️ సమస్యలు ఉన్నవి మొదట</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: 4-Way Filter Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                        {/* 1. State Filter */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">రాష్ట్రం (State)</label>
                            <select
                                value={filterState}
                                onChange={e => {
                                    const st = e.target.value as any;
                                    setFilterState(st);
                                    setFilterDistrict('ALL');
                                }}
                                className="w-full border py-2 px-3 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="ALL">అన్ని రాష్ట్రాలు ({feeds.length})</option>
                                <option value="AP">🏛️ ఆంధ్రప్రదేశ్ ({feeds.filter(f => f.state === 'Andhra Pradesh' || (f.district && AP_DISTRICTS.includes(f.district))).length})</option>
                                <option value="TS">🏛️ తెలంగాణ ({feeds.filter(f => f.state === 'Telangana' || (f.district && TS_DISTRICTS.includes(f.district))).length})</option>
                                <option value="GENERAL">🌐 సాధారణ / జాతీయ ({feeds.filter(f => !f.state && !f.district).length})</option>
                            </select>
                        </div>

                        {/* 2. District Filter */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">జిల్లా (District)</label>
                            <select
                                value={filterDistrict}
                                onChange={e => setFilterDistrict(e.target.value)}
                                className="w-full border py-2 px-3 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="ALL">అన్ని జిల్లాలు</option>
                                <option value="WITH_DISTRICT">📍 జిల్లా కేటాయించినవి ({feeds.filter(f => !!f.district).length})</option>
                                <option value="WITHOUT_DISTRICT">🌐 జిల్లా లేనివి ({feeds.filter(f => !f.district).length})</option>

                                {filterState === 'AP' ? (
                                    AP_DISTRICTS.map(d => {
                                        const count = feeds.filter(f => f.district === d).length;
                                        return count > 0 ? <option key={`ap-f-${d}`} value={d}>{d} ({count})</option> : null;
                                    })
                                ) : filterState === 'TS' ? (
                                    TS_DISTRICTS.map(d => {
                                        const count = feeds.filter(f => f.district === d).length;
                                        return count > 0 ? <option key={`ts-f-${d}`} value={d}>{d} ({count})</option> : null;
                                    })
                                ) : (
                                    <>
                                        <optgroup label="── ఆంధ్రప్రదేశ్ జిల్లాలు ──">
                                            {AP_DISTRICTS.map(d => {
                                                const count = feeds.filter(f => f.district === d).length;
                                                return count > 0 ? <option key={`all-ap-${d}`} value={d}>{d} ({count})</option> : null;
                                            })}
                                        </optgroup>
                                        <optgroup label="── తెలంగాణ జిల్లాలు ──">
                                            {TS_DISTRICTS.map(d => {
                                                const count = feeds.filter(f => f.district === d).length;
                                                return count > 0 ? <option key={`all-ts-${d}`} value={d}>{d} ({count})</option> : null;
                                            })}
                                        </optgroup>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* 3. Category Filter */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">కేటగిరి (Category)</label>
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="w-full border py-2 px-3 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="ALL">అన్ని కేటగిరీలు ({feeds.length})</option>
                                {categoryListWithCounts.map(cat => (
                                    <option key={cat.name} value={cat.name}>{cat.name} ({cat.count})</option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Status Filter */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">స్టేటస్ (Status)</label>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value as any)}
                                className="w-full border py-2 px-3 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="ALL">అన్ని ఫీడ్లు ({feeds.length})</option>
                                <option value="ACTIVE">✅ యాక్టివ్ ({feeds.filter(f => f.lastStatus !== 'error' && !f.isPaused).length})</option>
                                <option value="ERROR">⚠️ సమస్యలు / ఎర్రర్స్ ({feeds.filter(f => f.lastStatus === 'error').length})</option>
                                <option value="HAS_TODAY">🔥 నేడు వార్తలు వచ్చినవి ({feeds.filter(f => (f.todayProcessedCount || 0) > 0).length})</option>
                            </select>
                        </div>
                    </div>

                    {/* Active Filter Chips & Clear All */}
                    {isFilterActive && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-400">యాక్టివ్ ఫిల్టర్లు:</span>
                                {searchQuery && (
                                    <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-blue-200">
                                        🔍 "{searchQuery}" <button onClick={() => setSearchQuery('')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                                {filterState !== 'ALL' && (
                                    <span className="bg-purple-50 text-purple-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
                                        🏛️ {filterState === 'AP' ? 'ఆంధ్రప్రదేశ్' : filterState === 'TS' ? 'తెలంగాణ' : 'సాధారణ/జాతీయ'}
                                        <button onClick={() => setFilterState('ALL')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                                {filterDistrict !== 'ALL' && (
                                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                                        📍 {filterDistrict} <button onClick={() => setFilterDistrict('ALL')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                                {filterCategory !== 'ALL' && (
                                    <span className="bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                                        🏷️ {filterCategory} <button onClick={() => setFilterCategory('ALL')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                                {filterStatus !== 'ALL' && (
                                    <span className="bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-rose-200">
                                        ⚡ {filterStatus === 'ACTIVE' ? 'యాక్టివ్' : filterStatus === 'ERROR' ? 'ఎర్రర్' : 'నేటి వార్తలు'} 
                                        <button onClick={() => setFilterStatus('ALL')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                                {sortBy !== 'name_asc' && (
                                    <span className="bg-gray-100 text-gray-700 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-gray-200">
                                        ⇅ సార్ట్ <button onClick={() => setSortBy('name_asc')} className="hover:text-red-500 font-black">✕</button>
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={clearAllFilters}
                                className="text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-all border border-red-200 flex items-center gap-1 active:scale-95"
                            >
                                ✕ ఫిల్టర్లు అన్నీ రీసెట్ చేయి (Clear All)
                            </button>
                        </div>
                    )}
                </div>

                {/* Top Pagination Bar */}
                {totalItems > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border shadow-sm">
                        <div className="text-xs font-bold text-gray-500">
                            చూపిస్తున్నవి: <span className="text-gray-900 font-extrabold">{startIndex + 1} - {Math.min(startIndex + (pageSize === -1 ? totalItems : pageSize), totalItems)}</span> / మొత్తం <span className="text-blue-600 font-extrabold">{totalItems}</span> ఫీడ్లు
                            {totalItems !== feeds.length && (
                                <span className="text-gray-400 font-medium ml-1.5">(మొత్తం {feeds.length} లో)</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-center">
                            {/* Page size selector */}
                            <div className="flex items-center gap-1.5 mr-2">
                                <span className="text-[11px] font-bold text-gray-400">పేజీకి:</span>
                                <select
                                    value={pageSize}
                                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                    className="border py-1 px-2 rounded-lg text-xs font-bold bg-gray-50 outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={-1}>అన్నీ ({totalItems})</option>
                                </select>
                            </div>

                            {pageSize !== -1 && totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={safePage === 1}
                                        className="px-2 py-1 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                        title="మొదటి పేజీ"
                                    >
                                        ««
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        className="px-2.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                        title="మునుపటి పేజీ"
                                    >
                                        ‹ మునుపటి
                                    </button>

                                    {pageNumbers.map((page, idx) => (
                                        typeof page === 'number' ? (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-black transition-all ${
                                                    safePage === page
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                        : 'border hover:bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ) : (
                                            <span key={`ellipsis-top-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                                        )
                                    ))}

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        className="px-2.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                        title="తరువాతి పేజీ"
                                    >
                                        తరువాతి ›
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={safePage === totalPages}
                                        className="px-2 py-1 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                        title="చివరి పేజీ"
                                    >
                                        »»
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {isFetching && feeds.length === 0 ? (
                    <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : filteredAndSortedFeeds.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] border text-center space-y-2">
                        <div className="text-3xl">🔍</div>
                        <h4 className="font-bold text-gray-700 text-lg">ఎటువంటి సోర్స్‌లు దొరకలేదు</h4>
                        <p className="text-gray-400 text-sm">శోధన లేదా ఫిల్టర్ మార్చి ప్రయత్నించండి.</p>
                        {isFilterActive && (
                            <button 
                                onClick={clearAllFilters}
                                className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-all border border-blue-200"
                            >
                                ఫిల్టర్లను క్లియర్ చేయి (Clear Filters)
                            </button>
                        )}
                    </div>
                ) : (
                    paginatedFeeds.map(feed => (
                        <div key={feed.id} className="bg-white p-5 rounded-[2rem] border shadow-sm hover:border-blue-200 transition-all group">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                                        {feed.lastStatus === 'error' ? <StatusErrorIcon /> : <StatusOkIcon />}
                                        <span className="font-black text-2xl text-gray-800 truncate">{feed.sourceName}</span>
                                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">{feed.category}</span>
                                        {feed.district && (
                                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
                                                📍 {feed.district} {feed.state && `(${feed.state === 'Telangana' ? 'TS' : feed.state === 'Andhra Pradesh' ? 'AP' : feed.state})`}
                                            </span>
                                        )}
                                        {!feed.district && feed.state && (
                                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                                                🏛️ {feed.state}
                                            </span>
                                        )}
                                        {!feed.district && !feed.state && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                                                🌐 సాధారణ / జిల్లా లేదు
                                            </span>
                                        )}
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
                                            setEditingId(feed.id); setSourceName(feed.sourceName || ''); setUrl(feed.url || (feed as any).handle || ''); 
                                            setPlatform(feed.platform || 'Twitter'); setCategory(feed.category || 'రాజకీయం');
                                            setState(feed.state || ''); setDistrict(feed.district || '');
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }} title="సవరించండి (Edit)" className="p-4 bg-blue-50 rounded-2xl text-blue-600 active:scale-90 transition-all hover:bg-blue-100"><EditIcon /></button>
                                        <button onClick={async () => { if (window.confirm("ఈ సోర్స్‌ను తొలగించాలా?")) { await deleteDoc(doc(db, 'social_feeds', feed.id)); fetchFeeds(); } }} title="తొలగించండి (Delete)" className="p-4 bg-red-50 rounded-2xl text-red-600 active:scale-90 transition-all hover:bg-red-100"><DeleteIcon /></button>
                                    </div>
                                </div>
                            </div>
                            {feed.lastStatus === 'error' && feed.lastError && (
                                <div className="mt-4 p-3 bg-red-50 rounded-2xl text-red-500 text-xs font-bold border border-red-100">
                                    ⚠ Error: {feed.lastError}
                                </div>
                            )}
                        </div>
                    ))
                )}

                {/* Bottom Pagination Bar */}
                {totalItems > 0 && pageSize !== -1 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border shadow-sm mt-4">
                        <div className="text-xs font-bold text-gray-500">
                            పేజీ <span className="text-blue-600 font-black">{safePage}</span> / <span className="font-bold">{totalPages}</span> (మొత్తం {totalItems} ఫీడ్లు)
                        </div>

                        <div className="flex items-center gap-1 flex-wrap justify-center">
                            <button
                                onClick={() => { setCurrentPage(1); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={safePage === 1}
                                className="px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                title="మొదటి పేజీ"
                            >
                                «« మొదటిది
                            </button>
                            <button
                                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={safePage === 1}
                                className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                title="మునుపటి పేజీ"
                            >
                                ‹ మునుపటి
                            </button>

                            {pageNumbers.map((page, idx) => (
                                typeof page === 'number' ? (
                                    <button
                                        key={`bottom-${page}`}
                                        onClick={() => { setCurrentPage(page); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                        className={`min-w-[32px] h-8 px-2.5 rounded-lg text-xs font-black transition-all ${
                                            safePage === page
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                : 'border hover:bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span key={`ellipsis-bottom-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                                )
                            ))}

                            <button
                                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={safePage === totalPages}
                                className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                title="తరువాతి పేజీ"
                            >
                                తరువాతి ›
                            </button>
                            <button
                                onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={safePage === totalPages}
                                className="px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all"
                                title="చివరి పేజీ"
                            >
                                చివరిది »»
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SocialMediaFeedsPage;
