import React, { useState, useEffect } from 'react';
import { Search, X, History, TrendingUp } from 'lucide-react';
import { logAnalyticsEvent } from '../services/analyticsService';
import { AnalyticsEventType, NewsPost } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, query, where, getDocs, limit } = _firestore as any;

interface SearchModalProps {
    onClose: () => void;
    onPostClick: (postId: string) => void;
    currentUser: any;
}

const SearchModal: React.FC<SearchModalProps> = ({ onClose, onPostClick, currentUser }) => {
    const [queryText, setQueryText] = useState('');
    const [results, setResults] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('alfa_search_history');
        if (saved) setHistory(JSON.parse(saved));
    }, []);

    const handleSearch = async (text: string) => {
        const q = text.trim();
        if (!q) return;
        
        setLoading(true);
        logAnalyticsEvent(AnalyticsEventType.SEARCH, { id: 'search', categories: [] } as any, currentUser?.id, 0, { query: q });
        
        try {
            const newsRef = collection(db, 'news');
            // Simple search implementation (Firestore doesn't support full-text search natively well)
            // We search by category or district as a fallback, or just fetch recent
            const snap = await getDocs(query(newsRef, limit(20)));
            const all = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as NewsPost));
            
            const filtered = all.filter((p: NewsPost) => 
                p.headline.telugu.includes(q) || 
                p.content.telugu.includes(q) ||
                p.keywords?.some((k: string) => k.includes(q))
            );
            
            setResults(filtered);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in font-mallanna">
            <div className="p-4 flex items-center gap-3 border-b border-white/10">
                <button onClick={onClose} className="p-2 text-gray-400">
                    <X className="w-6 h-6" />
                </button>
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                        autoFocus
                        type="text"
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch(queryText)}
                        placeholder="వార్తల కోసం వెతకండి..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-red-500 transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {!queryText && history.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 text-gray-500 mb-4 px-2">
                            <History className="w-4 h-4" />
                            <span className="text-sm font-bold uppercase tracking-wider">ఇటీవలి శోధనలు</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {history.map((h, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => { setQueryText(h); handleSearch(h); }}
                                    className="px-4 py-2 bg-white/5 rounded-full text-gray-300 border border-white/5 hover:bg-white/10"
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-500">వెతుకుతున్నాము...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-4">
                        {results.map(post => (
                            <div 
                                key={post.id} 
                                onClick={() => onPostClick(post.id)}
                                className="flex gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 active:scale-95 transition-transform"
                            >
                                <img src={post.mediaUrl} className="w-20 h-20 rounded-xl object-cover shrink-0" alt="" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold line-clamp-2 leading-tight mb-1">{post.headline.telugu}</h4>
                                    <p className="text-xs text-gray-500">{post.reporter.name} • {new Date(post.timestamp).toLocaleDateString('te-IN')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : queryText && !loading ? (
                    <div className="text-center py-20 text-gray-500">
                        <p>ఫలితాలు ఏవీ దొరకలేదు.</p>
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <TrendingUp className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                        <p className="text-gray-600">మీకు నచ్చిన వార్తలను ఇక్కడ వెతకండి.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchModal;
