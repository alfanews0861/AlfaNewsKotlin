
import React, { useState, useEffect } from 'react';
import { app, db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { NewsPost } from '../types';

const { collection, query, orderBy, limit, getDocs } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

const AdminNotificationsPage: React.FC = () => {
    const [latestPosts, setLatestPosts] = useState<NewsPost[]>([]);
    const [selectedPostId, setSelectedPostId] = useState('');
    const [isSilent, setIsSilent] = useState(true); 
    const [isSending, setIsSending] = useState(false);
    const [loadingPosts, setLoadingPosts] = useState(true);

    useEffect(() => {
        const fetchLatestPosts = async () => {
            try {
                const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(100));
                const snap = await getDocs(q);
                const fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as NewsPost));
                setLatestPosts(fetched);
            } catch (e) {
                console.error("Failed to fetch posts", e);
            } finally {
                setLoadingPosts(false);
            }
        };
        fetchLatestPosts();
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPostId) { alert("దయచేసి ఒక వార్తను ఎంచుకోండి."); return; }
        
        const selectedPost = latestPosts.find(p => p.id === selectedPostId);
        if (!selectedPost) return;

        if (!window.confirm("ఈ వార్తను పుష్ నోటిఫికేషన్ ద్వారా అందరికీ పంపాలా?")) return;

        setIsSending(true);
        try {
            const functions = getFunctions(app, 'asia-south1');
            const sendPush = httpsCallable(functions, 'triggerPushBroadcast');
            
            const result: any = await sendPush({
                title: "🔴 బ్రేకింగ్ న్యూస్",
                body: selectedPost.headline.telugu,
                actionUrl: `#/s/${selectedPost.id}`,
                topic: 'all_users',
                silent: isSilent
            });

            if (result.data?.success) {
                alert(`నోటిఫికేషన్ విజయవంతంగా పంపబడింది!`);
                setSelectedPostId('');
            }
        } catch (e: any) {
            console.error("Full Broadcast Error Object:", e);
            // Extracts descriptive error from the Firebase Function response
            const detailedError = e.details || e.message || "Unknown error";
            alert(`లోపం వివరాలు: ${detailedError}\n\n(గమనిక: ఒకవేళ ఫంక్షన్ డిప్లాయ్ అవ్వకపోతే ఈ లోపం వస్తుంది)`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-2xl mx-auto font-mallanna border border-gray-100 text-black">
            <h2 className="text-3xl font-ramabhadra text-gray-800 mb-6 border-b pb-4 flex items-center gap-2">
                <span className="text-2xl">📢</span> Mobile Push Broadcast
            </h2>

            <form onSubmit={handleSend} className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 border border-blue-100">
                    <strong>గమనిక:</strong> కింద ఉన్న డ్రాప్ డౌన్ నుండి ఒక వార్తను ఎంచుకోండి. అది యూజర్ల మొబైల్ హోమ్ స్క్రీన్ పై అలర్ట్ లాగా కనిపిస్తుంది.
                </div>

                <div className="space-y-2">
                    <label className="block text-gray-700 font-bold text-lg">నోటిఫికేషన్ రకం (Mode)</label>
                    <div className="flex gap-4 p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
                        <button 
                            type="button"
                            onClick={() => setIsSilent(true)}
                            className={`flex-1 py-4 rounded-xl font-bold transition-all text-lg flex flex-col items-center gap-1 ${isSilent ? 'bg-white shadow-md text-blue-600' : 'text-gray-500'}`}
                        >
                            <span>🔇 Silent</span>
                            <span className="text-[10px] font-normal opacity-70">నో సౌండ్ (Recommended)</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setIsSilent(false)}
                            className={`flex-1 py-4 rounded-xl font-bold transition-all text-lg flex flex-col items-center gap-1 ${!isSilent ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500'}`}
                        >
                            <span>🔊 Alert</span>
                            <span className="text-[10px] font-normal opacity-90">రింగ్ / వైబ్రేషన్ (Only Breaking)</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="block text-gray-600 font-bold ml-1">వార్తను ఎంచుకోండి (Select News)</label>
                    {loadingPosts ? (
                        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center text-gray-400">వార్తలు లోడ్ అవుతున్నాయి...</div>
                    ) : (
                        <select 
                            value={selectedPostId} 
                            onChange={e => setSelectedPostId(e.target.value)} 
                            className="w-full border-2 border-gray-200 p-4 rounded-xl text-xl focus:border-blue-500 outline-none bg-white shadow-sm"
                            required
                        >
                            <option value="">-- వార్తను ఎంచుకోండి --</option>
                            {latestPosts.map(post => (
                                <option key={post.id} value={post.id}>{post.headline.telugu}</option>
                            ))}
                        </select>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={isSending || !selectedPostId}
                    className={`w-full py-5 rounded-2xl font-bold text-2xl shadow-xl transition-all flex items-center justify-center gap-3 ${isSending || !selectedPostId ? 'bg-gray-400' : (isSilent ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700')} text-white`}
                >
                    {isSending ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : "📢 SEND BROADCAST"}
                </button>
            </form>
        </div>
    );
};

export default AdminNotificationsPage;
