import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, getDocs, query, orderBy, doc, updateDoc, where, limit, startAfter } = _firestore as any;

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
);

interface ReporterManagementPageProps {
    currentUser: User;
}

export interface ReporterWithCounts extends User {
    totalNewsCount?: number;
    lastWeekNewsCount?: number;
    todayNewsCount?: number;
}

type SortField = 'state' | 'district' | 'name' | 'totalNewsCount' | 'lastWeekNewsCount' | 'todayNewsCount';

const ReporterManagementPage: React.FC<ReporterManagementPageProps> = ({ currentUser }) => {
    const [reporters, setReporters] = useState<ReporterWithCounts[]>([]);
    const [filteredReporters, setFilteredReporters] = useState<ReporterWithCounts[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingReporters, setUpdatingReporters] = useState<Record<string, boolean>>({});
    
    const [sortField, setSortField] = useState<SortField>('totalNewsCount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const fetchReporters = useCallback(async () => {
        setLoading(true);
        try {
            const usersCollectionRef = collection(db, 'users');
            // Fetch users with roles appropriate for reporters
            const q = query(
                usersCollectionRef, 
                where('role', 'in', [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE])
            );
            
            const querySnapshot = await getDocs(q);
            const fetchedReporters = await Promise.all(querySnapshot.docs.map(async (userDoc: any) => {
                const userData = {
                    id: userDoc.id,
                    ...userDoc.data()
                } as ReporterWithCounts;

                try {
                    const newsRef = collection(db, 'news');
                    const totalQuery = query(newsRef, where('reporter.id', '==', userData.id));
                    const totalSnap = await getDocs(totalQuery);
                    userData.totalNewsCount = totalSnap.size;

                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);

                    const startOfLastWeek = new Date();
                    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
                    startOfLastWeek.setHours(0, 0, 0, 0);

                    let todayCount = 0;
                    let lastWeekCount = 0;

                    totalSnap.forEach((doc: any) => {
                        const data = doc.data();
                        let date: Date | null = null;
                        if (data.timestamp?.toDate) {
                            date = data.timestamp.toDate();
                        } else if (data.timestamp?.seconds) {
                            date = new Date(data.timestamp.seconds * 1000);
                        } else if (typeof data.timestamp === 'number') {
                            date = new Date(data.timestamp);
                        }
                        
                        if (date) {
                            if (date >= startOfToday) {
                                todayCount++;
                            }
                            if (date >= startOfLastWeek && date < startOfToday) {
                                lastWeekCount++;
                            }
                        }
                    });
                    
                    userData.todayNewsCount = todayCount;
                    userData.lastWeekNewsCount = lastWeekCount;
                } catch (countError) {
                    console.error(`Error fetching counts for user ${userData.id}:`, countError);
                    userData.totalNewsCount = 0;
                    userData.todayNewsCount = 0;
                    userData.lastWeekNewsCount = 0;
                }

                return userData;
            }));
            
            setReporters(fetchedReporters);
        } catch (error) {
            console.error("Error fetching reporters:", error);
            alert("రిపోర్టర్లను పొందడంలో లోపం ఏర్పడింది.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchReporters();
    }, [fetchReporters]);

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        let baseList = reporters;
        
        if (currentUser.role === UserRole.STAFF_REPORTER || currentUser.role === UserRole.REGIONAL_INCHARGE) {
            baseList = reporters.filter(u => u.promotedBy === currentUser.id || u.id === currentUser.id);
        }

        let filteredData = baseList.filter(user =>
            (user.name || '').toLowerCase().includes(lowercasedFilter) ||
            (user.phone || '').toLowerCase().includes(lowercasedFilter) ||
            (user.district || '').toLowerCase().includes(lowercasedFilter)
        );

        filteredData.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === 'name' || sortField === 'state' || sortField === 'district') {
                aVal = (a[sortField] || '').toString().toLowerCase();
                bVal = (b[sortField] || '').toString().toLowerCase();
            } else {
                aVal = (aVal as number) || 0;
                bVal = (bVal as number) || 0;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredReporters([...filteredData]);
    }, [searchTerm, reporters, currentUser, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleUpdateAlternatePhone = async (userId: string, newPhone: string) => {
        setUpdatingReporters(prev => ({ ...prev, [userId]: true }));
        try {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, { alternatePhone: newPhone });
            setReporters(prevReporters => prevReporters.map(user => user.id === userId ? { ...user, alternatePhone: newPhone } : user));
        } catch(e: any) {
            alert("అప్‌డేట్ విఫలమైంది: " + e.message);
        } finally {
            setUpdatingReporters(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleUpdateRole = async (userId: string, newRole: UserRole) => {
        if (!window.confirm("మీరు నిజంగా ఈ యూజర్ హోదా మార్చాలనుకుంటున్నారా?")) return;
        setUpdatingReporters(prev => ({ ...prev, [userId]: true }));
        try {
            const userDocRef = doc(db, 'users', userId);
            const updates: any = { role: newRole };
            if (newRole === UserRole.REPORTER) {
                updates.warningLevel = 0;
                updates.inProbation = false;
                updates.previouslyDowngraded = false;
                updates.suspended = false;
                updates.promotedAt = new Date();
                updates.lastPostTimestamp = new Date();
                updates.rejoinedAt = new Date();
            }
            await updateDoc(userDocRef, updates);
            setReporters(prevReporters => prevReporters.map(user => user.id === userId ? { ...user, role: newRole } : user));
        } catch(e: any) {
            alert("హోదా అప్‌డేట్ విఫలమైంది: " + e.message);
        } finally {
            setUpdatingReporters(prev => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <div className="w-full bg-white">
            <div className="mb-6 pb-2 border-b border-gray-200 space-y-4">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                       <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder="పేరు, ఫోన్ లేదా జిల్లా ద్వారా శోధించండి..."
                        value={searchTerm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg py-3 pl-10 pr-4 text-xl focus:ring-2 focus:ring-red-500"
                    />
                </div>
            </div>

            {loading ? (
                <p className="text-center text-gray-500 text-xl">రిపోర్టర్లు లోడ్ అవుతున్నారు...</p>
            ) : (
                <div className="overflow-x-auto w-full">
                    <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-100">
                            <tr>
                                <th scope="col" onClick={() => handleSort('state')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                                    రాష్ట్రం {sortField === 'state' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th scope="col" onClick={() => handleSort('district')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                                    జిల్లా {sortField === 'district' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th scope="col" onClick={() => handleSort('name')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                                    పేరు {sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th scope="col" className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">లాగిన్ ఫోన్</th>
                                <th scope="col" className="px-4 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">రెండో కాంటాక్ట్</th>
                                <th scope="col" onClick={() => handleSort('totalNewsCount')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-blue-700 uppercase tracking-wider hover:bg-gray-200">
                                    మొత్తం వార్తలు {sortField === 'totalNewsCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th scope="col" onClick={() => handleSort('lastWeekNewsCount')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-orange-700 uppercase tracking-wider hover:bg-gray-200">
                                    గత వారం {sortField === 'lastWeekNewsCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th scope="col" onClick={() => handleSort('todayNewsCount')} className="cursor-pointer px-4 py-4 text-left text-sm font-bold text-green-700 uppercase tracking-wider hover:bg-gray-200">
                                    ఈ రోజు {sortField === 'todayNewsCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredReporters.length > 0 ? filteredReporters.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-5 whitespace-nowrap text-base text-gray-900">
                                        {user.state || 'N/A'}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-base text-gray-900">
                                        {user.district || 'N/A'}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-12 w-12">
                                                <img className="h-12 w-12 rounded-full" src={user.photoUrl || `https://i.pravatar.cc/40?u=${user.id}`} alt="" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-base font-bold text-gray-900">{user.name}</div>
                                                <div className="text-base text-gray-500 mt-1">
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                                                        className="block w-full pl-2 pr-8 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 rounded-md"
                                                        disabled={updatingReporters[user.id] || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.REGIONAL_INCHARGE && currentUser.role !== UserRole.STAFF_REPORTER)}
                                                    >
                                                        <option value={UserRole.REPORTER}>రిపోర్టర్ (Reporter)</option>
                                                        <option value={UserRole.STAFF_REPORTER}>జిల్లా ఇంచార్జ్ (Staff Reporter)</option>
                                                        <option value={UserRole.REGIONAL_INCHARGE}>నియోజకవర్గం ఇంచార్జ్ (Regional Incharge)</option>
                                                        <option value={UserRole.GUEST}>పదవి తొలగింపు (Remove Role)</option>
                                                        <option value={UserRole.SUBSCRIBER}>సబ్‌స్క్రైబర్ (Subscriber)</option>
                                                        {currentUser.role === UserRole.ADMIN && <option value={UserRole.ADMIN}>అడ్మిన్ (Admin)</option>}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-base font-medium text-gray-900">
                                        {user.phone || 'N/A'}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-base text-gray-900">
                                        <input 
                                            type="text" 
                                            defaultValue={user.alternatePhone || ''} 
                                            onBlur={(e) => {
                                                if (e.target.value !== user.alternatePhone) {
                                                    handleUpdateAlternatePhone(user.id, e.target.value);
                                                }
                                            }}
                                            placeholder="+91..."
                                            className="border border-gray-300 rounded px-3 py-1.5 w-36 focus:ring-red-500 text-base"
                                        />
                                        {updatingReporters[user.id] && <span className="ml-2 text-red-500 text-xs">...</span>}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-lg font-bold text-blue-600">
                                        {user.totalNewsCount || 0}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-lg font-bold text-orange-600">
                                        {user.lastWeekNewsCount || 0}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-lg font-bold text-green-600">
                                        {user.todayNewsCount || 0}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                        రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ReporterManagementPage;
