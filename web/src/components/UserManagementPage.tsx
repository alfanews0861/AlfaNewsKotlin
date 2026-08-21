
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, getDocs, query, orderBy, doc, updateDoc, where, limit, startAfter } = _firestore as any;

// Search Icon
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
);

const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'Invalid Date';
    try {
        let date: Date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }
        
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        return `${date.toLocaleDateString('te-IN')} ${date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
        return 'Invalid Date';
    }
};

interface UserManagementPageProps {
    currentUser: User;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [editors, setEditors] = useState<User[]>([]); // For Admins to assign reporters
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingUsers, setUpdatingUsers] = useState<Record<string, boolean>>({});
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [selectedReporter, setSelectedReporter] = useState<User | null>(null);
    const [reporterNews, setReporterNews] = useState<any[]>([]);
    const [loadingNews, setLoadingNews] = useState(false);
    const [showNewsModal, setShowNewsModal] = useState(false);

    const fetchUsers = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            const usersCollectionRef = collection(db, 'users');
            let q;
            
            const constraints = [orderBy(sortBy, sortOrder), limit(50)];
            if (isLoadMore && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }
            
            q = query(usersCollectionRef, ...constraints);
            
            const querySnapshot = await getDocs(q);
            const fetchedUsers = await Promise.all(querySnapshot.docs.map(async (doc: any) => {
                const userData = {
                    id: doc.id,
                    ...doc.data()
                } as User;

                // Fetch news counts for reporters
                if (userData.role !== UserRole.GUEST && userData.role !== UserRole.SUBSCRIBER) {
                    try {
                        const newsRef = collection(db, 'news');
                        
                        // Total count
                        const totalQuery = query(newsRef, where('reporter.id', '==', userData.id));
                        const totalSnap = await getDocs(totalQuery);
                        userData.totalNewsCount = totalSnap.size;

                        // Today's count
                        const startOfToday = new Date();
                        startOfToday.setHours(0, 0, 0, 0);
                        
                        let todayCount = 0;
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
                            
                            if (date && date >= startOfToday) {
                                todayCount++;
                            }
                        });
                        userData.todayNewsCount = todayCount;
                    } catch (countError) {
                        console.error(`Error fetching counts for user ${userData.id}:`, countError);
                        userData.totalNewsCount = 0;
                        userData.todayNewsCount = 0;
                    }
                }

                return userData;
            }));
            
            if (isLoadMore) {
                setUsers(prev => [...prev, ...fetchedUsers]);
            } else {
                setUsers(fetchedUsers);
            }
            
            setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
            setHasMore(querySnapshot.docs.length === 50);

            // For Admins: Populate Editors List (we might need a separate fetch for this if we paginate)
            if (currentUser.role === UserRole.ADMIN && !isLoadMore) {
                const editorsQuery = query(collection(db, 'users'), where('role', 'in', [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE]));
                const editorsSnap = await getDocs(editorsQuery);
                setEditors(editorsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as User)));
            }

        } catch (error) {
            console.error("Error fetching users:", error);
            alert("వినియోగదారులను పొందడంలో లోపం ఏర్పడింది. దయచేసి ఫైర్‌స్టోర్ రూల్స్‌ను తనిఖీ చేయండి.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [currentUser, sortBy, sortOrder, lastDoc]);

    useEffect(() => {
        setLastDoc(null);
        fetchUsers(false);
    }, [sortBy, sortOrder]); // Re-fetch when sort changes

    // Client-side search filtering
    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        let baseList = users;
        
        if (currentUser.role === UserRole.STAFF_REPORTER || currentUser.role === UserRole.REGIONAL_INCHARGE) {
            baseList = users.filter(u => 
                u.role === UserRole.SUBSCRIBER || 
                (u.role === UserRole.REPORTER && u.promotedBy === currentUser.id)
            );
        }

        const filteredData = baseList.filter(user =>
            (user.name || '').toLowerCase().includes(lowercasedFilter) ||
            (user.email && user.email.toLowerCase().includes(lowercasedFilter)) ||
            (user.phone && user.phone.toLowerCase().includes(lowercasedFilter))
        );
        setFilteredUsers(filteredData);
    }, [searchTerm, users, currentUser]);

    const handlePromoteToReporter = async (userId: string) => {
        if (!window.confirm("ఈ వినియోగదారుని రిపోర్టర్‌గా మార్చాలనుకుంటున్నారా?")) return;
        
        setUpdatingUsers(prev => ({ ...prev, [userId]: true }));
        try {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, { 
                role: UserRole.REPORTER,
                promotedBy: currentUser.id, // Link the reporter to this Editor/Admin
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false,
                promotedAt: new Date(),
                lastPostTimestamp: new Date(),
                rejoinedAt: new Date()
            });
            
            // Update local state
            setUsers(prevUsers => prevUsers.map(user => 
                user.id === userId ? { ...user, role: UserRole.REPORTER, promotedBy: currentUser.id } : user
            ));
            alert('వినియోగదారు ఇప్పుడు రిపోర్టర్!');
        } catch (error: any) {
            console.error(error);
            alert("అప్‌డేట్ విఫలమైంది: " + error.message);
        } finally {
            setUpdatingUsers(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleReassignReporter = async (reporterId: string, newEditorId: string) => {
        setUpdatingUsers(prev => ({ ...prev, [reporterId]: true }));
        try {
            const userDocRef = doc(db, 'users', reporterId);
            const updates: any = { promotedBy: newEditorId };
            await updateDoc(userDocRef, updates);
            
             // Update local state
             setUsers(prevUsers => prevUsers.map(user => 
                user.id === reporterId ? { ...user, promotedBy: newEditorId } : user
            ));
            alert("రిపోర్టర్ విజయవంతంగా రీ-అసైన్ చేయబడ్డారు.");
        } catch (error: any) {
             console.error(error);
             alert("రీ-అసైన్ విఫలమైంది: " + error.message);
        } finally {
            setUpdatingUsers(prev => ({ ...prev, [reporterId]: false }));
        }
    };

    const handleRoleChangeAdmin = async (userId: string, newRole: UserRole) => {
         setUpdatingUsers(prev => ({ ...prev, [userId]: true }));
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
             setUsers(prevUsers => prevUsers.map(user => user.id === userId ? { ...user, role: newRole } : user));
         } catch(e: any) {
             alert("Role update failed: " + e.message);
         } finally {
             setUpdatingUsers(prev => ({ ...prev, [userId]: false }));
         }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case UserRole.ADMIN: return 'bg-red-200 text-red-800';
            case UserRole.REGIONAL_INCHARGE: return 'bg-orange-200 text-orange-800';
            case UserRole.STAFF_REPORTER: return 'bg-purple-200 text-purple-800';
            case UserRole.REPORTER: return 'bg-blue-200 text-blue-800';
            case UserRole.SUBSCRIBER: return 'bg-green-200 text-green-800';
            default: return 'bg-gray-200 text-gray-800';
        }
    };
    
    const availableRoles = [UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN];

    const handleReporterClick = async (reporter: User) => {
        if (reporter.role === UserRole.GUEST || reporter.role === UserRole.SUBSCRIBER) return;
        
        setSelectedReporter(reporter);
        setShowNewsModal(true);
        setLoadingNews(true);
        setReporterNews([]);

        try {
            const newsRef = collection(db, 'news');
            const q = query(newsRef, where('reporter.id', '==', reporter.id), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const newsData = querySnapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setReporterNews(newsData);
        } catch (error) {
            console.error("Error fetching reporter news:", error);
            alert("వార్తలను పొందడంలో లోపం ఏర్పడింది.");
        } finally {
            setLoadingNews(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            {/* Search Bar & Sorting */}
            <div className="mb-6 space-y-4">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                       <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder="పేరు, ఈమెయిల్ లేదా ఫోన్ నంబర్ ద్వారా శోధించండి..."
                        value={searchTerm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg py-3 pl-10 pr-4 text-xl focus:ring-2 focus:ring-red-500"
                    />
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-gray-600 font-medium">సార్టింగ్:</span>
                    <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                    >
                        <option value="name">పేరు</option>
                        <option value="createdAt">మొదటి లాగిన్</option>
                        <option value="lastLogin">తాజా లాగిన్</option>
                        <option value="role">హోదా (Role)</option>
                    </select>
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                    >
                        <option value="asc">తక్కువ నుండి ఎక్కువ (A-Z)</option>
                        <option value="desc">ఎక్కువ నుండి తక్కువ (Z-A)</option>
                    </select>
                </div>
            </div>

            {/* Users List - Removed fixed height/scroll to allow full page scroll */}
            {loading ? (
                <p className="text-center text-gray-500 text-xl">వినియోగదారులు లోడ్ అవుతున్నారు...</p>
            ) : (
                <div className="space-y-3">
                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
                        <div key={user.id} className="flex flex-col md:flex-row justify-between items-center bg-gray-50 p-4 rounded-lg border">
                            <div className="flex items-center mb-3 md:mb-0 text-left w-full md:w-auto min-w-0">
                                <img src={user.photoUrl || `https://i.pravatar.cc/40?u=${user.id}`} alt={user.name} className="w-12 h-12 rounded-full mr-4 shrink-0" />
                                <div className="truncate text-xl">
                                    <p 
                                        className={`font-semibold truncate break-all ${user.role !== UserRole.GUEST && user.role !== UserRole.SUBSCRIBER ? 'text-blue-600 cursor-pointer hover:underline' : 'text-gray-800'}`}
                                        onClick={() => handleReporterClick(user)}
                                    >
                                        {user.name}
                                    </p>
                                    <p className="text-lg text-gray-500 truncate break-all">{user.email || 'No email'}</p>
                                    <p className="text-lg text-gray-500 truncate break-all">ఫోన్ నంబర్: {user.phone || 'నంబర్ లేదు'}</p>
                                    
                                    {/* Display News Counts for Reporters */}
                                    {user.role !== UserRole.GUEST && user.role !== UserRole.SUBSCRIBER && (
                                        <div className="flex gap-4 mt-2 mb-1">
                                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-100 text-sm font-medium">
                                                ఇప్పటి వరకు: {user.totalNewsCount || 0}
                                            </div>
                                            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-md border border-green-100 text-sm font-medium">
                                                ఈ రోజు: {user.todayNewsCount || 0}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        {user.createdAt && (
                                            <p className="text-xs text-gray-400">
                                                మొదటి లాగిన్: {formatDateTime(user.createdAt)}
                                            </p>
                                        )}
                                        {user.lastLogin && (
                                            <p className="text-xs text-blue-500 font-medium">
                                                తాజా లాగిన్: {formatDateTime(user.lastLogin)}
                                            </p>
                                        )}
                                    </div>
                                    {currentUser.role === UserRole.ADMIN && user.role === UserRole.REPORTER && (
                                        <p className="text-xs text-gray-400">Promoted By: {users.find(u => u.id === user.promotedBy)?.name || 'Admin/Unknown'}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 shrink-0 flex-wrap justify-end gap-y-2">
                                <span className={`text-base font-semibold px-2.5 py-1 rounded-full ${getRoleBadgeColor(user.role)}`}>
                                    {user.role}
                                </span>

                                {/* STAFF_REPORTER / REGIONAL_INCHARGE VIEW ACTIONS */}
                                {(currentUser.role === UserRole.STAFF_REPORTER || currentUser.role === UserRole.REGIONAL_INCHARGE) && (
                                    <>
                                        {user.role === UserRole.SUBSCRIBER && (
                                            <button 
                                                onClick={() => handlePromoteToReporter(user.id)}
                                                disabled={updatingUsers[user.id]}
                                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 text-lg"
                                            >
                                                Make Reporter
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* ADMIN VIEW ACTIONS */}
                                {currentUser.role === UserRole.ADMIN && (
                                    <div className="flex flex-col items-end gap-2">
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChangeAdmin(user.id, e.target.value as UserRole)}
                                            disabled={updatingUsers[user.id]}
                                            className="border border-gray-300 rounded-md p-1.5 text-lg"
                                        >
                                            {availableRoles.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                        
                                        {/* Reassign Reporter Logic */}
                                        {user.role === UserRole.REPORTER && (
                                            <select
                                                value={user.promotedBy || ""}
                                                onChange={(e) => handleReassignReporter(user.id, e.target.value)}
                                                className="border border-gray-300 rounded-md p-1.5 text-sm w-40"
                                            >
                                                <option value="ADMIN">Assign to Admin</option>
                                                {editors.map(ed => (
                                                    <option key={ed.id} value={ed.id}>Manager: {ed.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}
                                
                                {updatingUsers[user.id] && <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>}
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 text-xl">వినియోగదారులు ఎవరూ కనుగొనబడలేదు.</p>
                    )}

                    {hasMore && (
                        <div className="pt-4 flex justify-center">
                            <button 
                                onClick={() => fetchUsers(true)}
                                disabled={loadingMore}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-full transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? 'లోడ్ అవుతోంది...' : 'మరిన్ని చూడండి (Load More)'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Reporter News Modal */}
            {showNewsModal && selectedReporter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {selectedReporter.name} పోస్ట్ చేసిన వార్తలు
                            </h2>
                            <button 
                                onClick={() => setShowNewsModal(false)}
                                className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {loadingNews ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : reporterNews.length > 0 ? (
                                <div className="space-y-4">
                                    {reporterNews.map((news) => (
                                        <div key={news.id} className="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{news.headline?.telugu || news.headline?.english || 'శీర్షిక లేదు'}</h3>
                                            <div className="flex justify-between items-center text-sm text-gray-500">
                                                <span>{formatDateTime(news.timestamp)}</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs">{news.categories?.[0] || 'సాధారణం'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8 text-lg">ఈ రిపోర్టర్ ఇంకా ఎలాంటి వార్తలు పోస్ట్ చేయలేదు.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;
