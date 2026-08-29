import React, { useState, useEffect, useCallback } from 'react';
import { db, app } from '../services/firebase';
import { 
    DistrictSocialConfig, 
    SocialAutoPostLog, 
    SocialAutoPostSettings, 
    TS_DISTRICTS, 
    AP_DISTRICTS,
    User
} from '../types';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, doc, setDoc, updateDoc, getDoc, query, orderBy, limit, onSnapshot, serverTimestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

interface SocialAutoPostPageProps {
    currentUser?: User;
}

const SocialAutoPostPage: React.FC<SocialAutoPostPageProps> = () => {
    // Navigation Tabs
    const [activeTab, setActiveTab] = useState<'districts' | 'settings' | 'logs' | 'manual'>('districts');
    const [stateFilter, setStateFilter] = useState<'ALL' | 'TS' | 'AP' | 'CONFIGURED' | 'ACTIVE'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // State Data
    const [districtConfigs, setDistrictConfigs] = useState<Record<string, DistrictSocialConfig>>({});
    const [globalSettings, setGlobalSettings] = useState<SocialAutoPostSettings>({
        globalEnabled: true,
        defaultAccessToken: '',
        defaultAppDownloadLink: 'https://play.google.com/store/apps/details?id=com.alfanews.telugu',
        defaultHashtags: ['#AlfaNews', '#TeluguNews', '#BreakingNews']
    });
    const [logs, setLogs] = useState<SocialAutoPostLog[]>([]);
    
    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Edit Modal State
    const [editingDistrict, setEditingDistrict] = useState<DistrictSocialConfig | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [hashtagsInput, setHashtagsInput] = useState('');

    // Test Post Modal State
    const [testModalDistrict, setTestModalDistrict] = useState<DistrictSocialConfig | null>(null);
    const [testPlatform, setTestPlatform] = useState<'all' | 'facebook' | 'instagram'>('all');
    const [testMessage, setTestMessage] = useState('');
    const [testImageUrl, setTestImageUrl] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<any | null>(null);

    // Manual Post State
    const [manualPostId, setManualPostId] = useState('');
    const [manualDistrictId, setManualDistrictId] = useState('');
    const [isManualPosting, setIsManualPosting] = useState(false);
    const [manualPostResult, setManualPostResult] = useState<any | null>(null);

    // Global Hashtags String state for editing
    const [globalHashtagsInput, setGlobalHashtagsInput] = useState('');

    // Permanent Token Generator State
    const [appIdInput, setAppIdInput] = useState('4601780193389177');
    const [appSecretInput, setAppSecretInput] = useState('');
    const [shortTokenInput, setShortTokenInput] = useState('');
    const [isExchanging, setIsExchanging] = useState(false);
    const [tokenExchangeResult, setTokenExchangeResult] = useState<any | null>(null);

    const functions = getFunctions(app, 'asia-south1');


    // 1. Fetch District Configs & Global Settings
    const fetchConfigs = useCallback(async () => {
        setIsLoading(true);
        try {
            // Global settings
            const settingsSnap = await getDoc(doc(db, 'settings', 'social_auto_post'));
            if (settingsSnap.exists()) {
                const data = settingsSnap.data() as SocialAutoPostSettings;
                setGlobalSettings(data);
                setGlobalHashtagsInput((data.defaultHashtags || []).join(', '));
            } else {
                setGlobalHashtagsInput('#AlfaNews, #TeluguNews, #BreakingNews');
            }

            // District configs
            const configsSnap = await getDocs(collection(db, 'social_auto_post_configs'));
            const map: Record<string, DistrictSocialConfig> = {};
            configsSnap.docs.forEach((d: any) => {
                map[d.id] = { id: d.id, ...d.data() } as DistrictSocialConfig;
            });
            setDistrictConfigs(map);
        } catch (err: any) {
            console.error("Error loading social configs:", err);
            setStatusMessage(`Error loading configs: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    // 2. Real-time Logs Listener
    useEffect(() => {
        if (activeTab !== 'logs') return;
        const q = query(collection(db, 'social_auto_post_logs'), orderBy('timestamp', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const list: SocialAutoPostLog[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            setLogs(list);
        }, (err: any) => {
            console.error("Logs listener error:", err);
        });

        return () => unsubscribe();
    }, [activeTab]);

    // Combine all standard districts
    const allDistricts = [
        ...TS_DISTRICTS.map(d => ({ name: d, state: 'TS' as const })),
        ...AP_DISTRICTS.map(d => ({ name: d, state: 'AP' as const }))
    ];

    // Filtered districts
    const filteredDistricts = allDistricts.filter(item => {
        const config = districtConfigs[item.name];
        
        // State / Status Filter
        if (stateFilter === 'TS' && item.state !== 'TS') return false;
        if (stateFilter === 'AP' && item.state !== 'AP') return false;
        if (stateFilter === 'ACTIVE' && (!config || !config.enabled)) return false;
        if (stateFilter === 'CONFIGURED' && (!config || (!config.facebook?.pageId && !config.instagram?.igUserId))) return false;

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesName = item.name.toLowerCase().includes(q);
            const matchesFb = config?.facebook?.pageName?.toLowerCase().includes(q) || config?.facebook?.pageId?.includes(q);
            const matchesIg = config?.instagram?.accountName?.toLowerCase().includes(q) || config?.instagram?.igUserId?.includes(q);
            return matchesName || matchesFb || matchesIg;
        }
        return true;
    });

    // Counts for overview
    const totalDistrictsCount = allDistricts.length;
    const configuredCount = Object.values(districtConfigs).filter(c => c.facebook?.pageId || c.instagram?.igUserId).length;
    const activeCount = Object.values(districtConfigs).filter(c => c.enabled).length;

    // Handle Quick Toggle Active
    const handleQuickToggle = async (districtName: string, state: 'TS' | 'AP', currentEnabled: boolean) => {
        try {
            const configRef = doc(db, 'social_auto_post_configs', districtName);
            const newEnabled = !currentEnabled;
            
            if (!districtConfigs[districtName]) {
                // Initialize default
                const newConfig: DistrictSocialConfig = {
                    id: districtName,
                    district: districtName,
                    state,
                    enabled: newEnabled,
                    facebook: { enabled: true, pageId: '', pageName: '', pageAccessToken: '' },
                    instagram: { enabled: true, igUserId: '', accountName: '', accessToken: '' },
                    customHashtags: [`#${districtName.replace(/\s+/g, '')}`, '#AlfaNews'],
                    includeAppDownloadLink: true,
                    updatedAt: serverTimestamp()
                };
                await setDoc(configRef, newConfig);
                setDistrictConfigs(prev => ({ ...prev, [districtName]: newConfig }));
            } else {
                await updateDoc(configRef, {
                    enabled: newEnabled,
                    updatedAt: serverTimestamp()
                });
                setDistrictConfigs(prev => ({
                    ...prev,
                    [districtName]: { ...prev[districtName], enabled: newEnabled }
                }));
            }
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (districtName: string, state: 'TS' | 'AP') => {
        const existing = districtConfigs[districtName] || {
            id: districtName,
            district: districtName,
            state,
            enabled: false,
            facebook: { enabled: true, pageId: '', pageName: '', pageAccessToken: '' },
            instagram: { enabled: true, igUserId: '', accountName: '', accessToken: '' },
            customHashtags: [`#${districtName.replace(/\s+/g, '')}`, '#AlfaNews'],
            includeAppDownloadLink: true
        };

        setEditingDistrict({ ...existing });
        setHashtagsInput((existing.customHashtags || []).join(', '));
        setIsEditModalOpen(true);
    };

    // Save District Config
    const handleSaveDistrictConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDistrict) return;
        setIsSaving(true);
        try {
            const hashtags = hashtagsInput
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0)
                .map(t => t.startsWith('#') ? t : `#${t}`);

            const payload: DistrictSocialConfig = {
                ...editingDistrict,
                customHashtags: hashtags,
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, 'social_auto_post_configs', editingDistrict.district), payload, { merge: true });
            setDistrictConfigs(prev => ({ ...prev, [editingDistrict.district]: payload }));
            setIsEditModalOpen(false);
            setStatusMessage(`✅ ${editingDistrict.district} కాన్ఫిగరేషన్ విజయవంతంగా సేవ్ అయింది.`);
            setTimeout(() => setStatusMessage(null), 4000);
        } catch (e: any) {
            alert(`Save Error: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Save Global Settings
    const handleSaveGlobalSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const hashtags = globalHashtagsInput
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0)
                .map(t => t.startsWith('#') ? t : `#${t}`);

            const payload: SocialAutoPostSettings = {
                ...globalSettings,
                defaultHashtags: hashtags,
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, 'settings', 'social_auto_post'), payload, { merge: true });
            setGlobalSettings(payload);
            setStatusMessage("✅ గ్లోబల్ సెట్టింగ్స్ విజయవంతంగా సేవ్ అయ్యాయి.");
            setTimeout(() => setStatusMessage(null), 4000);
        } catch (e: any) {
            alert(`Global Settings Save Error: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Exchange Temporary Graph API Token for Permanent / Long-Lived Token
    const handleExchangeToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shortTokenInput.trim() || !appIdInput.trim() || !appSecretInput.trim()) {
            alert('దయచేసి Meta App ID, App Secret మరియు Graph API Explorer నుండి పొందిన Token నమోదు చేయండి.');
            return;
        }
        setIsExchanging(true);
        setTokenExchangeResult(null);
        try {
            const exchangeFn = httpsCallable(functions, 'exchangeForPermanentToken');
            const res: any = await exchangeFn({
                shortLivedToken: shortTokenInput.trim(),
                appId: appIdInput.trim(),
                appSecret: appSecretInput.trim()
            });
            setTokenExchangeResult(res.data);
            setGlobalSettings(prev => ({
                ...prev,
                appId: appIdInput.trim(),
                appSecret: appSecretInput.trim(),
                defaultAccessToken: res.data.longLivedUserToken
            }));
            setStatusMessage(`✅ పర్మనెంట్ టోకెన్ విజయవంతంగా జనరేట్ అయింది! (${res.data.pagesCount || 0} పేజీలు గుర్తించబడ్డాయి)`);
            setTimeout(() => setStatusMessage(null), 5000);
            fetchConfigs();
        } catch (err: any) {
            console.error("Token exchange failed:", err);
            setTokenExchangeResult({ error: err.message });
            alert(`Token Exchange Error: ${err.message}`);
        } finally {
            setIsExchanging(false);
        }
    };

    // Initialize All Districts Cloud Function Call

    const handleInitializeAll = async () => {
        if (!window.confirm("తెలంగాణ మరియు ఆంధ్రప్రదేశ్‌లోని మొత్తం 59 జిల్లాలకు డిఫాల్ట్ కాన్ఫిగరేషన్ ఫైల్స్ ఇనీషియలైజ్ చేయాలా?")) return;
        setIsInitializing(true);
        try {
            const initFn = httpsCallable(functions, 'initializeDistrictSocialConfigs');
            const res: any = await initFn();
            alert(`విజయవంతంగా పూర్తయింది! (${res.data?.initializedCount || 0} నూతన జిల్లాలు చేర్చబడ్డాయి)`);
            fetchConfigs();
        } catch (e: any) {
            alert(`ఇనీషియలైజ్ ఎర్రర్: ${e.message}`);
        } finally {
            setIsInitializing(false);
        }
    };

    // Run Test Post
    const handleRunTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testModalDistrict) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const testFn = httpsCallable(functions, 'testDistrictSocialPost');
            const res: any = await testFn({
                districtId: testModalDistrict.district,
                testPlatform,
                customMessage: testMessage || undefined,
                customImageUrl: testImageUrl || undefined
            });
            setTestResult(res.data);
            fetchConfigs();
        } catch (e: any) {
            setTestResult({ error: e.message });
        } finally {
            setIsTesting(false);
        }
    };

    // Manual Post Trigger
    const handleManualPost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualPostId.trim()) return;
        setIsManualPosting(true);
        setManualPostResult(null);
        try {
            const manualFn = httpsCallable(functions, 'manuallyTriggerSocialPost');
            const res: any = await manualFn({
                postId: manualPostId.trim(),
                districtId: manualDistrictId || undefined
            });
            setManualPostResult(res.data);
            alert("పోస్టింగ్ ప్రాసెస్ పూర్తయింది. క్రింద ఫలితాన్ని చూడండి.");
        } catch (e: any) {
            setManualPostResult({ error: e.message });
        } finally {
            setIsManualPosting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-mallanna text-gray-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-ramabhadra text-gray-900 flex items-center gap-3">
                        <span className="text-4xl">🚀</span> డిస్ట్రిక్ట్ సోషల్ ఆటో-పోస్ట్ (FB & Insta)
                    </h1>
                    <p className="text-gray-600 text-lg mt-1">
                        ఆల్ఫా న్యూస్ యాప్‌లోని ప్రతీ జిల్లా వార్త ఆటోమేటిక్‌గా సంబంధిత Facebook Page మరియు Instagram లో పోస్ట్ అవుతుంది.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleInitializeAll}
                        disabled={isInitializing}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow hover:bg-blue-700 transition-all flex items-center gap-2 text-base"
                    >
                        {isInitializing ? 'ఇనీషియలైజ్ అవుతోంది...' : '⚡ అన్ని జిల్లాలను ఇనీషియలైజ్ చేయండి'}
                    </button>
                    <button
                        onClick={fetchConfigs}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all text-base"
                    >
                        🔄 రీఫ్రెష్
                    </button>
                </div>
            </div>

            {/* Notification Alert */}
            {statusMessage && (
                <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-lg font-bold shadow-sm flex items-center justify-between">
                    <span>{statusMessage}</span>
                    <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-black text-xl">✕</button>
                </div>
            )}

            {/* Overview Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <span className="text-gray-500 text-base font-bold">మొత్తం జిల్లాలు</span>
                    <span className="text-3xl font-black text-gray-800 mt-1">{totalDistrictsCount}</span>
                    <span className="text-xs text-gray-400 mt-1">TS: 33 | AP: 26</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <span className="text-gray-500 text-base font-bold">కాన్ఫిగర్ అయినవి</span>
                    <span className="text-3xl font-black text-blue-600 mt-1">{configuredCount}</span>
                    <span className="text-xs text-gray-400 mt-1">Page ID / IG ID ఉన్నవి</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <span className="text-gray-500 text-base font-bold">ఆటో-పోస్ట్ ఆక్టివ్</span>
                    <span className="text-3xl font-black text-emerald-600 mt-1">{activeCount}</span>
                    <span className="text-xs text-gray-400 mt-1">ప్రస్తుతం ఆన్‌లో ఉన్న జిల్లాలు</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <span className="text-gray-500 text-base font-bold">గ్లోబల్ మాస్టర్ స్విచ్</span>
                    <span className={`text-2xl font-black mt-1 ${globalSettings.globalEnabled ? 'text-emerald-600' : 'text-red-600'}`}>
                        {globalSettings.globalEnabled ? '🟢 ON' : '🔴 OFF'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">{globalSettings.defaultAccessToken ? 'System Token Active' : 'No Global Token'}</span>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-gray-200 mb-6 gap-2">
                <button
                    onClick={() => setActiveTab('districts')}
                    className={`pb-3 px-5 text-xl font-bold transition-all border-b-4 ${activeTab === 'districts' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    🗺️ జిల్లా కాన్ఫిగరేషన్లు ({totalDistrictsCount})
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`pb-3 px-5 text-xl font-bold transition-all border-b-4 ${activeTab === 'settings' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    ⚙️ గ్లోబల్ సెట్టింగ్స్ & టోకెన్
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`pb-3 px-5 text-xl font-bold transition-all border-b-4 ${activeTab === 'logs' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    📋 లైవ్ ఆటో-పోస్ట్ లాగ్స్
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`pb-3 px-5 text-xl font-bold transition-all border-b-4 ${activeTab === 'manual' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    ⚡ మాన్యువల్ షేర్ (Single Post)
                </button>
            </div>

            {/* TAB 1: DISTRICTS LIST */}
            {activeTab === 'districts' && (
                <div>
                    {/* Filters & Search */}
                    <div className="bg-white p-4 rounded-2xl border shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {(['ALL', 'TS', 'AP', 'CONFIGURED', 'ACTIVE'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setStateFilter(tab)}
                                    className={`px-4 py-2 rounded-xl text-base font-bold transition-all ${
                                        stateFilter === tab 
                                            ? 'bg-red-600 text-white shadow' 
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {tab === 'ALL' && 'అన్నీ (59)'}
                                    {tab === 'TS' && 'తెలంగాణ (33)'}
                                    {tab === 'AP' && 'ఆంధ్రప్రదేశ్ (26)'}
                                    {tab === 'CONFIGURED' && `కాన్ఫిగర్ అయినవి (${configuredCount})`}
                                    {tab === 'ACTIVE' && `ఆక్టివ్ (${activeCount})`}
                                </button>
                            ))}
                        </div>

                        <div className="w-full md:w-72">
                            <input
                                type="text"
                                placeholder="🔍 జిల్లా పేరు / Page ID తో వెతకండి..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full border-2 border-gray-200 px-4 py-2 rounded-xl text-base outline-none focus:border-red-500"
                            />
                        </div>
                    </div>

                    {/* Districts Grid */}
                    {isLoading ? (
                        <div className="p-12 text-center text-xl text-gray-500">లోడ్ అవుతోంది...</div>
                    ) : filteredDistricts.length === 0 ? (
                        <div className="p-12 bg-white rounded-2xl border text-center text-gray-500 text-lg">
                            ఏ జిల్లాలు దొరకలేదు.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredDistricts.map(item => {
                                const config = districtConfigs[item.name];
                                const isEnabled = config?.enabled ?? false;
                                const hasFb = Boolean(config?.facebook?.pageId);
                                const hasIg = Boolean(config?.instagram?.igUserId);
                                const totalFbPosts = config?.stats?.totalFbPosts || 0;
                                const totalIgPosts = config?.stats?.totalIgPosts || 0;

                                return (
                                    <div 
                                        key={item.name} 
                                        className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm hover:shadow-md flex flex-col justify-between ${
                                            isEnabled ? 'border-emerald-300' : 'border-gray-200 opacity-90'
                                        }`}
                                    >
                                        <div>
                                            {/* Top: District Name, State badge, Toggle */}
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-2xl font-ramabhadra text-gray-900">{item.name}</h3>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                                                            item.state === 'TS' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {item.state}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {isEnabled ? '🟢 ఆటో-పోస్టింగ్ యాక్టివ్‌గా ఉంది' : '⚪ ఆటో-పోస్టింగ్ నిలిపివేయబడింది'}
                                                    </p>
                                                </div>

                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isEnabled} 
                                                        onChange={() => handleQuickToggle(item.name, item.state, isEnabled)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                </label>
                                            </div>

                                            {/* Details Badges */}
                                            <div className="space-y-2 my-4 bg-gray-50 p-3 rounded-xl border text-sm">
                                                {/* Facebook info */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-blue-600 font-bold">FB Page:</span>
                                                        <span className="truncate max-w-[140px] text-gray-700 font-mono">
                                                            {config?.facebook?.pageId ? `${config.facebook.pageName || config.facebook.pageId}` : <span className="text-gray-400 italic">Not set</span>}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${hasFb ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                                                        {hasFb ? `Posts: ${totalFbPosts}` : 'Unlinked'}
                                                    </span>
                                                </div>

                                                {/* Instagram info */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-pink-600 font-bold">Instagram:</span>
                                                        <span className="truncate max-w-[140px] text-gray-700 font-mono">
                                                            {config?.instagram?.igUserId ? `${config.instagram.accountName || config.instagram.igUserId}` : <span className="text-gray-400 italic">Not set</span>}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${hasIg ? 'bg-pink-100 text-pink-700' : 'bg-gray-200 text-gray-500'}`}>
                                                        {hasIg ? `Posts: ${totalIgPosts}` : 'Unlinked'}
                                                    </span>
                                                </div>

                                                {/* Last Status info */}
                                                {config?.stats?.lastPostTime && (
                                                    <div className="text-xs text-gray-500 pt-1 border-t border-gray-200 flex justify-between">
                                                        <span>చివరి పోస్ట్: {config.stats.lastFbStatus === 'SUCCESS' ? '✅ సక్సెస్' : config.stats.lastFbStatus || 'IDLE'}</span>
                                                        {config.stats.lastError && <span className="text-red-500 font-bold truncate max-w-[120px]" title={config.stats.lastError}>⚠️ Error</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 pt-2 border-t">
                                            <button
                                                onClick={() => handleOpenEdit(item.name, item.state)}
                                                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
                                            >
                                                ⚙️ సెట్టింగ్స్ (Edit)
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setTestModalDistrict(config || {
                                                        id: item.name,
                                                        district: item.name,
                                                        state: item.state,
                                                        enabled: true,
                                                        facebook: { enabled: true, pageId: '', pageName: '', pageAccessToken: '' },
                                                        instagram: { enabled: true, igUserId: '', accountName: '', accessToken: '' }
                                                    });
                                                    setTestResult(null);
                                                }}
                                                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1"
                                                title="టెస్ట్ పోస్ట్ పంపండి"
                                            >
                                                🧪 టెస్ట్
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: GLOBAL SETTINGS */}
            {activeTab === 'settings' && (
                <div className="space-y-8 max-w-3xl">
                    {/* 1. Permanent Token Generator Box */}
                    <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 md:p-8 rounded-2xl border-2 border-purple-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">⚡</span>
                            <div>
                                <h3 className="text-2xl font-ramabhadra text-purple-900">పర్మనెంట్ టోకెన్ జనరేటర్ (Never Expiring Token)</h3>
                                <p className="text-sm text-gray-600">Graph API Explorer టోకెన్‌లు 1-2 గంటల్లో Expire అవుతాయి. కింద మీ Meta App Secret ఇచ్చి దానిని జీవితాంతం పనిచేసే పర్మనెంట్ టోకెన్‌గా మార్చుకోండి.</p>
                            </div>
                        </div>

                        <form onSubmit={handleExchangeToken} className="mt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 font-bold text-sm mb-1">Meta App ID:</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-2 border-purple-200 p-2.5 rounded-xl text-sm font-mono focus:border-purple-600 outline-none"
                                        value={appIdInput}
                                        onChange={e => setAppIdInput(e.target.value)}
                                        placeholder="4601780193389177"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 font-bold text-sm mb-1">
                                        Meta App Secret:
                                        <a 
                                            href="https://developers.facebook.com/apps/4601780193389177/settings/basic/" 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs text-purple-600 font-normal ml-2 hover:underline"
                                        >
                                            (ఎక్కడుంది? ↗)
                                        </a>
                                    </label>
                                    <input 
                                        type="password" 
                                        className="w-full border-2 border-purple-200 p-2.5 rounded-xl text-sm font-mono focus:border-purple-600 outline-none"
                                        value={appSecretInput}
                                        onChange={e => setAppSecretInput(e.target.value)}
                                        placeholder="App Secret (Meta Developer Basic Settings)"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-700 font-bold text-sm mb-1">
                                    Graph API Explorer Access Token:
                                    <a 
                                        href="https://developers.facebook.com/tools/explorer/" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-xs text-purple-600 font-normal ml-2 hover:underline"
                                    >
                                        (Explorer కి వెళ్లు ↗)
                                    </a>
                                </label>
                                <textarea 
                                    rows={2}
                                    className="w-full border-2 border-purple-200 p-2.5 rounded-xl text-xs font-mono focus:border-purple-600 outline-none"
                                    value={shortTokenInput}
                                    onChange={e => setShortTokenInput(e.target.value)}
                                    placeholder="Graph API Explorer లో Generate Access Token నొక్కి కాపీ చేసిన తాజా టోకెన్ ఇక్కడ పేస్ట్ చేయండి..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isExchanging}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-base shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isExchanging ? 'పర్మనెంట్ టోకెన్ జనరేట్ అవుతోంది...' : '⚡ పర్మనెంట్ టోకెన్‌గా మార్చి గ్లోబల్‌గా సేవ్ చేయండి'}
                            </button>
                        </form>

                        {/* Token Exchange Results */}
                        {tokenExchangeResult && (
                            <div className="mt-4 p-4 bg-white rounded-xl border border-purple-200">
                                {tokenExchangeResult.error ? (
                                    <p className="text-sm font-bold text-red-600">❌ ఎర్రర్: {tokenExchangeResult.error}</p>
                                ) : (
                                    <div className="text-xs text-gray-700 space-y-2">
                                        <p className="font-bold text-emerald-600 text-sm">✅ టోకెన్ విజయవంతంగా పర్మనెంట్ టోకెన్‌గా మారింది!</p>
                                        <p className="font-mono break-all text-[11px] bg-gray-50 p-2 rounded border">
                                            {tokenExchangeResult.longLivedUserToken}
                                        </p>
                                        {tokenExchangeResult.pages && tokenExchangeResult.pages.length > 0 && (
                                            <div className="mt-2">
                                                <p className="font-bold text-gray-800 mb-1">గుర్తించబడిన పేజీలు ({tokenExchangeResult.pages.length}):</p>
                                                {tokenExchangeResult.pages.map((p: any) => (
                                                    <div key={p.id} className="bg-purple-50 p-2 rounded mb-1 flex items-center justify-between">
                                                        <span className="font-bold">{p.name} (ID: {p.id})</span>
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Never Expires</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Global Settings Form */}
                    <div className="bg-white p-6 md:p-8 rounded-2xl border shadow-sm">
                        <h2 className="text-2xl font-ramabhadra text-gray-900 mb-2">⚙️ గ్లోబల్ సోషల్ ఆటో-పోస్ట్ సెట్టింగ్స్</h2>
                        <p className="text-gray-600 text-base mb-6">
                            ఇక్కడ మీరు ఇచ్చే గ్లోబల్ టోకెన్ మరియు డౌన్‌లోడ్ లింక్, ప్రతీ జిల్లాకు విడిగా టోకెన్ ఇవ్వని పక్షంలో డిఫాల్ట్‌గా ఉపయోగించబడతాయి.
                        </p>

                        <form onSubmit={handleSaveGlobalSettings} className="space-y-6">

                        {/* Global Enable Master Switch */}
                        <div className="p-4 bg-gray-50 border rounded-2xl flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900">మాస్టర్ ఆటో-పోస్ట్ స్విచ్ (Master Kill Switch)</h4>
                                <p className="text-sm text-gray-500">దీనిని ఆఫ్ చేస్తే ఏ జిల్లా పేజీకి కూడా ఆటో-పోస్టింగ్ జరగదు.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={globalSettings.globalEnabled} 
                                    onChange={e => setGlobalSettings(prev => ({ ...prev, globalEnabled: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        {/* Global System User Access Token */}
                        <div>
                            <label className="block text-gray-800 font-bold text-base mb-1">
                                గ్లోబల్ మెటా యాక్సెస్ టోకెన్ (Meta Business System User Token - Recommended)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Meta Business Suite లో System User క్రియేట్ చేసి, అన్ని 59 పేజీల full control ఇచ్చి జనరేట్ చేసిన Single Permanent Token ని ఇక్కడ పేస్ట్ చేయవచ్చు.
                            </p>
                            <textarea
                                rows={3}
                                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-mono focus:border-red-500 outline-none"
                                value={globalSettings.defaultAccessToken || ''}
                                onChange={e => setGlobalSettings(prev => ({ ...prev, defaultAccessToken: e.target.value }))}
                                placeholder="EAA..."
                            />
                        </div>

                        {/* Default App Download Link */}
                        <div>
                            <label className="block text-gray-800 font-bold text-base mb-1">
                                డిఫాల్ట్ యాప్ డౌన్‌లోడ్ లింక్ (Play Store URL)
                            </label>
                            <input
                                type="url"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl text-base focus:border-red-500 outline-none"
                                value={globalSettings.defaultAppDownloadLink || ''}
                                onChange={e => setGlobalSettings(prev => ({ ...prev, defaultAppDownloadLink: e.target.value }))}
                                placeholder="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
                            />
                        </div>

                        {/* Default Global Hashtags */}
                        <div>
                            <label className="block text-gray-800 font-bold text-base mb-1">
                                గ్లోబల్ డిఫాల్ట్ హ్యాష్‌ట్యాగ్‌లు (Comma Separated)
                            </label>
                            <input
                                type="text"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl text-base focus:border-red-500 outline-none"
                                value={globalHashtagsInput}
                                onChange={e => setGlobalHashtagsInput(e.target.value)}
                                placeholder="#AlfaNews, #TeluguNews, #BreakingNews, #APNews, #TSNews"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3.5 bg-red-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'సేవ్ అవుతోంది...' : '💾 గ్లోబల్ సెట్టింగ్స్ సేవ్ చేయండి'}
                        </button>
                    </form>
                </div>
            </div>
            )}


            {/* TAB 3: LIVE LOGS */}
            {activeTab === 'logs' && (
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-ramabhadra text-gray-900">📋 లైవ్ ఆటో-పోస్ట్ లాగ్స్ (గత 50 పోస్ట్‌లు)</h2>
                        <span className="text-sm text-gray-500 font-mono">Real-time sync active</span>
                    </div>

                    {logs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-lg">
                            ఇంకా ఎటువంటి ఆటో-పోస్ట్ లాగ్స్ నమోదు కాలేదు.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-3">సమయం</th>
                                        <th className="p-3">జిల్లా</th>
                                        <th className="p-3">హెడ్‌లైన్</th>
                                        <th className="p-3">Facebook</th>
                                        <th className="p-3">Instagram</th>
                                        <th className="p-3">చర్యలు</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {logs.map(log => {
                                        const dateStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('te-IN') : 'Just now';
                                        return (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="p-3 whitespace-nowrap text-xs text-gray-500 font-mono">{dateStr}</td>
                                                <td className="p-3 font-bold text-gray-900 whitespace-nowrap">
                                                    {log.district} {log.state && <span className="text-xs font-normal text-gray-400">({log.state})</span>}
                                                </td>
                                                <td className="p-3 max-w-xs truncate text-gray-800" title={log.headline}>
                                                    {log.headline || 'No headline'}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    {log.facebookStatus === 'SUCCESS' ? (
                                                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                                            ✅ Success {log.facebookPostId && `(${log.facebookPostId.substring(0, 8)}...)`}
                                                        </span>
                                                    ) : log.facebookStatus === 'FAILED' ? (
                                                        <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold" title={log.facebookError}>
                                                            ❌ Failed: {log.facebookError?.substring(0, 20)}...
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">⚪ {log.facebookStatus}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    {log.instagramStatus === 'SUCCESS' ? (
                                                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                                            ✅ Success {log.instagramMediaId && `(${log.instagramMediaId.substring(0, 8)}...)`}
                                                        </span>
                                                    ) : log.instagramStatus === 'FAILED' ? (
                                                        <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold" title={log.instagramError}>
                                                            ❌ Failed: {log.instagramError?.substring(0, 20)}...
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">⚪ {log.instagramStatus}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            setManualPostId(log.postId);
                                                            setManualDistrictId(log.district);
                                                            setActiveTab('manual');
                                                        }}
                                                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold"
                                                    >
                                                        🔁 Retry
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: MANUAL SINGLE POST */}
            {activeTab === 'manual' && (
                <div className="max-w-2xl bg-white p-6 md:p-8 rounded-2xl border shadow-sm">
                    <h2 className="text-2xl font-ramabhadra text-gray-900 mb-2">⚡ నిర్దిష్ట వార్తను మాన్యువల్‌గా షేర్ చేయండి</h2>
                    <p className="text-gray-600 text-base mb-6">
                        యాప్‌లో ఉన్న ఏదైనా న్యూస్ పోస్ట్ ఐడీ (Post ID) ని ఇక్కడ నమోదు చేసి, సంబంధిత జిల్లా పేజీకి తక్షణమే పంపవచ్చు.
                    </p>

                    <form onSubmit={handleManualPost} className="space-y-4">
                        <div>
                            <label className="block text-gray-800 font-bold mb-1">న్యూస్ పోస్ట్ ఐడీ (News Post ID):</label>
                            <input
                                type="text"
                                required
                                value={manualPostId}
                                onChange={e => setManualPostId(e.target.value)}
                                placeholder="e.g. 1740400000000_abc"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl text-base font-mono focus:border-red-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-800 font-bold mb-1">జిల్లాను ఎంచుకోండి (ఐచ్ఛికం - ఆటోమేటిక్ డిటెక్షన్ కాకపోతే):</label>
                            <select
                                value={manualDistrictId}
                                onChange={e => setManualDistrictId(e.target.value)}
                                className="w-full border-2 border-gray-200 p-3 rounded-xl text-base focus:border-red-500 outline-none"
                            >
                                <option value="">పోస్ట్‌లోని జిల్లానే తీసుకో (Auto)</option>
                                {[...TS_DISTRICTS, ...AP_DISTRICTS].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isManualPosting || !manualPostId}
                            className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-xl shadow-lg hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {isManualPosting ? 'పోస్ట్ అవుతోంది...' : '🚀 తక్షణమే సోషల్ మీడియాకు పోస్ట్ చేయండి'}
                        </button>
                    </form>

                    {manualPostResult && (
                        <div className="mt-6 p-4 rounded-2xl bg-gray-50 border text-sm font-mono overflow-x-auto">
                            <h4 className="font-bold text-gray-900 mb-2">ఫలితం (Result):</h4>
                            <pre>{JSON.stringify(manualPostResult, null, 2)}</pre>
                        </div>
                    )}
                </div>
            )}

            {/* EDIT DISTRICT MODAL */}
            {isEditModalOpen && editingDistrict && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-mallanna">
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
                            <div>
                                <h3 className="text-3xl font-ramabhadra text-gray-900">
                                    {editingDistrict.district} ({editingDistrict.state}) సెట్టింగ్స్
                                </h3>
                                <p className="text-gray-500 text-sm">ఫేస్‌బుక్ & ఇన్‌స్టాగ్రామ్ పేజీ వివరాలను అమర్చండి</p>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveDistrictConfig} className="space-y-6">
                            {/* District Auto-post switch */}
                            <div className="p-4 bg-gray-50 border rounded-2xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900">ఈ జిల్లాకు ఆటో-పోస్టింగ్ ప్రారంభించు</h4>
                                    <p className="text-xs text-gray-500">ఆన్‌లో ఉంటేనే వార్తలు ఆటోమేటిక్‌గా వెళ్తాయి</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={editingDistrict.enabled} 
                                        onChange={e => setEditingDistrict({ ...editingDistrict, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            {/* Facebook Section */}
                            <div className="p-5 border-2 border-blue-100 rounded-2xl bg-blue-50/30 space-y-4">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                                    <h4 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                                        📘 Facebook Page సెట్టింగ్స్
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-blue-900">
                                        <input
                                            type="checkbox"
                                            checked={editingDistrict.facebook?.enabled ?? true}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                facebook: { ...editingDistrict.facebook, enabled: e.target.checked } as any
                                            })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        Enable FB
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Page Name (Display Only):</label>
                                        <input
                                            type="text"
                                            value={editingDistrict.facebook?.pageName || ''}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                facebook: { ...editingDistrict.facebook, pageName: e.target.value } as any
                                            })}
                                            placeholder="Alfa News Karimnagar"
                                            className="w-full border p-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Facebook Page ID (తప్పనిసరి):</label>
                                        <input
                                            type="text"
                                            value={editingDistrict.facebook?.pageId || ''}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                facebook: { ...editingDistrict.facebook, pageId: e.target.value } as any
                                            })}
                                            placeholder="109284729384729"
                                            className="w-full border p-2.5 rounded-xl text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Page Access Token (ఖాళీగా ఉంచితే Global Token వాడుతుంది):
                                    </label>
                                    <input
                                        type="password"
                                        value={editingDistrict.facebook?.pageAccessToken || ''}
                                        onChange={e => setEditingDistrict({
                                            ...editingDistrict,
                                            facebook: { ...editingDistrict.facebook, pageAccessToken: e.target.value } as any
                                        })}
                                        placeholder="EAA... (Optional if Global Token set)"
                                        className="w-full border p-2.5 rounded-xl text-sm font-mono"
                                    />
                                </div>
                            </div>

                            {/* Instagram Section */}
                            <div className="p-5 border-2 border-pink-100 rounded-2xl bg-pink-50/30 space-y-4">
                                <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                                    <h4 className="text-xl font-bold text-pink-900 flex items-center gap-2">
                                        📸 Instagram Business సెట్టింగ్స్
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-pink-900">
                                        <input
                                            type="checkbox"
                                            checked={editingDistrict.instagram?.enabled ?? true}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                instagram: { ...editingDistrict.instagram, enabled: e.target.checked } as any
                                            })}
                                            className="w-4 h-4 text-pink-600 rounded"
                                        />
                                        Enable IG
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Account Handle / Name:</label>
                                        <input
                                            type="text"
                                            value={editingDistrict.instagram?.accountName || ''}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                instagram: { ...editingDistrict.instagram, accountName: e.target.value } as any
                                            })}
                                            placeholder="@alfanews_karimnagar"
                                            className="w-full border p-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Instagram Business Account ID (IG User ID):</label>
                                        <input
                                            type="text"
                                            value={editingDistrict.instagram?.igUserId || ''}
                                            onChange={e => setEditingDistrict({
                                                ...editingDistrict,
                                                instagram: { ...editingDistrict.instagram, igUserId: e.target.value } as any
                                            })}
                                            placeholder="17841400000000000"
                                            className="w-full border p-2.5 rounded-xl text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Instagram Access Token (ఖాళీగా ఉంచితే FB Token లేదా Global Token వాడుతుంది):
                                    </label>
                                    <input
                                        type="password"
                                        value={editingDistrict.instagram?.accessToken || ''}
                                        onChange={e => setEditingDistrict({
                                            ...editingDistrict,
                                            instagram: { ...editingDistrict.instagram, accessToken: e.target.value } as any
                                        })}
                                        placeholder="Optional if FB/Global token has IG permission"
                                        className="w-full border p-2.5 rounded-xl text-sm font-mono"
                                    />
                                </div>
                            </div>

                            {/* Hashtags & Link */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1">కస్టమ్ హ్యాష్‌ట్యాగ్‌లు (Comma Separated):</label>
                                <input
                                    type="text"
                                    value={hashtagsInput}
                                    onChange={e => setHashtagsInput(e.target.value)}
                                    placeholder="#కరీంనగర్, #KarimnagarNews, #AlfaNews"
                                    className="w-full border p-3 rounded-xl text-base"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editingDistrict.includeAppDownloadLink ?? true}
                                    onChange={e => setEditingDistrict({ ...editingDistrict, includeAppDownloadLink: e.target.checked })}
                                    className="w-5 h-5 text-red-600 rounded"
                                />
                                <span className="text-base text-gray-800 font-bold">యాప్ డౌన్‌లోడ్ లింక్‌ను పోస్ట్‌లో చేర్చు</span>
                            </label>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-base"
                                >
                                    రద్దు చేయండి (Cancel)
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base shadow-lg disabled:opacity-50"
                                >
                                    {isSaving ? 'సేవ్ అవుతోంది...' : '💾 సేవ్ చేయండి (Save)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TEST POST MODAL */}
            {testModalDistrict && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-mallanna">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b mb-4">
                            <h3 className="text-2xl font-ramabhadra text-gray-900">
                                🧪 {testModalDistrict.district} టెస్ట్ పోస్ట్
                            </h3>
                            <button
                                onClick={() => setTestModalDistrict(null)}
                                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleRunTest} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ప్లాట్‌ఫాం ఎంచుకోండి:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['all', 'facebook', 'instagram'] as const).map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setTestPlatform(p)}
                                            className={`py-2 rounded-xl text-sm font-bold capitalize transition-all border ${
                                                testPlatform === p 
                                                    ? 'bg-red-600 text-white border-red-600 shadow' 
                                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}
                                        >
                                            {p === 'all' ? 'All (FB+IG)' : p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">కస్టమ్ టెస్ట్ మెసేజ్ (ఐచ్ఛికం):</label>
                                <input
                                    type="text"
                                    value={testMessage}
                                    onChange={e => setTestMessage(e.target.value)}
                                    placeholder={`ఆల్ఫా న్యూస్ (${testModalDistrict.district}) టెస్ట్ పోస్ట్`}
                                    className="w-full border p-2.5 rounded-xl text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isTesting}
                                className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl text-lg shadow hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isTesting ? 'టెస్ట్ నడుస్తోంది...' : '🚀 టెస్ట్ పోస్ట్ పంపండి (Run Test)'}
                            </button>
                        </form>

                        {/* Test Result Display */}
                        {testResult && (
                            <div className="mt-4 p-4 rounded-2xl bg-gray-50 border text-sm font-mono overflow-x-auto">
                                <h4 className="font-bold text-gray-900 mb-1">టెస్ట్ రెస్పాన్స్ (Response):</h4>
                                <pre className="text-xs text-gray-800">{JSON.stringify(testResult, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialAutoPostPage;
