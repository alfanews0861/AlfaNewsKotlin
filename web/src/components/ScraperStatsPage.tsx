import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, RefreshCw, Database } from 'lucide-react';

const { collection, query, where, getCountFromServer, Timestamp } = _firestore as any;

const SCRAPER_REPORTER_IDS = ['rep1', 'rep2', 'rep3', 'rep4', 'rep5'];

interface DailyStats {
    date: string;
    count: number;
    timestamp: number;
}

const ScraperStatsPage: React.FC = () => {
    const [stats, setStats] = useState<DailyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalScraped, setTotalScraped] = useState(0);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const newsRef = collection(db, 'news');
            const newStats: DailyStats[] = [];
            let total = 0;

            // Fetch stats for the last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                const startOfDay = Timestamp.fromDate(date);
                
                const endOfDayDate = new Date(date);
                endOfDayDate.setHours(23, 59, 59, 999);
                const endOfDay = Timestamp.fromDate(endOfDayDate);

                const q = query(
                    newsRef,
                    where('reporter.id', 'in', SCRAPER_REPORTER_IDS),
                    where('createdAt', '>=', startOfDay),
                    where('createdAt', '<=', endOfDay)
                );

                const snapshot = await getCountFromServer(q);
                const count = snapshot.data().count;
                
                newStats.push({
                    date: date.toLocaleDateString('te-IN', { month: 'short', day: 'numeric' }),
                    count: count,
                    timestamp: date.getTime()
                });
                total += count;
            }

            setStats(newStats);
            setTotalScraped(total);
        } catch (error) {
            console.error("Error fetching scraper stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div className="p-6 max-w-6xl mx-auto font-mallanna animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-ramabhadra text-gray-900 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-blue-600" />
                        స్క్రాపర్ రిపోర్ట్ (Scraper Stats)
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">గత 7 రోజుల్లో వెబ్ స్క్రాపర్ ద్వారా వచ్చిన వార్తల వివరాలు</p>
                </div>
                <button 
                    onClick={fetchStats} 
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    రిఫ్రెష్
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Database className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">గత 7 రోజుల్లో</p>
                        <p className="text-3xl font-black text-gray-900">{loading ? '...' : totalScraped}</p>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                        <Activity className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">ఈ రోజు</p>
                        <p className="text-3xl font-black text-gray-900">{loading ? '...' : (stats.length > 0 ? stats[stats.length - 1].count : 0)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                        <RefreshCw className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">సగటున రోజుకి</p>
                        <p className="text-3xl font-black text-gray-900">{loading ? '...' : Math.round(totalScraped / 7)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">రోజువారీ చార్ట్ (Daily Chart)</h2>
                <div className="h-[400px] w-full">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 14 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 14 }} dx={-10} />
                                <Tooltip 
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="count" name="వార్తల సంఖ్య" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScraperStatsPage;
