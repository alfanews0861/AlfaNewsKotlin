import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NewsPost, User, UserRole } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { Calendar, Trash2, Edit2, X, ChevronLeft, ChevronRight, BarChart2, Users, Folder } from 'lucide-react';

const { collection, query, orderBy, getDocs, doc, deleteDoc, Timestamp, where, limit } = _firestore as any;

const getMsFromTimestamp = (ts: any): number => {
    if (!ts) return Date.now();
    if (typeof ts.toMillis === 'function') {
        return ts.toMillis();
    }
    if (typeof ts.toDate === 'function') {
        return ts.toDate().getTime();
    }
    if (typeof ts === 'number') {
        return ts;
    }
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return isNaN(parsed) ? Date.now() : parsed;
    }
    if (ts.seconds !== undefined) {
        return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    }
    return Date.now();
};

const getPostLocalDateString = (timestampMs: number): string => {
    try {
        const date = new Date(timestampMs);
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Kolkata'
        };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
        return formatter.format(date);
    } catch (e) {
        const date = new Date(timestampMs);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
};

interface DailyReportPageProps {
  onEditPost: (post: NewsPost) => void;
  currentUser?: User;
}

const DailyReportPage: React.FC<DailyReportPageProps> = ({ onEditPost, currentUser }) => {
    // Default to today
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Popup state
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupTitle, setPopupTitle] = useState('');
    const [filteredPopupPosts, setFilteredPopupPosts] = useState<NewsPost[]>([]);
    const [activeFilterType, setActiveFilterType] = useState<'all' | 'category' | 'reporter' | null>(null);
    const [activeFilterValue, setActiveFilterValue] = useState<string | null>(null);

    const fetchPostsForDay = useCallback(async (targetDate: string) => {
        setLoading(true);
        setError('');
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const startMs = startOfDay.getTime();

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        const endMs = endOfDay.getTime();
        
        try {
            const newsCollectionRef = collection(db, 'news');
            let fetched: NewsPost[] = [];

            // Try 1: Try Timestamp range query
            if (Timestamp) {
                try {
                    const startTimestamp = Timestamp.fromMillis(startMs);
                    const endTimestamp = Timestamp.fromMillis(endMs);
                    const qTimestamp = query(
                        newsCollectionRef,
                        where('timestamp', '>=', startTimestamp),
                        where('timestamp', '<=', endTimestamp),
                        orderBy('timestamp', 'desc')
                    );
                    const querySnapshot = await getDocs(qTimestamp);
                    fetched = querySnapshot.docs.map((doc: any) => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: getMsFromTimestamp(doc.data().timestamp)
                    } as NewsPost));
                } catch (e) {
                    console.warn("Timestamp range query failed:", e);
                }
            }

            // Try 2: If we still have 0 posts, try number range query
            if (fetched.length === 0) {
                try {
                    const qNum = query(
                        newsCollectionRef,
                        where('timestamp', '>=', startMs),
                        where('timestamp', '<=', endMs),
                        orderBy('timestamp', 'desc')
                    );
                    const querySnapshot = await getDocs(qNum);
                    fetched = querySnapshot.docs.map((doc: any) => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: getMsFromTimestamp(doc.data().timestamp)
                    } as NewsPost));
                } catch (e) {
                    console.warn("Number range query failed:", e);
                }
            }

            // Try 3: Always supplement/fallback to in-memory filter of news posts (up to latest 1000 items)
            // This is super resilient and works under any index, type, or timezone constraint.
            if (fetched.length === 0) {
                const qLatest = query(
                    newsCollectionRef,
                    orderBy('timestamp', 'desc'),
                    limit(1000)
                );
                const querySnapshot = await getDocs(qLatest);
                const allFetched = querySnapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: getMsFromTimestamp(doc.data().timestamp)
                } as NewsPost));
                
                fetched = allFetched.filter((post: NewsPost) => {
                    const postDateStr = getPostLocalDateString(post.timestamp);
                    return postDateStr === targetDate;
                });
            } else {
                // Ensure all filtered posts perfectly match local IST targetDate
                fetched = fetched.filter((post: NewsPost) => {
                    const postDateStr = getPostLocalDateString(post.timestamp);
                    return postDateStr === targetDate;
                });
            }

            setPosts(fetched);
        } catch (e: any) {
            console.error("Critical error loading report:", e);
            setError("వార్తలు లోడ్ చేయడం విఫలమైంది: " + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPostsForDay(selectedDate);
    }, [selectedDate, fetchPostsForDay]);

    // Handle single post delete from both database and local state
    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("ఈ వార్తను శాశ్వతంగా తొలగించాలా?")) return;
        try {
            await deleteDoc(doc(db, 'news', postId));
            
            // Remove from main list
            setPosts(prev => prev.filter(p => p.id !== postId));
            
            // Remove from popup list if open
            setFilteredPopupPosts(prev => prev.filter(p => p.id !== postId));
            
            alert("వార్త విజయవంతంగా తొలగించబడింది.");
        } catch (e) {
            alert("తొలగించడం విఫలమైంది.");
        }
    };

    // Calculate dynamic stats
    const totalCount = posts.length;

    const categoryStats = useMemo(() => {
        const counts: { [key: string]: number } = {};
        posts.forEach(post => {
            if (post.categories && Array.isArray(post.categories)) {
                // Count all main categories
                post.categories.forEach(cat => {
                    counts[cat] = (counts[cat] || 0) + 1;
                });
            } else {
                counts['ఇతరాలు'] = (counts['ఇతరాలు'] || 0) + 1;
            }
        });
        
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [posts]);

    const reporterStats = useMemo(() => {
        const counts: { [id: string]: { name: string; count: number } } = {};
        posts.forEach(post => {
            const repId = post.reporter?.id || 'unknown';
            const repName = post.reporter?.name || 'ఇతరులు / స్క్రాపర్';
            if (!counts[repId]) {
                counts[repId] = { name: repName, count: 0 };
            }
            counts[repId].count += 1;
        });

        return Object.entries(counts)
            .map(([id, info]) => ({ id, name: info.name, count: info.count }))
            .sort((a, b) => b.count - a.count);
    }, [posts]);

    // Change date helpers
    const shiftDate = (days: number) => {
        const currentDate = new Date(selectedDate);
        currentDate.setDate(currentDate.getDate() + days);
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
    };

    // Open Modal with appropriate filtered news list
    const openPopup = (type: 'all' | 'category' | 'reporter', value: string | null = null, titleLabel: string) => {
        setActiveFilterType(type);
        setActiveFilterValue(value);
        setPopupTitle(titleLabel);

        let filtered: NewsPost[] = [];
        if (type === 'all') {
            filtered = [...posts];
        } else if (type === 'category' && value) {
            filtered = posts.filter(p => p.categories && p.categories.includes(value));
        } else if (type === 'reporter' && value) {
            filtered = posts.filter(p => (p.reporter?.id || 'unknown') === value);
        }

        setFilteredPopupPosts(filtered);
        setIsPopupOpen(true);
    };

    // Live update of filtered counts inside popup if active state changes
    useEffect(() => {
        if (isPopupOpen && activeFilterType) {
            let filtered: NewsPost[] = [];
            if (activeFilterType === 'all') {
                filtered = [...posts];
            } else if (activeFilterType === 'category' && activeFilterValue) {
                filtered = posts.filter(p => p.categories && p.categories.includes(activeFilterValue));
            } else if (activeFilterType === 'reporter' && activeFilterValue) {
                filtered = posts.filter(p => (p.reporter?.id || 'unknown') === activeFilterValue);
            }
            setFilteredPopupPosts(filtered);
            if (filtered.length === 0) {
                setIsPopupOpen(false);
            }
        }
    }, [posts, isPopupOpen, activeFilterType, activeFilterValue]);

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg font-mallanna text-black">
            {/* Header and Date selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                <h2 className="text-2xl font-ramabhadra flex items-center gap-2">
                    <span className="w-2 h-6 bg-red-600 rounded-full"></span>
                    డైలీ రిపోర్ట్ (Daily Report)
                </h2>
                
                <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <button 
                        onClick={() => shiftDate(-1)} 
                        className="p-2 hover:bg-gray-200 rounded-md transition-colors text-gray-700"
                        title="మునుపటి రోజు"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex items-center gap-2 text-black font-bold">
                        <Calendar size={18} className="text-red-600" />
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none text-base outline-none focus:ring-0 font-sans font-medium cursor-pointer"
                        />
                    </div>

                    <button 
                        onClick={() => shiftDate(1)} 
                        className="p-2 hover:bg-gray-200 rounded-md transition-colors text-gray-700"
                        title="తరువాతి రోజు"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-100 flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                    <p className="text-gray-500 font-bold">రిపోర్ట్ లోడ్ అవుతోంది...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Top Total Stats Widget */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-left">
                            <h3 className="text-xl font-bold text-gray-800">మొత్తం పబ్లిష్ అయిన వార్తలు</h3>
                            <p className="text-gray-500 text-sm mt-1">ఎంచుకున్న తేదీలో ప్రచురించిన మొత్తం కథనాలు</p>
                        </div>
                        <button 
                            onClick={() => openPopup('all', null, 'మొత్తం వార్తలు')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all text-2xl flex items-center gap-3 active:scale-95"
                        >
                            <BarChart2 size={24} />
                            <span>{totalCount}</span>
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Categories Box */}
                        <div className="border border-gray-100 rounded-xl shadow-sm overflow-hidden bg-white">
                            <div className="bg-gray-50 p-4 border-b border-gray-150 flex items-center gap-2">
                                <Folder className="text-red-600" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">ఏ కేటగిరి లో ఎన్ని వచ్చాయి ({categoryStats.length})</h3>
                            </div>
                            
                            {categoryStats.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    ఈ రోజు ఏ కేటగిరి లోనూ వార్తలు లేవు.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                    {categoryStats.map((stat, i) => (
                                        <div key={stat.name} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold font-sans">{i + 1}</span>
                                                <span className="font-bold text-gray-800">{stat.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => openPopup('category', stat.name, `కేటగిరి: ${stat.name}`)}
                                                className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 font-bold px-4 py-1.5 rounded-lg border border-gray-200 transition-colors font-sans text-sm"
                                            >
                                                {stat.count}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Reporters Box */}
                        <div className="border border-gray-100 rounded-xl shadow-sm overflow-hidden bg-white">
                            <div className="bg-gray-50 p-4 border-b border-gray-150 flex items-center gap-2">
                                <Users className="text-red-600" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">ఏ రిపోర్టర్ నుంచి ఎన్ని వచ్చాయి ({reporterStats.length})</h3>
                            </div>
                            
                            {reporterStats.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    ఈ రోజు ఏ రిపోర్టర్ నుండి వార్తలు రాలేదు.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                    {reporterStats.map((stat, i) => (
                                        <div key={stat.id} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold font-sans">{i + 1}</span>
                                                <span className="font-bold text-gray-800">{stat.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => openPopup('reporter', stat.id, `రిపోర్టర్: ${stat.name}`)}
                                                className="bg-gray-150 hover:bg-red-50 hover:text-red-600 text-gray-700 font-bold px-4 py-1.5 rounded-lg border border-gray-200 transition-colors font-sans text-sm"
                                            >
                                                {stat.count}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Popup Dialog showing news list */}
            {isPopupOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                                <h3 className="text-xl font-bold text-gray-900 font-ramabhadra">{popupTitle} - వార్తలు</h3>
                                <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full font-sans ml-2">
                                    {filteredPopupPosts.length}
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsPopupOpen(false)}
                                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content - List of posts with Edit and Delete options */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {filteredPopupPosts.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 font-bold">
                                    వార్తలు ఏవీ లేవు.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredPopupPosts.map((post) => (
                                        <div 
                                            key={post.id} 
                                            className="border border-gray-150 rounded-xl p-4 hover:border-red-200 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-xs"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-sans text-gray-400 font-semibold">
                                                        📅 {(() => {
                                                            try {
                                                                const d = new Date(post.timestamp);
                                                                return d.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                                            } catch {
                                                                return '';
                                                            }
                                                        })()}
                                                    </span>
                                                    {post.location && (
                                                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md font-bold">
                                                            📌 {post.location}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-lg font-bold text-black leading-snug line-clamp-2">
                                                    {post.headline.telugu}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    ✍️ రిపోర్టర్: {post.reporter?.name || 'ఇతరులు / స్క్రాపర్'}
                                                </p>
                                            </div>

                                            {/* Action Buttons: Edit and Delete */}
                                            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                                <button 
                                                    onClick={() => {
                                                        setIsPopupOpen(false);
                                                        onEditPost(post);
                                                    }}
                                                    className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-bold transition-colors border border-blue-100"
                                                >
                                                    <Edit2 size={16} />
                                                    <span>ఎడిట్</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleDeletePost(post.id)}
                                                    className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-bold transition-colors border border-red-100"
                                                >
                                                    <Trash2 size={16} />
                                                    <span>తొలగించు</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-150 bg-gray-50 flex justify-end rounded-b-2xl">
                            <button 
                                onClick={() => setIsPopupOpen(false)}
                                className="bg-gray-200 text-gray-800 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                            >
                                మూసివేయి (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportPage;
