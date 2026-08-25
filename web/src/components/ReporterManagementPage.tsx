
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, deleteDoc, where, onSnapshot } = _firestore as any;

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
  assignedMandal?: string;
}

type SortField = 'state' | 'district' | 'name' | 'totalNewsCount' | 'lastWeekNewsCount' | 'todayNewsCount';

const ReporterManagementPage: React.FC<ReporterManagementPageProps> = ({ currentUser }) => {
  const [selectedTab, setSelectedTab] = useState<'applications' | 'reporters'>('applications');

  // Applications State
  const [applications, setApplications] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState<'PENDING' | 'JOINED' | 'REJECTED' | 'ALL'>('PENDING');
  const [appSearch, setAppSearch] = useState('');
  const [loadingApps, setLoadingApps] = useState(true);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);
  const [occupiedMandals, setOccupiedMandals] = useState<Record<string, string>>({});

  // Active Reporters State
  const [reporters, setReporters] = useState<ReporterWithCounts[]>([]);
  const [filteredReporters, setFilteredReporters] = useState<ReporterWithCounts[]>([]);
  const [loadingReporters, setLoadingReporters] = useState(true);
  const [reporterSearch, setReporterSearch] = useState('');
  const [updatingReporters, setUpdatingReporters] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('totalNewsCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch Applications and Occupied Mandals
  const fetchApplications = useCallback(async () => {
    setLoadingApps(true);
    try {
      // 1. Fetch active reporters to map occupied mandals
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('role', 'in', [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, 'REPORTER', 'reporter']))
      );
      
      const occMap: Record<string, string> = {};
      usersSnap.docs.forEach((uDoc: any) => {
        const u = uDoc.data();
        const dist = (u.district || '').trim();
        const mandal = (u.assignedMandal || u.mandal || '').trim();
        if (dist && mandal) {
          occMap[`${dist}|${mandal}`] = u.name || 'Active Reporter';
        }
      });
      setOccupiedMandals(occMap);

      // 2. Fetch applications
      const appsSnap = await getDocs(collection(db, 'reporter_applications'));
      const list: any[] = appsSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));

      list.sort((a, b) => {
        const aTs = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
        const bTs = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
        return bTs - aTs;
      });

      setApplications(list);
    } catch (e: any) {
      console.error('Error fetching applications:', e);
    } finally {
      setLoadingApps(false);
    }
  }, []);

  // Fetch Active Reporters
  const fetchReporters = useCallback(async () => {
    setLoadingReporters(true);
    try {
      const q = query(
        collection(db, 'users'),
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

          totalSnap.forEach((docSnap: any) => {
            const data = docSnap.data();
            let date: Date | null = null;
            if (data.timestamp?.toDate) {
              date = data.timestamp.toDate();
            } else if (data.timestamp?.seconds) {
              date = new Date(data.timestamp.seconds * 1000);
            } else if (typeof data.timestamp === 'number') {
              date = new Date(data.timestamp);
            }

            if (date) {
              if (date >= startOfToday) todayCount++;
              if (date >= startOfLastWeek && date < startOfToday) lastWeekCount++;
            }
          });

          userData.todayNewsCount = todayCount;
          userData.lastWeekNewsCount = lastWeekCount;
        } catch {
          userData.totalNewsCount = 0;
          userData.todayNewsCount = 0;
          userData.lastWeekNewsCount = 0;
        }

        return userData;
      }));

      setReporters(fetchedReporters);
    } catch (error) {
      console.error('Error fetching reporters:', error);
    } finally {
      setLoadingReporters(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === 'applications') {
      fetchApplications();
    } else {
      fetchReporters();
    }
  }, [selectedTab, fetchApplications, fetchReporters]);

  // Filter Active Reporters
  useEffect(() => {
    const lower = reporterSearch.toLowerCase();
    let list = reporters.filter(u =>
      (u.name || '').toLowerCase().includes(lower) ||
      (u.phone || '').toLowerCase().includes(lower) ||
      (u.district || '').toLowerCase().includes(lower) ||
      (u.assignedMandal || '').toLowerCase().includes(lower)
    );

    list.sort((a, b) => {
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

    setFilteredReporters([...list]);
  }, [reporterSearch, reporters, sortField, sortDirection]);

  // Handle Application Approval
  const handleApproveApp = async (app: any) => {
    if (!window.confirm(`మీరు ఖచ్చితంగా ${app.name} దరఖాస్తును ఆమోదించి, రిపోర్టర్‌గా నియమించాలనుకుంటున్నారా?`)) return;
    setProcessingAppId(app.id);

    try {
      const targetUserId = app.userId || app.id;
      const targetDistrict = app.district || app.state_district || '';
      const targetMandal = app.mandal || '';

      // 1. Update user document to REPORTER role
      await updateDoc(doc(db, 'users', targetUserId), {
        role: UserRole.REPORTER,
        district: targetDistrict,
        assignedMandal: targetMandal,
        name: app.name || 'Reporter',
        phone: app.phone || '',
        promotedAt: Date.now()
      }).catch(async () => {
        // Fallback setDoc if user doc doesn't exist
        await setDoc(doc(db, 'users', targetUserId), {
          role: UserRole.REPORTER,
          district: targetDistrict,
          assignedMandal: targetMandal,
          name: app.name || 'Reporter',
          phone: app.phone || '',
          promotedAt: Date.now()
        }, { merge: true });
      });

      // 2. Mark application status as JOINED/APPROVED
      await updateDoc(doc(db, 'reporter_applications', app.id), {
        status: 'JOINED',
        approvedAt: Date.now(),
        approvedBy: currentUser.name || 'Admin'
      });

      alert(`${app.name} దరఖాస్తు విజయవంతంగా ఆమోదించబడింది!`);
      fetchApplications();
    } catch (e: any) {
      alert(`ఆమోదించడంలో లోపం: ${e.message}`);
    } finally {
      setProcessingAppId(null);
    }
  };

  // Handle Application Rejection
  const handleRejectApp = async (app: any) => {
    if (!window.confirm(`మీరు ఖచ్చితంగా ${app.name} దరఖాస్తును తిరస్కరించాలనుకుంటున్నారా?`)) return;
    setProcessingAppId(app.id);

    try {
      await updateDoc(doc(db, 'reporter_applications', app.id), {
        status: 'REJECTED',
        rejectedAt: Date.now(),
        rejectedBy: currentUser.name || 'Admin'
      });
      fetchApplications();
    } catch (e: any) {
      alert(`తిరస్కరించడంలో లోపం: ${e.message}`);
    } finally {
      setProcessingAppId(null);
    }
  };

  // Handle Application Deletion
  const handleDeleteApp = async (appId: string) => {
    if (!window.confirm('ఈ దరఖాస్తును ఖచ్చితంగా తొలగించాలా?')) return;
    try {
      await deleteDoc(doc(db, 'reporter_applications', appId));
      fetchApplications();
    } catch (e: any) {
      alert(`తొలగించడంలో లోపం: ${e.message}`);
    }
  };

  // Update Reporter Role
  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (!window.confirm('మీరు నిజంగా ఈ యూజర్ హోదా మార్చాలనుకుంటున్నారా?')) return;
    setUpdatingReporters(prev => ({ ...prev, [userId]: true }));
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setReporters(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e: any) {
      alert('హోదా అప్‌డేట్ విఫలమైంది: ' + e.message);
    } finally {
      setUpdatingReporters(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Filtered Applications List
  const filteredApps = applications.filter(app => {
    const status = (app.status || 'PENDING').toUpperCase();
    if (appFilter === 'PENDING' && (status === 'JOINED' || status === 'APPROVED' || status === 'REJECTED')) {
      return false;
    }
    if (appFilter === 'JOINED' && (status !== 'JOINED' && status !== 'APPROVED')) {
      return false;
    }
    if (appFilter === 'REJECTED' && status !== 'REJECTED') {
      return false;
    }

    if (appSearch) {
      const q = appSearch.toLowerCase();
      return (
        (app.name || '').toLowerCase().includes(q) ||
        (app.phone || '').toLowerCase().includes(q) ||
        (app.district || app.state_district || '').toLowerCase().includes(q) ||
        (app.mandal || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full bg-white font-mallanna text-black animate-fade-in pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-6 rounded-[2rem] mb-6 flex flex-col md:flex-row justify-between items-center shadow-xl text-white gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-ramabhadra leading-tight">రిపోర్టర్ల నిర్వహణ (Reporter Management)</h2>
            <p className="text-teal-100 text-sm font-bold uppercase tracking-wider">దరఖాస్తుల పరిశీలన & యాక్టివ్ రిపోర్టర్ల కంట్రోల్</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-white/20 p-1.5 rounded-2xl backdrop-blur-sm gap-1">
          <button
            onClick={() => setSelectedTab('applications')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              selectedTab === 'applications' ? 'bg-white text-teal-900 shadow-md' : 'text-white hover:bg-white/10'
            }`}
          >
            📋 దరఖాస్తులు ({applications.filter(a => (a.status || 'PENDING').toUpperCase() === 'PENDING').length})
          </button>
          <button
            onClick={() => setSelectedTab('reporters')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              selectedTab === 'reporters' ? 'bg-white text-teal-900 shadow-md' : 'text-white hover:bg-white/10'
            }`}
          >
            👥 యాక్టివ్ రిపోర్టర్లు ({reporters.length})
          </button>
        </div>
      </div>

      {/* TAB 1: APPLICATIONS */}
      {selectedTab === 'applications' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAppFilter('PENDING')}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  appFilter === 'PENDING' ? 'bg-teal-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                పెండింగ్ (Pending)
              </button>
              <button
                onClick={() => setAppFilter('JOINED')}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  appFilter === 'JOINED' ? 'bg-green-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ఆమోదించినవి (Joined)
              </button>
              <button
                onClick={() => setAppFilter('REJECTED')}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  appFilter === 'REJECTED' ? 'bg-red-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                తిరస్కరించినవి (Rejected)
              </button>
              <button
                onClick={() => setAppFilter('ALL')}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  appFilter === 'ALL' ? 'bg-gray-800 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                మొత్తం (All)
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="పేరు, ఫోన్ లేదా మండలం..."
                value={appSearch}
                onChange={e => setAppSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-xl py-2 pl-9 pr-3 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Applications Cards */}
          {loadingApps ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] border text-center text-gray-400 font-bold">
              దరఖాస్తులు ఏవీ కనుగొనబడలేదు.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredApps.map(app => {
                const status = (app.status || 'PENDING').toUpperCase();
                const isPending = status !== 'JOINED' && status !== 'APPROVED' && status !== 'REJECTED';
                const dist = app.district || app.state_district || 'N/A';
                const mandal = app.mandal || 'N/A';
                const occupiedBy = occupiedMandals[`${dist}|${mandal}`];

                return (
                  <div
                    key={app.id}
                    className="bg-white p-5 rounded-[2rem] border border-gray-200 shadow-sm hover:border-teal-300 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-lg">
                            {app.name ? app.name.charAt(0).toUpperCase() : 'A'}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{app.name}</h3>
                            <p className="text-sm font-semibold text-gray-600">{app.phone || app.phoneNumber || 'ఫోన్ లేదు'}</p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                            status === 'JOINED' || status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Location details */}
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1 my-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">జిల్లా:</span>
                          <span className="font-bold text-gray-800">{dist}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">మండలం:</span>
                          <span className="font-bold text-gray-800">{mandal}</span>
                        </div>
                        {app.education && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">విద్యార్హత:</span>
                            <span className="font-bold text-gray-800">{app.education}</span>
                          </div>
                        )}
                        {app.experience && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">అనుభవం:</span>
                            <span className="font-bold text-gray-800">{app.experience}</span>
                          </div>
                        )}
                      </div>

                      {/* Occupied Mandal Warning */}
                      {occupiedBy && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800">
                          ⚠️ ఈ మండలంలో ఇప్పటికే రిపోర్టర్ ఉన్నారు: <span className="underline">{occupiedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 border-t pt-3">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleApproveApp(app)}
                            disabled={processingAppId === app.id}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            {processingAppId === app.id ? '...' : 'ఆమోదించు (Approve)'}
                          </button>
                          <button
                            onClick={() => handleRejectApp(app)}
                            disabled={processingAppId === app.id}
                            className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                          >
                            తిరస్కరించు (Reject)
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteApp(app.id)}
                        className="text-gray-400 hover:text-red-600 p-2 text-sm"
                        title="Delete application"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REPORTERS */}
      {selectedTab === 'reporters' && (
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="పేరు, ఫోన్ లేదా జిల్లా ద్వారా శోధించండి..."
              value={reporterSearch}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReporterSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-2xl py-3 pl-10 pr-4 text-base focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>

          {loadingReporters ? (
            <p className="text-center text-gray-500 text-lg py-12">రిపోర్టర్లు లోడ్ అవుతున్నారు...</p>
          ) : (
            <div className="overflow-x-auto w-full border rounded-2xl shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" onClick={() => { setSortField('state'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                      రాష్ట్రం
                    </th>
                    <th scope="col" onClick={() => { setSortField('district'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                      జిల్లా
                    </th>
                    <th scope="col" onClick={() => { setSortField('name'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-200">
                      పేరు / హోదా
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ఫోన్</th>
                    <th scope="col" onClick={() => { setSortField('totalNewsCount'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer px-4 py-3.5 text-left text-xs font-bold text-blue-700 uppercase tracking-wider hover:bg-gray-200">
                      మొత్తం వార్తలు
                    </th>
                    <th scope="col" onClick={() => { setSortField('todayNewsCount'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer px-4 py-3.5 text-left text-xs font-bold text-green-700 uppercase tracking-wider hover:bg-gray-200">
                      ఈ రోజు
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReporters.length > 0 ? (
                    filteredReporters.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.state || 'TS'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {user.district || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">
                              {user.name ? user.name.charAt(0).toUpperCase() : 'R'}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-bold text-gray-900">{user.name}</div>
                              <div className="mt-1">
                                <select
                                  value={user.role}
                                  onChange={e => handleUpdateRole(user.id, e.target.value as UserRole)}
                                  className="text-xs border border-gray-300 px-2 py-1 rounded-lg font-semibold bg-gray-50 outline-none"
                                  disabled={updatingReporters[user.id]}
                                >
                                  <option value={UserRole.REPORTER}>రిపోర్టర్ (Reporter)</option>
                                  <option value={UserRole.STAFF_REPORTER}>స్టాఫ్ రిపోర్టర్ (Staff Reporter)</option>
                                  <option value={UserRole.REGIONAL_INCHARGE}>ఇంచార్జ్ (Regional Incharge)</option>
                                  <option value={UserRole.SUBSCRIBER}>హోదా తొలగించు (Remove)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {user.phone || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-base font-black text-blue-600">
                          {user.totalNewsCount || 0}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-base font-black text-green-600">
                          {user.todayNewsCount || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 font-bold">
                        రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReporterManagementPage;
