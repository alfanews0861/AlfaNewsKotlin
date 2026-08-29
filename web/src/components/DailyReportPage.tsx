import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NewsPost, User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { 
    Calendar, Trash2, Edit2, X, ChevronLeft, ChevronRight, BarChart2, 
    Users, Folder, Phone, MessageSquare, AlertTriangle, CheckCircle, 
    Clock, Search, ArrowUpDown, Filter, Sparkles, Send, ExternalLink, ShieldAlert,
    UserMinus, UserX
} from 'lucide-react';

const { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, Timestamp, where, limit } = _firestore as any;

const getMsFromTimestamp = (ts: any): number => {
    if (!ts) return Date.now();
    if (typeof ts.toMillis === 'function') {
        return ts.toMillis();
    }
    if (typeof ts.toDate === 'function') {
        return ts.toDate().getTime();
    }
    if (typeof ts === 'number') {
        return ts > 1e11 ? ts : ts * 1000;
    }
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return isNaN(parsed) ? Date.now() : parsed;
    }
    if (ts.seconds !== undefined) {
        return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    }
    if (ts._seconds !== undefined) {
        return ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1000000);
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

const formatReadableDate = (timestampMs: number | null | undefined): string => {
    if (!timestampMs) return 'తేదీ లేదు';
    try {
        const d = new Date(timestampMs);
        return d.toLocaleDateString('te-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
    } catch {
        return 'తేదీ లేదు';
    }
};

// Known machine / scraper reporter IDs and keywords to always exclude from human reporter stats
const MACHINE_SCRAPER_IDS = new Set([
    'rep1', 'rep2', 'rep3', 'rep4', 'rep5', 'rep6', 'rep7', 'rep8', 'rep9', 'rep10',
    'rep11', 'rep12', 'rep13', 'rep14', 'rep15', 'rep16', 'rep17', 'rep18', 'rep19', 'rep20',
    'bot_affiliate', 'bot_cartoonist', 'system', 'scraper', 'unknown', 'bot', 'auto_bot',
    'rss_scraper', 'gnews_bot', 'facebook_scraper'
]);

export interface DistrictReporterStats {
    id: string;
    name: string;
    phone: string;
    role: UserRole | string;
    district: string;
    mandal?: string;
    photoUrl?: string;
    joinedAt: number;
    isNewlyJoined: boolean; // joined <= 14 days ago
    daysSinceJoined: number;
    lastPostTimestamp: number | null;
    daysInactive: number;
    todayNewsCount: number;
    lastWeekNewsCount: number;
    totalNewsCount: number;
    warningLevel: number;
    inProbation: boolean;
    deadlineStatus: 'ACTIVE' | 'NORMAL' | 'ATTENTION' | 'APPROACHING_DEADLINE' | 'CRITICAL_DEADLINE' | 'NEW_NO_POSTS' | 'INACTIVE_ZERO';
}

type PerformanceSortField = 'joinedAt' | 'lastPostTimestamp' | 'district' | 'name' | 'totalNewsCount' | 'lastWeekNewsCount' | 'todayNewsCount' | 'daysInactive';

interface DailyReportPageProps {
  onEditPost: (post: NewsPost) => void;
  currentUser?: User;
}

const DailyReportPage: React.FC<DailyReportPageProps> = ({ onEditPost, currentUser }) => {
    // Active Main Tab
    const [activeTab, setActiveTab] = useState<'daily' | 'performance'>('daily');

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
    
    // Registered Human District Reporters Map & List
    const [reportersMap, setReportersMap] = useState<Map<string, User>>(new Map());
    const [allReportersStats, setAllReportersStats] = useState<DistrictReporterStats[]>([]);
    const [loadingReporters, setLoadingReporters] = useState(true);

    // Performance Tab Filters & Sorting
    const [performanceSearch, setPerformanceSearch] = useState('');
    const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'DEADLINE' | 'CRITICAL' | 'ACTIVE_TODAY' | 'ACTIVE_WEEK' | 'ZERO_POSTS'>('ALL');
    const [sortField, setSortField] = useState<PerformanceSortField>('totalNewsCount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Popup state for news list
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupTitle, setPopupTitle] = useState('');
    const [filteredPopupPosts, setFilteredPopupPosts] = useState<NewsPost[]>([]);
    const [activeFilterType, setActiveFilterType] = useState<'all' | 'category' | 'reporter' | 'reporter_all_time' | null>(null);
    const [activeFilterValue, setActiveFilterValue] = useState<string | null>(null);
    const [loadingPopupPosts, setLoadingPopupPosts] = useState(false);

    // 1. Fetch Registered District Reporters from Firestore `users`
    const fetchRegisteredReporters = useCallback(async () => {
        setLoadingReporters(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('role', 'in', [
                    UserRole.REPORTER, 
                    UserRole.STAFF_REPORTER, 
                    UserRole.REGIONAL_INCHARGE, 
                    'REPORTER', 
                    'reporter', 
                    'STAFF_REPORTER', 
                    'REGIONAL_INCHARGE',
                    'ADMIN',
                    'admin'
                ])
            );

            const snap = await getDocs(q);
            const rMap = new Map<string, User>();
            const reportersList: User[] = [];

            snap.docs.forEach((docSnap: any) => {
                const uData = { id: docSnap.id, ...docSnap.data() } as User;
                rMap.set(docSnap.id, uData);
                if (uData.name) {
                    rMap.set(`name:${uData.name.trim().toLowerCase()}`, uData);
                }
                reportersList.push(uData);
            });

            setReportersMap(rMap);

            const nowMs = Date.now();
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const startOfTodayMs = startOfToday.getTime();

            const startOfLastWeek = new Date();
            startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
            startOfLastWeek.setHours(0, 0, 0, 0);
            const startOfLastWeekMs = startOfLastWeek.getTime();

            const statsList: DistrictReporterStats[] = await Promise.all(
                reportersList.map(async (u) => {
                    let totalCount = 0;
                    let todayCount = 0;
                    let lastWeekCount = 0;
                    let latestPostMs: number | null = null;
                    let earliestPostMs: number | null = null;

                    try {
                        const newsCollection = collection(db, 'news');
                        const newsQ = query(newsCollection, where('reporter.id', '==', u.id));
                        const newsSnap = await getDocs(newsQ);
                        totalCount = newsSnap.size;

                        newsSnap.forEach((nDoc: any) => {
                            const nData = nDoc.data();
                            const postTs = getMsFromTimestamp(nData.timestamp || nData.createdAt);
                            
                            if (!latestPostMs || postTs > latestPostMs) {
                                latestPostMs = postTs;
                            }
                            if (!earliestPostMs || postTs < earliestPostMs) {
                                earliestPostMs = postTs;
                            }

                            if (postTs >= startOfTodayMs) {
                                todayCount++;
                            }
                            if (postTs >= startOfLastWeekMs && postTs < startOfTodayMs) {
                                lastWeekCount++;
                            }
                        });
                    } catch (e) {
                        console.warn(`Could not query news for reporter ${u.id}:`, e);
                    }

                    if (!latestPostMs && (u as any).lastPostTimestamp) {
                        latestPostMs = getMsFromTimestamp((u as any).lastPostTimestamp);
                    }

                    // Compute true join timestamp
                    const rawCreated = u.createdAt ? getMsFromTimestamp(u.createdAt) : null;
                    const rawPromoted = (u as any).promotedAt ? getMsFromTimestamp((u as any).promotedAt) : null;
                    const rawJoined = (u as any).joinedAt ? getMsFromTimestamp((u as any).joinedAt) : null;
                    const rawTimestamp = (u as any).timestamp ? getMsFromTimestamp((u as any).timestamp) : null;

                    const validCandidateDates = [rawCreated, rawPromoted, rawJoined, rawTimestamp, earliestPostMs]
                        .filter((t): t is number => typeof t === 'number' && t > 0 && t <= nowMs);

                    let joinedTs: number;
                    if (validCandidateDates.length > 0) {
                        // Earliest known date is the true start date
                        joinedTs = Math.min(...validCandidateDates);
                    } else {
                        joinedTs = nowMs;
                    }

                    const daysSinceJoined = Math.max(0, Math.floor((nowMs - joinedTs) / (1000 * 60 * 60 * 24)));

                    // Senior reporter rule: If they have > 5 lifetime news or earliest post was > 21 days ago, they are NOT newly joined
                    const isSenior = totalCount > 5 || (earliestPostMs !== null && (nowMs - earliestPostMs) > 21 * 24 * 60 * 60 * 1000);
                    const isNewlyJoined = !isSenior && (daysSinceJoined <= 21);

                    let daysInactive = 0;
                    if (latestPostMs) {
                        daysInactive = Math.max(0, Math.floor((nowMs - latestPostMs) / (1000 * 60 * 60 * 24)));
                    } else {
                        daysInactive = daysSinceJoined;
                    }

                    let deadlineStatus: DistrictReporterStats['deadlineStatus'] = 'NORMAL';
                    const warningLevel = Number((u as any).warningLevel || 0);
                    const inProbation = (u as any).inProbation === true;

                    if (totalCount === 0 && isNewlyJoined) {
                        deadlineStatus = 'NEW_NO_POSTS';
                    } else if (totalCount === 0 && !isNewlyJoined) {
                        deadlineStatus = 'INACTIVE_ZERO';
                    } else if (daysInactive <= 1) {
                        deadlineStatus = 'ACTIVE';
                    } else if (daysInactive <= 2) {
                        deadlineStatus = 'NORMAL';
                    } else if (daysInactive >= 3 && daysInactive < 5) {
                        deadlineStatus = 'ATTENTION';
                    } else if (daysInactive >= 5 && daysInactive < 7) {
                        deadlineStatus = 'APPROACHING_DEADLINE';
                    } else if (daysInactive >= 7) {
                        deadlineStatus = 'CRITICAL_DEADLINE';
                    }

                    return {
                        id: u.id,
                        name: u.name || 'పేరు లేదు',
                        phone: u.phone || (u as any).phoneNumber || '',
                        role: u.role || UserRole.REPORTER,
                        district: u.district || (u as any).targetDistrict || 'జిల్లా లేదు',
                        mandal: (u as any).assignedMandal || (u as any).mandal || '',
                        photoUrl: u.photoUrl,
                        joinedAt: joinedTs,
                        isNewlyJoined,
                        daysSinceJoined,
                        lastPostTimestamp: latestPostMs,
                        daysInactive,
                        todayNewsCount: todayCount,
                        lastWeekNewsCount: lastWeekCount,
                        totalNewsCount: totalCount,
                        warningLevel,
                        inProbation,
                        deadlineStatus
                    };
                })
            );

            setAllReportersStats(statsList);
        } catch (e: any) {
            console.error('Error fetching registered reporters:', e);
        } finally {
            setLoadingReporters(false);
        }
    }, []);

    useEffect(() => {
        fetchRegisteredReporters();
    }, [fetchRegisteredReporters]);

    // 2. Fetch Posts for Selected Day
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

            // Try 1: Timestamp range query
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
                    console.warn("Timestamp range query fallback:", e);
                }
            }

            // Try 2: If 0 posts, try number range query
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
                    console.warn("Number range query fallback:", e);
                }
            }

            // Try 3: Supplement with latest 1000 items in-memory filter
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
            setPosts(prev => prev.filter(p => p.id !== postId));
            setFilteredPopupPosts(prev => prev.filter(p => p.id !== postId));
            alert("వార్త విజయవంతంగా తొలగించబడింది.");
            fetchRegisteredReporters();
        } catch (e) {
            alert("తొలగించడం విఫలమైంది.");
        }
    };

    // Handle Reporter Downgrade to Subscriber
    const handleDowngradeReporter = async (reporterId: string, reporterName: string) => {
        if (!window.confirm(`మీరు ఖచ్చితంగా "${reporterName}" గారిని రిపోర్టర్ హోదా నుండి తొలగించి సాధారణ సబ్‌స్క్రైబర్‌గా మార్చాలనుకుంటున్నారా?`)) {
            return;
        }
        try {
            await updateDoc(doc(db, 'users', reporterId), {
                role: UserRole.SUBSCRIBER,
                warningLevel: 0,
                inProbation: false,
                downgradedAt: Date.now(),
                downgradedBy: currentUser?.name || currentUser?.id || 'ADMIN',
                downgradedReason: 'MANUAL_ADMIN_ACTION'
            });

            try {
                const appsSnap = await getDocs(query(collection(db, 'reporter_applications'), where('userId', '==', reporterId)));
                for (const appDoc of appsSnap.docs) {
                    await updateDoc(appDoc.ref, { status: 'SUSPENDED', suspendedAt: Date.now(), reason: 'ADMIN_DOWNGRADED' });
                }
            } catch {}

            alert(`"${reporterName}" గారిని విజయవంతంగా సబ్‌స్క్రైబర్‌గా మార్చడం జరిగింది.`);
            setAllReportersStats(prev => prev.filter(r => r.id !== reporterId));
        } catch (e: any) {
            alert("హోదా మార్పు విఫలమైంది: " + e.message);
        }
    };

    // Handle Reporter Permanent Delete
    const handleDeleteReporter = async (reporterId: string, reporterName: string) => {
        if (!window.confirm(`⚠️ హెచ్చరిక: మీరు ఖచ్చితంగా "${reporterName}" గారి ఖాతాను శాశ్వతంగా తొలగించాలనుకుంటున్నారా? (ఈ చర్యను వెనక్కి తీసుకోలేరు)`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'users', reporterId));
            try {
                const appsSnap = await getDocs(query(collection(db, 'reporter_applications'), where('userId', '==', reporterId)));
                for (const appDoc of appsSnap.docs) {
                    await deleteDoc(appDoc.ref);
                }
            } catch {}

            alert(`"${reporterName}" ఖాతా విజయవంతంగా తొలగించబడింది.`);
            setAllReportersStats(prev => prev.filter(r => r.id !== reporterId));
        } catch (e: any) {
            alert("ఖాతా తొలగింపు విఫలమైంది: " + e.message);
        }
    };

    const totalCount = posts.length;

    // Helper to check if a post is written by a real human district reporter
    const isDistrictReporterPost = useCallback((post: NewsPost): boolean => {
        const repId = (post.reporter?.id || '').trim().toLowerCase();
        if (!repId || MACHINE_SCRAPER_IDS.has(repId)) {
            return false;
        }

        if (reportersMap.has(post.reporter?.id)) {
            return true;
        }

        if (post.isReporter === true && !repId.startsWith('rep') && !repId.startsWith('bot_')) {
            return true;
        }

        const repName = (post.reporter?.name || '').trim().toLowerCase();
        if (repName && reportersMap.has(`name:${repName}`)) {
            return true;
        }

        return false;
    }, [reportersMap]);

    const districtReporterPostsCount = useMemo(() => {
        return posts.filter(isDistrictReporterPost).length;
    }, [posts, isDistrictReporterPost]);

    const scraperPostsCount = totalCount - districtReporterPostsCount;

    // Categories Distribution
    const categoryStats = useMemo(() => {
        const counts: { [key: string]: number } = {};
        posts.forEach(post => {
            if (post.categories && Array.isArray(post.categories)) {
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

    // ONLY District Reporters Stats for "ఏ రిపోర్టర్ నుంచి ఎన్ని వచ్చాయి" (Excluding scrapers/bots completely!)
    const districtReporterStats = useMemo(() => {
        const counts: { 
            [id: string]: { 
                id: string;
                name: string; 
                phone: string;
                district: string;
                mandal?: string;
                role?: string;
                count: number;
                isNew?: boolean;
            } 
        } = {};

        posts.forEach(post => {
            if (!isDistrictReporterPost(post)) {
                return; // Exclude scraper/machine posts!
            }

            const repId = post.reporter?.id;
            if (!repId) return;

            const repUser = reportersMap.get(repId) || reportersMap.get(`name:${(post.reporter?.name || '').trim().toLowerCase()}`);
            const repName = repUser?.name || post.reporter?.name || 'జిల్లా రిపోర్టర్';
            const repPhone = repUser?.phone || (repUser as any)?.phoneNumber || '';
            const repDist = repUser?.district || post.district || post.location || 'జిల్లా';
            const repMandal = (repUser as any)?.assignedMandal || (repUser as any)?.mandal || '';
            const repRole = repUser?.role || 'REPORTER';
            
            const repStats = allReportersStats.find(r => r.id === repId);
            const isNew = repStats ? repStats.isNewlyJoined : false;

            if (!counts[repId]) {
                counts[repId] = {
                    id: repId,
                    name: repName,
                    phone: repPhone,
                    district: repDist,
                    mandal: repMandal,
                    role: repRole,
                    count: 0,
                    isNew
                };
            }
            counts[repId].count += 1;
        });

        return Object.values(counts).sort((a, b) => b.count - a.count);
    }, [posts, isDistrictReporterPost, reportersMap]);

    // Date Shift Helpers
    const shiftDate = (days: number) => {
        const currentDate = new Date(selectedDate);
        currentDate.setDate(currentDate.getDate() + days);
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${month}-${day}`);
    };

    // Open Modal with filtered news list
    const openPopup = async (type: 'all' | 'category' | 'reporter' | 'reporter_all_time', value: string | null = null, titleLabel: string) => {
        setActiveFilterType(type);
        setActiveFilterValue(value);
        setPopupTitle(titleLabel);
        setIsPopupOpen(true);

        if (type === 'all') {
            setFilteredPopupPosts([...posts]);
        } else if (type === 'category' && value) {
            setFilteredPopupPosts(posts.filter(p => p.categories && p.categories.includes(value)));
        } else if (type === 'reporter' && value) {
            setFilteredPopupPosts(posts.filter(p => (p.reporter?.id || '') === value));
        } else if (type === 'reporter_all_time' && value) {
            setLoadingPopupPosts(true);
            try {
                const newsCollection = collection(db, 'news');
                const q = query(
                    newsCollection,
                    where('reporter.id', '==', value),
                    orderBy('timestamp', 'desc'),
                    limit(100)
                );
                const querySnapshot = await getDocs(q);
                const fetched = querySnapshot.docs.map((docSnap: any) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    timestamp: getMsFromTimestamp(docSnap.data().timestamp)
                } as NewsPost));
                setFilteredPopupPosts(fetched);
            } catch (e) {
                console.warn('Fallback query for reporter all-time news without composite index:', e);
                const newsCollectionFallback = collection(db, 'news');
                const qFallback = query(newsCollectionFallback, where('reporter.id', '==', value), limit(100));
                const snap = await getDocs(qFallback);
                const fetched = snap.docs.map((docSnap: any) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    timestamp: getMsFromTimestamp(docSnap.data().timestamp)
                } as NewsPost));
                fetched.sort((a: any, b: any) => b.timestamp - a.timestamp);
                setFilteredPopupPosts(fetched);
            } finally {
                setLoadingPopupPosts(false);
            }
        }
    };

    // PERFORMANCE TAB: Filtered & Sorted Reporters List
    const filteredPerformanceReporters = useMemo(() => {
        let list = [...allReportersStats];

        if (performanceSearch.trim()) {
            const queryLower = performanceSearch.trim().toLowerCase();
            list = list.filter(r => 
                (r.name || '').toLowerCase().includes(queryLower) ||
                (r.phone || '').toLowerCase().includes(queryLower) ||
                (r.district || '').toLowerCase().includes(queryLower) ||
                (r.mandal || '').toLowerCase().includes(queryLower)
            );
        }

        if (selectedDistrictFilter !== 'ALL') {
            list = list.filter(r => (r.district || '').trim() === selectedDistrictFilter.trim());
        }

        if (statusFilter === 'NEW') {
            list = list.filter(r => r.isNewlyJoined);
        } else if (statusFilter === 'DEADLINE') {
            list = list.filter(r => r.deadlineStatus === 'ATTENTION' || r.deadlineStatus === 'APPROACHING_DEADLINE' || r.deadlineStatus === 'CRITICAL_DEADLINE');
        } else if (statusFilter === 'CRITICAL') {
            list = list.filter(r => r.deadlineStatus === 'CRITICAL_DEADLINE' || r.warningLevel >= 3 || r.inProbation);
        } else if (statusFilter === 'ACTIVE_TODAY') {
            list = list.filter(r => r.todayNewsCount > 0);
        } else if (statusFilter === 'ACTIVE_WEEK') {
            list = list.filter(r => r.lastWeekNewsCount > 0 || r.todayNewsCount > 0);
        } else if (statusFilter === 'ZERO_POSTS') {
            list = list.filter(r => r.totalNewsCount === 0);
        }

        list.sort((a, b) => {
            let aVal: any = a[sortField];
            let bVal: any = b[sortField];

            if (sortField === 'name' || sortField === 'district') {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            aVal = Number(aVal || 0);
            bVal = Number(bVal || 0);

            if (sortDirection === 'asc') {
                return aVal - bVal;
            } else {
                return bVal - aVal;
            }
        });

        return list;
    }, [allReportersStats, performanceSearch, selectedDistrictFilter, statusFilter, sortField, sortDirection]);

    const summaryMetrics = useMemo(() => {
        const total = allReportersStats.length;
        const newlyJoined = allReportersStats.filter(r => r.isNewlyJoined).length;
        const activeToday = allReportersStats.filter(r => r.todayNewsCount > 0).length;
        const activeThisWeek = allReportersStats.filter(r => r.lastWeekNewsCount > 0 || r.todayNewsCount > 0).length;
        const inDeadline = allReportersStats.filter(r => r.deadlineStatus === 'ATTENTION' || r.deadlineStatus === 'APPROACHING_DEADLINE' || r.deadlineStatus === 'CRITICAL_DEADLINE').length;
        const criticalCount = allReportersStats.filter(r => r.deadlineStatus === 'CRITICAL_DEADLINE' || r.warningLevel >= 3).length;
        const zeroPosts = allReportersStats.filter(r => r.totalNewsCount === 0).length;

        return {
            total,
            newlyJoined,
            activeToday,
            activeThisWeek,
            inDeadline,
            criticalCount,
            zeroPosts
        };
    }, [allReportersStats]);

    const getCleanPhone = (phone: string): string => {
        return phone.replace(/[^0-9]/g, '');
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl font-mallanna text-black border border-gray-100">
            {/* Top Header with Navigation Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-200 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-ramabhadra flex items-center gap-3 text-gray-900">
                        <span className="w-2.5 h-8 bg-gradient-to-b from-red-600 to-rose-700 rounded-full"></span>
                        రిపోర్టింగ్ & పనితీరు డ్యాష్‌బోర్డ్
                    </h2>
                    <p className="text-gray-500 text-sm font-semibold mt-0.5">
                        జిల్లా గ్రౌండ్ రిపోర్టర్ల డైలీ నివేదిక & పనితీరు విశ్లేషణ
                    </p>
                </div>
                
                {/* Main Tabs: Daily News vs Reporter Performance */}
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 gap-1 w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'daily'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <Calendar size={18} />
                        <span>📅 రోజువారీ నివేదిక (Daily)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'performance'
                                ? 'bg-teal-700 text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <BarChart2 size={18} />
                        <span>📊 రిపోర్టర్ల పనితీరు (Performance)</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 border border-red-200 flex items-center gap-2 font-bold">
                    <AlertTriangle size={20} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 1: DAILY REPORT VIEW */}
            {/* ========================================================================= */}
            {activeTab === 'daily' && (
                <div className="space-y-6">
                    {/* Date Selector Banner */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-200 gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} className="text-red-600" />
                            <span className="font-bold text-gray-800 text-base">తేదీ ఎంచుకోండి:</span>
                        </div>

                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-300 shadow-xs">
                            <button 
                                onClick={() => shiftDate(-1)} 
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                                title="మునుపటి రోజు"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            
                            <input 
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-base outline-none font-sans font-bold text-gray-900 cursor-pointer"
                            />

                            <button 
                                onClick={() => shiftDate(1)} 
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                                title="తరువాతి రోజు"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-t-transparent"></div>
                            <p className="text-gray-500 font-bold">రోజువారీ రిపోర్ట్ లోడ్ అవుతోంది...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Metrics Bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 flex justify-between items-center shadow-xs">
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">మొత్తం పబ్లిష్ అయిన వార్తలు</p>
                                        <h4 className="text-2xl font-black text-gray-900 mt-1 font-sans">{totalCount}</h4>
                                    </div>
                                    <button 
                                        onClick={() => openPopup('all', null, 'మొత్తం వార్తలు')}
                                        className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl shadow-md transition-transform active:scale-95"
                                        title="మొత్తం వార్తలు చూడండి"
                                    >
                                        <BarChart2 size={22} />
                                    </button>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex justify-between items-center shadow-xs">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">✍️ జిల్లా రిపోర్టర్ల వార్తలు</p>
                                        <h4 className="text-2xl font-black text-emerald-950 mt-1 font-sans">{districtReporterPostsCount}</h4>
                                    </div>
                                    <span className="bg-emerald-200 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full font-sans">
                                        గ్రౌండ్ రిపోర్టర్లు
                                    </span>
                                </div>

                                <div className="bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-200 rounded-2xl p-5 flex justify-between items-center shadow-xs">
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">🤖 ఆటోమేషన్ / స్క్రాపింగ్</p>
                                        <h4 className="text-2xl font-black text-gray-700 mt-1 font-sans">{scraperPostsCount}</h4>
                                    </div>
                                    <span className="bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-full font-sans">
                                        బాట్స్ / వెబ్
                                    </span>
                                </div>
                            </div>

                            {/* Two Column Grid: Categories vs District Reporters */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* CATEGORIES BOX */}
                                <div className="border border-gray-200 rounded-2xl shadow-xs overflow-hidden bg-white">
                                    <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Folder className="text-red-600" size={20} />
                                            <h3 className="text-lg font-bold text-gray-900">కేటగిరి వారీగా వార్తలు</h3>
                                        </div>
                                        <span className="text-xs bg-gray-200 text-gray-800 font-bold px-2.5 py-1 rounded-full font-sans">
                                            {categoryStats.length} కేటగిరీలు
                                        </span>
                                    </div>
                                    
                                    {categoryStats.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 font-bold">
                                            ఈ తేదీన ఏ కేటగిరిలోనూ వార్తలు లేవు.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto custom-scrollbar">
                                            {categoryStats.map((stat, i) => (
                                                <div key={stat.name} className="flex justify-between items-center p-3.5 hover:bg-gray-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold font-sans">
                                                            {i + 1}
                                                        </span>
                                                        <span className="font-bold text-gray-900">{stat.name}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => openPopup('category', stat.name, `కేటగిరి: ${stat.name}`)}
                                                        className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-800 font-bold px-3.5 py-1 rounded-lg border border-gray-200 transition-colors font-sans text-sm"
                                                    >
                                                        {stat.count} వార్తలు
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* DISTRICT REPORTERS BOX (Human District Reporters Only - Scrapers completely excluded!) */}
                                <div className="border border-teal-200 rounded-2xl shadow-xs overflow-hidden bg-white">
                                    <div className="bg-teal-50/70 p-4 border-b border-teal-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Users className="text-teal-700" size={20} />
                                            <div>
                                                <h3 className="text-lg font-bold text-teal-950">జిల్లా రిపోర్టర్ల వార్తలు</h3>
                                                <p className="text-[11px] text-teal-700 font-semibold">స్క్రాపింగ్ బాట్లు మినహాయించబడ్డాయి</p>
                                            </div>
                                        </div>
                                        <span className="text-xs bg-teal-200 text-teal-900 font-bold px-2.5 py-1 rounded-full font-sans">
                                            {districtReporterStats.length} రిపోర్టర్లు
                                        </span>
                                    </div>
                                    
                                    {districtReporterStats.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 font-bold">
                                            ఈ తేదీన ఏ జిల్లా రిపోర్టర్ నుండి వార్తలు రాలేదు.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto custom-scrollbar">
                                            {districtReporterStats.map((rep, i) => (
                                                <div key={rep.id} className="p-3.5 hover:bg-teal-50/40 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <div className="flex items-start gap-3">
                                                        <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold font-sans mt-0.5 shrink-0">
                                                            {i + 1}
                                                        </span>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-gray-900 text-base">{rep.name}</span>
                                                                {rep.isNew && (
                                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                                        🆕 కొత్త రిపోర్టర్
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5 flex-wrap">
                                                                <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded">
                                                                    📍 {rep.district} {rep.mandal ? `• ${rep.mandal}` : ''}
                                                                </span>

                                                                {rep.phone && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono font-bold text-gray-900">📞 {rep.phone}</span>
                                                                        <a 
                                                                            href={`tel:${rep.phone}`} 
                                                                            className="text-teal-700 hover:text-teal-900 p-1 hover:bg-teal-100 rounded" 
                                                                            title="కాల్ చేయండి"
                                                                        >
                                                                            <Phone size={13} />
                                                                        </a>
                                                                        <a 
                                                                            href={`https://wa.me/91${getCleanPhone(rep.phone)}?text=${encodeURIComponent(`నమస్కారం ${rep.name} గారు, AlfaNews డెస్క్ నుండి...`)}`}
                                                                            target="_blank" 
                                                                            rel="noreferrer"
                                                                            className="text-green-600 hover:text-green-800 p-1 hover:bg-green-100 rounded" 
                                                                            title="వాట్సాప్ మెసేజ్"
                                                                        >
                                                                            <MessageSquare size={13} />
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={() => openPopup('reporter', rep.id, `రిపోర్టర్: ${rep.name}`)}
                                                        className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-1.5 rounded-xl shadow-xs transition-colors font-sans text-sm shrink-0 self-end sm:self-center"
                                                    >
                                                        {rep.count} వార్తలు
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: COMPREHENSIVE REPORTER PERFORMANCE & DEADLINE ANALYTICS */}
            {/* ========================================================================= */}
            {activeTab === 'performance' && (
                <div className="space-y-6">
                    {/* Summary Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-gray-500">మొత్తం రిపోర్టర్లు</p>
                            <h4 className="text-2xl font-black text-gray-900 font-sans mt-1">{summaryMetrics.total}</h4>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-amber-800">🆕 కొత్తగా చేరినవారు</p>
                            <h4 className="text-2xl font-black text-amber-950 font-sans mt-1">{summaryMetrics.newlyJoined}</h4>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-emerald-800">⚡ ఈ రోజు యాక్టివ్</p>
                            <h4 className="text-2xl font-black text-emerald-950 font-sans mt-1">{summaryMetrics.activeToday}</h4>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-blue-800">📈 గత వారం యాక్టివ్</p>
                            <h4 className="text-2xl font-black text-blue-950 font-sans mt-1">{summaryMetrics.activeThisWeek}</h4>
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-orange-800">⚠️ డెడ్‌లైన్ సమీపిస్తోంది</p>
                            <h4 className="text-2xl font-black text-orange-950 font-sans mt-1">{summaryMetrics.inDeadline}</h4>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-red-800">🔴 హోదా రద్దు ప్రమాదం</p>
                            <h4 className="text-2xl font-black text-red-950 font-sans mt-1">{summaryMetrics.criticalCount}</h4>
                        </div>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                        {/* Status Filter Chips */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'ALL' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                మొత్తం ({summaryMetrics.total})
                            </button>
                            <button
                                onClick={() => setStatusFilter('NEW')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'NEW' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                                }`}
                            >
                                🆕 కొత్తగా చేరినవారు ({summaryMetrics.newlyJoined})
                            </button>
                            <button
                                onClick={() => setStatusFilter('DEADLINE')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'DEADLINE' ? 'bg-orange-600 text-white shadow-sm' : 'bg-orange-50 text-orange-900 hover:bg-orange-100'
                                }`}
                            >
                                ⚠️ డెడ్‌లైన్ సమీపిస్తున్నవారు ({summaryMetrics.inDeadline})
                            </button>
                            <button
                                onClick={() => setStatusFilter('CRITICAL')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'CRITICAL' ? 'bg-red-700 text-white shadow-sm' : 'bg-red-50 text-red-900 hover:bg-red-100'
                                }`}
                            >
                                🔴 హోదా రద్దు ప్రమాదం ({summaryMetrics.criticalCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('ACTIVE_TODAY')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'ACTIVE_TODAY' ? 'bg-emerald-700 text-white shadow-sm' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                }`}
                            >
                                ⚡ ఈ రోజు రాసినవారు ({summaryMetrics.activeToday})
                            </button>
                            <button
                                onClick={() => setStatusFilter('ACTIVE_WEEK')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'ACTIVE_WEEK' ? 'bg-blue-700 text-white shadow-sm' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                                }`}
                            >
                                📈 గత వారం రాసినవారు ({summaryMetrics.activeThisWeek})
                            </button>
                            <button
                                onClick={() => setStatusFilter('ZERO_POSTS')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === 'ZERO_POSTS' ? 'bg-gray-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                🛑 సున్నా వార్తలు ({summaryMetrics.zeroPosts})
                            </button>
                        </div>

                        {/* Search, District Filter, and Sorting Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="పేరు, ఫోన్, జిల్లా, మండలం..."
                                    value={performanceSearch}
                                    onChange={(e) => setPerformanceSearch(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>

                            {/* District Dropdown */}
                            <div>
                                <select
                                    value={selectedDistrictFilter}
                                    onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                                >
                                    <option value="ALL">అన్ని జిల్లాలు (All Districts)</option>
                                    <optgroup label="తెలంగాణ (TS)">
                                        {TS_DISTRICTS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="ఆంధ్రప్రదేశ్ (AP)">
                                        {AP_DISTRICTS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Sort By Field */}
                            <div>
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as PerformanceSortField)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold text-gray-800"
                                >
                                    <option value="totalNewsCount">📊 మొత్తం వార్తల వారీగా</option>
                                    <option value="todayNewsCount">⚡ ఈ రోజు వార్తల వారీగా</option>
                                    <option value="lastWeekNewsCount">🗓️ గత వారం వార్తల వారీగా</option>
                                    <option value="daysInactive">⚠️ డెడ్‌లైన్ / ఇనాక్టివిటీ వారీగా</option>
                                    <option value="joinedAt">📅 చేరిన తేదీ వారీగా (Join Date)</option>
                                    <option value="lastPostTimestamp">🕒 చివరి వార్త తేదీ వారీగా</option>
                                    <option value="district">📍 జిల్లా వారీగా</option>
                                    <option value="name">👤 పేరు వారీగా</option>
                                </select>
                            </div>

                            {/* Sort Direction Toggle */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-gray-200"
                                >
                                    <ArrowUpDown size={16} />
                                    <span>{sortDirection === 'desc' ? 'ఎక్కువ నుండి తక్కువ (High to Low)' : 'తక్కువ నుండి ఎక్కువ (Low to High)'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Reporters Table / Cards List */}
                    {loadingReporters ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent"></div>
                            <p className="text-gray-500 font-bold">రిపోర్టర్ల పనితీరు విశ్లేషణ లోడ్ అవుతోంది...</p>
                        </div>
                    ) : filteredPerformanceReporters.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border text-center text-gray-400 font-bold">
                            రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Desktop Table View */}
                            <div className="overflow-x-auto w-full hidden md:block">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 text-left">రిపోర్టర్ & వివరాలు</th>
                                            <th className="px-4 py-3 text-left">ఫోన్ & సంప్రదింపు</th>
                                            <th className="px-4 py-3 text-left">ప్రాంతం (జిల్లా/మండలం)</th>
                                            <th className="px-4 py-3 text-center">ఈ రోజు</th>
                                            <th className="px-4 py-3 text-center">గత వారం</th>
                                            <th className="px-4 py-3 text-center">మొత్తం వార్తలు</th>
                                            <th className="px-4 py-3 text-left">స్టేటస్ / డెడ్‌లైన్ హెచ్చరిక</th>
                                            <th className="px-4 py-3 text-right">చర్యలు</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-sm">
                                        {filteredPerformanceReporters.map((rep) => {
                                            const cleanPhone = getCleanPhone(rep.phone);
                                            return (
                                                <tr key={rep.id} className="hover:bg-teal-50/30 transition-colors">
                                                    {/* Reporter details */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-base shrink-0">
                                                                {rep.photoUrl ? (
                                                                    <img src={rep.photoUrl} alt={rep.name} className="w-full h-full rounded-full object-cover" />
                                                                ) : (
                                                                    rep.name ? rep.name.charAt(0).toUpperCase() : 'R'
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-gray-900 text-base">{rep.name}</span>
                                                                    {rep.isNewlyJoined && (
                                                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                                                            🆕 కొత్త
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    చేరిన తేదీ: <span className="font-semibold text-gray-700">{formatReadableDate(rep.joinedAt)}</span>
                                                                    {rep.isNewlyJoined && ` (${rep.daysSinceJoined} రోజుల క్రితం)`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Phone & Contact */}
                                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                                        {rep.phone ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-gray-900">{rep.phone}</span>
                                                                <a 
                                                                    href={`tel:${rep.phone}`} 
                                                                    className="bg-teal-50 text-teal-700 hover:bg-teal-100 p-1.5 rounded-lg transition-colors"
                                                                    title="డైరెక్ట్ కాల్"
                                                                >
                                                                    <Phone size={14} />
                                                                </a>
                                                                <a 
                                                                    href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`నమస్కారం ${rep.name} గారు, AlfaNews డెస్క్ నుండి...`)}`}
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="bg-green-50 text-green-700 hover:bg-green-100 p-1.5 rounded-lg transition-colors"
                                                                    title="వాట్సాప్ మెసేజ్"
                                                                >
                                                                    <MessageSquare size={14} />
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">ఫోన్ లేదు</span>
                                                        )}
                                                    </td>

                                                    {/* Location */}
                                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                                        <div className="font-bold text-gray-800">{rep.district}</div>
                                                        {rep.mandal && <div className="text-xs text-gray-500">{rep.mandal}</div>}
                                                    </td>

                                                    {/* Counts: Today */}
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={`font-black font-sans text-base ${rep.todayNewsCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {rep.todayNewsCount}
                                                        </span>
                                                    </td>

                                                    {/* Counts: Last Week */}
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={`font-black font-sans text-base ${rep.lastWeekNewsCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                            {rep.lastWeekNewsCount}
                                                        </span>
                                                    </td>

                                                    {/* Counts: Total */}
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className="font-black font-sans text-base text-gray-900">
                                                            {rep.totalNewsCount}
                                                        </span>
                                                    </td>

                                                    {/* Status & Deadline Badge */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="space-y-1">
                                                            {rep.deadlineStatus === 'ACTIVE' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full">
                                                                    <CheckCircle size={12} />
                                                                    <span>చురుకుగా ఉన్నారు (Active)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'NORMAL' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                                                                    <span>సాధారణం ({rep.daysInactive}d క్రితం)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'ATTENTION' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                                                                    <Clock size={12} />
                                                                    <span>శ్రద్ధ అవసరం ({rep.daysInactive} రోజులు)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'APPROACHING_DEADLINE' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-900 text-xs font-bold px-2.5 py-1 rounded-full border border-orange-300">
                                                                    <AlertTriangle size={12} />
                                                                    <span>డెడ్‌లైన్ సమీపిస్తోంది ({rep.daysInactive}d)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'CRITICAL_DEADLINE' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-900 text-xs font-black px-2.5 py-1 rounded-full border border-red-300 animate-pulse">
                                                                    <ShieldAlert size={12} />
                                                                    <span>హోదా రద్దు ప్రమాదం ({rep.daysInactive}d)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'NEW_NO_POSTS' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-900 text-xs font-bold px-2.5 py-1 rounded-full">
                                                                    <Sparkles size={12} />
                                                                    <span>కొత్త రిపోర్టర్ (ప్రారంభించాలి)</span>
                                                                </span>
                                                            )}
                                                            {rep.deadlineStatus === 'INACTIVE_ZERO' && (
                                                                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                                                    <span>ఇనాక్టివ్ (0 వార్తలు)</span>
                                                                </span>
                                                            )}

                                                            {rep.lastPostTimestamp && (
                                                                <div className="text-[11px] text-gray-500">
                                                                    చివరి వార్త: {formatReadableDate(rep.lastPostTimestamp)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => openPopup('reporter_all_time', rep.id, `${rep.name} - మొత్తం ప్రచురించిన వార్తలు`)}
                                                                className="bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition-colors border border-teal-200"
                                                                title="వార్తలు చూడండి"
                                                            >
                                                                వార్తలు ({rep.totalNewsCount})
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDowngradeReporter(rep.id, rep.name)}
                                                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition-colors border border-amber-200 flex items-center gap-1"
                                                                title="రిపోర్టర్ హోదా తొలగించి సబ్‌స్క్రైబర్‌గా మార్చు"
                                                            >
                                                                <UserMinus size={13} />
                                                                <span>హోదా మార్చు</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteReporter(rep.id, rep.name)}
                                                                className="bg-red-50 hover:bg-red-100 text-red-700 font-bold p-1.5 rounded-lg text-xs transition-colors border border-red-200"
                                                                title="ఖాతాను శాశ్వతంగా తొలగించు"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Responsive Cards View */}
                            <div className="divide-y divide-gray-200 md:hidden">
                                {filteredPerformanceReporters.map((rep) => {
                                    const cleanPhone = getCleanPhone(rep.phone);
                                    return (
                                        <div key={rep.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-lg shrink-0">
                                                        {rep.photoUrl ? (
                                                            <img src={rep.photoUrl} alt={rep.name} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            rep.name ? rep.name.charAt(0).toUpperCase() : 'R'
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-bold text-gray-900 text-lg leading-tight">{rep.name}</h4>
                                                            {rep.isNewlyJoined && (
                                                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                                                    🆕 కొత్త రిపోర్టర్
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 font-semibold">
                                                            📍 {rep.district} {rep.mandal ? `• ${rep.mandal}` : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => openPopup('reporter_all_time', rep.id, `${rep.name} - మొత్తం వార్తలు`)}
                                                    className="bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-gray-200"
                                                >
                                                    వార్తలు: {rep.totalNewsCount}
                                                </button>
                                            </div>

                                            {/* Phone & Contact Buttons */}
                                            {rep.phone && (
                                                <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                                    <div className="font-mono font-bold text-gray-900 text-sm">
                                                        📞 {rep.phone}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={`tel:${rep.phone}`} 
                                                            className="bg-teal-600 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                                        >
                                                            <Phone size={12} /> కాల్
                                                        </a>
                                                        <a 
                                                            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`నమస్కారం ${rep.name} గారు, AlfaNews డెస్క్ నుండి...`)}`}
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                                        >
                                                            <MessageSquare size={12} /> వాట్సాప్
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Post Metrics Row */}
                                            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                                                <div>
                                                    <span className="text-gray-500 block">ఈ రోజు</span>
                                                    <span className={`font-black font-sans text-base ${rep.todayNewsCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                        {rep.todayNewsCount}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block">గత వారం</span>
                                                    <span className={`font-black font-sans text-base ${rep.lastWeekNewsCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {rep.lastWeekNewsCount}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block">మొత్తం</span>
                                                    <span className="font-black font-sans text-base text-gray-900">
                                                        {rep.totalNewsCount}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Deadline / Status warning */}
                                            <div className="flex justify-between items-center text-xs pt-1">
                                                <span className="text-gray-500">
                                                    చేరిన తేదీ: <span className="font-bold text-gray-700">{formatReadableDate(rep.joinedAt)}</span>
                                                </span>
                                                {rep.deadlineStatus === 'ACTIVE' && (
                                                    <span className="text-green-700 font-bold">🟢 చురుకుగా ఉన్నారు</span>
                                                )}
                                                {rep.deadlineStatus === 'ATTENTION' && (
                                                    <span className="text-amber-700 font-bold">🟡 శ్రద్ధ అవసరం ({rep.daysInactive}d)</span>
                                                )}
                                                {rep.deadlineStatus === 'APPROACHING_DEADLINE' && (
                                                    <span className="text-orange-700 font-bold">🟠 డెడ్‌లైన్ సమీపిస్తోంది ({rep.daysInactive}d)</span>
                                                )}
                                                {rep.deadlineStatus === 'CRITICAL_DEADLINE' && (
                                                    <span className="text-red-700 font-black">🔴 హోదా రద్దు ప్రమాదం ({rep.daysInactive}d)</span>
                                                )}
                                                {rep.deadlineStatus === 'NEW_NO_POSTS' && (
                                                    <span className="text-purple-700 font-bold">🆕 కొత్త రిపోర్టర్</span>
                                                )}
                                                {rep.deadlineStatus === 'INACTIVE_ZERO' && (
                                                    <span className="text-gray-500">ఇనాక్టివ్ (0 వార్తలు)</span>
                                                )}
                                            </div>

                                            {/* Action Buttons Row */}
                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                                                <button 
                                                    onClick={() => handleDowngradeReporter(rep.id, rep.name)}
                                                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-amber-200 flex items-center justify-center gap-1"
                                                >
                                                    <UserMinus size={13} /> హోదా మార్చు
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteReporter(rep.id, rep.name)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-red-200 flex items-center justify-center gap-1"
                                                    title="ఖాతా తొలగించు"
                                                >
                                                    <Trash2 size={13} /> తొలగించు
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* POPUP MODAL: NEWS LIST WITH EDIT & DELETE */}
            {/* ========================================================================= */}
            {isPopupOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                                <h3 className="text-xl font-bold text-gray-900 font-ramabhadra">{popupTitle}</h3>
                                <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full font-sans ml-2">
                                    {filteredPopupPosts.length} వార్తలు
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsPopupOpen(false)}
                                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                            {loadingPopupPosts ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-red-600 border-t-transparent"></div>
                                    <p className="text-gray-500 font-bold">వార్తలు లోడ్ అవుతున్నాయి...</p>
                                </div>
                            ) : filteredPopupPosts.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 font-bold">
                                    వార్తలు ఏవీ లేవు.
                                </div>
                            ) : (
                                filteredPopupPosts.map((post) => (
                                    <div 
                                        key={post.id} 
                                        className="border border-gray-200 rounded-xl p-4 hover:border-red-200 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-xs"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className="text-xs font-sans text-gray-500 font-semibold">
                                                    📅 {formatReadableDate(post.timestamp)}
                                                </span>
                                                {post.location && (
                                                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-md font-bold">
                                                        📌 {post.location}
                                                    </span>
                                                )}
                                                {post.district && (
                                                    <span className="bg-teal-50 text-teal-800 text-xs px-2 py-0.5 rounded-md font-bold">
                                                        🏛️ {post.district}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-base md:text-lg font-bold text-gray-900 leading-snug line-clamp-2">
                                                {post.headline?.telugu || (post.headline as any) || 'శీర్షిక లేదు'}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                ✍️ రిపోర్టర్: <span className="font-bold text-gray-700">{post.reporter?.name || 'జిల్లా రిపోర్టర్'}</span>
                                            </p>
                                        </div>

                                        {/* Action Buttons: Edit and Delete */}
                                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                            <button 
                                                onClick={() => {
                                                    setIsPopupOpen(false);
                                                    onEditPost(post);
                                                }}
                                                className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-xl text-xs font-bold transition-colors border border-blue-100"
                                            >
                                                <Edit2 size={14} />
                                                <span>ఎడిట్</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePost(post.id)}
                                                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl text-xs font-bold transition-colors border border-red-100"
                                            >
                                                <Trash2 size={14} />
                                                <span>తొలగించు</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setIsPopupOpen(false)}
                                className="bg-gray-200 text-gray-800 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-300 transition-colors text-sm"
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
