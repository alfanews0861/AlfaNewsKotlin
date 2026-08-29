import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, ReporterConversation, ReporterMessage } from '../types';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const {
  collection,
  getDocs,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  writeBatch,
  serverTimestamp
} = _firestore as any;

const { getFunctions, httpsCallable } = _functions as any;

interface AdminReporterMessagingPageProps {
  currentUser: User;
  initialReporterId?: string | null;
  onBackToPanel?: () => void;
}

const AdminReporterMessagingPage: React.FC<AdminReporterMessagingPageProps> = ({
  currentUser,
  initialReporterId,
  onBackToPanel
}) => {
  const isAdmin = [
    UserRole.ADMIN,
    UserRole.STAFF_REPORTER,
    UserRole.REGIONAL_INCHARGE
  ].includes(currentUser.role) || (currentUser.email === 'alfanews0861@gmail.com');

  const [conversations, setConversations] = useState<ReporterConversation[]>([]);
  const [allReporters, setAllReporters] = useState<User[]>([]);
  const [activeReporter, setActiveReporter] = useState<ReporterConversation | null>(null);
  const [messages, setMessages] = useState<ReporterMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [messageType, setMessageType] = useState<'CHAT' | 'WARNING' | 'BROADCAST'>('CHAT');
  
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<number>(0); // 0: Conversations, 1: All Reporters, 2: Warnings
  const [conversationFilter, setConversationFilter] = useState<string>('ALL'); // 'ALL' | 'UNREAD_ADMIN' | 'UNREAD_REPORTER' | 'READ' | 'WARNINGS'
  
  // Broadcast announcement modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('అల్ఫా న్యూస్ రిపోర్టర్లకు ముఖ్య ప్రకటన 📢');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Unread summary metrics
  const unreadAdminCount = conversations.reduce((acc, c) => acc + (c.unreadCountForAdmin || 0), 0);
  const unreadReporterCount = conversations.filter(c => c.lastSenderRole === 'ADMIN' && (c.unreadCountForReporter || 0) > 0).length;
  const warningCount = conversations.filter(c => (c.lastMessage || '').includes('⚠️') || (c.lastMessage || '').includes('హెచ్చరిక')).length;
  const readCount = conversations.filter(c => (c.unreadCountForAdmin || 0) === 0 && (c.unreadCountForReporter || 0) === 0).length;

  // 1. If Reporter / Non-Admin: Automatically lock active conversation to their own reporter account
  useEffect(() => {
    if (!isAdmin && currentUser?.id && currentUser.id !== 'guest') {
      const myConv: ReporterConversation = {
        id: currentUser.id,
        reporterId: currentUser.id,
        reporterName: currentUser.name || 'రిపోర్టర్ (Reporter)',
        reporterDistrict: currentUser.district || '',
        reporterPhone: currentUser.phone || '',
        reporterPhotoUrl: currentUser.photoUrl || '',
        lastMessage: '',
        lastMessageTime: Date.now(),
        lastSenderRole: 'REPORTER',
        unreadCountForAdmin: 0,
        unreadCountForReporter: 0,
        updatedAt: Date.now()
      };
      setActiveReporter(myConv);
      setLoadingConv(false);
    }
  }, [isAdmin, currentUser?.id, currentUser?.name, currentUser?.district, currentUser?.phone, currentUser?.photoUrl]);

  // 2. Fetch Conversations (for Admins) in Real-Time
  useEffect(() => {
    if (!isAdmin) return;

    setLoadingConv(true);
    const q = query(
      collection(db, 'reporter_conversations'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: ReporterConversation[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        const updatedTs = typeof data.updatedAt?.toMillis === 'function' 
          ? data.updatedAt.toMillis() 
          : (typeof data.updatedAt === 'number' ? data.updatedAt : (data.lastMessageTime || Date.now()));
        const lastMsgTs = typeof data.lastMessageTime?.toMillis === 'function'
          ? data.lastMessageTime.toMillis()
          : (typeof data.lastMessageTime === 'number' ? data.lastMessageTime : updatedTs);

        return {
          id: d.id,
          reporterId: data.reporterId || d.id,
          reporterName: data.reporterName || 'రిపోర్టర్',
          reporterDistrict: data.reporterDistrict || '',
          reporterPhone: data.reporterPhone || '',
          reporterPhotoUrl: data.reporterPhotoUrl || '',
          lastMessage: data.lastMessage || '',
          lastMessageTime: lastMsgTs,
          lastSenderRole: data.lastSenderRole || 'REPORTER',
          unreadCountForAdmin: Number(data.unreadCountForAdmin || 0),
          unreadCountForReporter: Number(data.unreadCountForReporter || 0),
          updatedAt: updatedTs
        } as ReporterConversation;
      });

      setConversations(list);
      setLoadingConv(false);

      // Handle direct open via initialReporterId
      if (initialReporterId && !activeReporter) {
        const matched = list.find(c => c.reporterId === initialReporterId);
        if (matched) setActiveReporter(matched);
      }
    }, (err: any) => {
      console.error('Conversations listener error:', err);
      setLoadingConv(false);
    });

    return () => unsubscribe();
  }, [isAdmin, initialReporterId]);

  // 3. Fetch All Registered Reporters (for Admin directory & quick chat initiation)
  useEffect(() => {
    if (!isAdmin) return;

    const fetchReporters = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', 'in', [UserRole.REPORTER, 'REPORTER', 'reporter', 2, '2']));
        const snap = await getDocs(q);
        const list = snap.docs.map((d: any) => ({
          id: d.id,
          ...d.data()
        } as User));
        setAllReporters(list);
      } catch (e) {
        console.error('Failed to load reporters list:', e);
      }
    };

    fetchReporters();
  }, [isAdmin]);

  // 4. Real-Time Messages Listener for Active Reporter Conversation
  useEffect(() => {
    if (!activeReporter) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesCol = collection(db, 'reporter_conversations', activeReporter.reporterId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot: any) => {
      const list: ReporterMessage[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        const ts = typeof data.timestamp?.toMillis === 'function'
          ? data.timestamp.toMillis()
          : (typeof data.timestamp === 'number' ? data.timestamp : Date.now());

        return {
          id: d.id,
          senderId: data.senderId || '',
          senderName: data.senderName || '',
          senderRole: data.senderRole || 'ADMIN',
          text: data.text || '',
          type: data.type || 'CHAT',
          read: Boolean(data.read),
          timestamp: ts
        } as ReporterMessage;
      });

      setMessages(list);
      setLoadingMessages(false);

      // Auto mark messages as read and clear unread counter
      try {
        const convRef = doc(db, 'reporter_conversations', activeReporter.reporterId);
        if (isAdmin && (activeReporter.unreadCountForAdmin || 0) > 0) {
          await updateDoc(convRef, { unreadCountForAdmin: 0 });
          
          const unreadMsgs = snapshot.docs.filter((d: any) => !d.data().read && d.data().senderRole !== 'ADMIN');
          if (unreadMsgs.length > 0) {
            const batch = writeBatch(db);
            unreadMsgs.forEach((d: any) => {
              batch.update(d.ref, { read: true });
            });
            await batch.commit();
          }
        } else if (!isAdmin && (activeReporter.unreadCountForReporter || 0) > 0) {
          await updateDoc(convRef, { unreadCountForReporter: 0 });
          
          const unreadMsgs = snapshot.docs.filter((d: any) => !d.data().read && d.data().senderRole === 'ADMIN');
          if (unreadMsgs.length > 0) {
            const batch = writeBatch(db);
            unreadMsgs.forEach((d: any) => {
              batch.update(d.ref, { read: true });
            });
            await batch.commit();
          }
        }
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }, (err: any) => {
      console.error('Messages error:', err);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [isAdmin, activeReporter?.reporterId]);

  // Auto-scroll down on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 5. Send Message Function (with Cloud Function backend call & direct Firestore fallback)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeReporter || isSending) return;

    const textToSend = inputText.trim();
    const currentType = messageType;
    setInputText('');
    setMessageType('CHAT');
    setIsSending(true);

    try {
      let sentViaFunction = false;

      // Attempt sending via Cloud Function (for high-priority push notifications)
      try {
        const functions = getFunctions(app, 'asia-south1');
        const sendMsgFn = httpsCallable(functions, 'sendAdminReporterMessage');
        const res: any = await sendMsgFn({
          reporterId: activeReporter.reporterId,
          text: textToSend,
          type: currentType
        });
        if (res.data?.success) {
          sentViaFunction = true;
        }
      } catch (funcErr) {
        console.warn('Cloud Function send fallback to direct Firestore:', funcErr);
      }

      // Fallback direct Firestore write if Cloud Function is offline/unreachable
      if (!sentViaFunction) {
        const now = Date.now();
        const messagesCol = collection(db, 'reporter_conversations', activeReporter.reporterId, 'messages');
        const senderRole = isAdmin ? 'ADMIN' : 'REPORTER';
        const senderName = currentUser.name || (isAdmin ? 'AlfaNews Admin Desk' : 'Reporter');

        await addDoc(messagesCol, {
          senderId: currentUser.id,
          senderName: senderName,
          senderRole: senderRole,
          text: textToSend,
          type: currentType,
          timestamp: serverTimestamp ? serverTimestamp() : now,
          read: false
        });

        const convDocRef = doc(db, 'reporter_conversations', activeReporter.reporterId);
        const updateData: any = {
          lastMessage: textToSend,
          lastMessageTime: serverTimestamp ? serverTimestamp() : now,
          lastSenderRole: senderRole,
          lastSenderId: currentUser.id,
          updatedAt: serverTimestamp ? serverTimestamp() : now
        };

        if (isAdmin) {
          updateData.unreadCountForReporter = increment(1);
          updateData.unreadCountForAdmin = 0;
        } else {
          updateData.unreadCountForAdmin = increment(1);
          updateData.unreadCountForReporter = 0;
          updateData.reporterId = currentUser.id;
          updateData.reporterName = currentUser.name || 'Applicant';
          updateData.reporterPhone = currentUser.phone || '';
          updateData.reporterDistrict = currentUser.district || '';
        }

        await setDoc(convDocRef, updateData, { merge: true });
      }
    } catch (err: any) {
      alert(`సందేశం పంపడంలో లోపం: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // 6. Broadcast Announcement to All Active Reporters
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastBody.trim() || isBroadcasting) return;

    setIsBroadcasting(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const broadcastFn = httpsCallable(functions, 'broadcastToAllReporters');
      const res: any = await broadcastFn({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim()
      });

      const targeted = res.data?.count || 0;
      alert(`📢 ${targeted} మంది రిపోర్టర్లకు అధికారిక ప్రకటన విజయవంతంగా పంపబడింది!`);
      setBroadcastBody('');
      setShowBroadcastModal(false);
    } catch (err: any) {
      alert(`బ్రాడ్‌కాస్ట్ చేయడంలో లోపం: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleQuickTemplate = (templateText: string, type: 'CHAT' | 'WARNING' | 'BROADCAST' = 'CHAT') => {
    setInputText(templateText);
    setMessageType(type);
  };

  // Filtered lists
  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    
    // Tab filter
    if (selectedTab === 2) {
      const isWarn = (c.lastMessage || '').includes('⚠️') || (c.lastMessage || '').includes('హెచ్చరిక');
      if (!isWarn) return false;
    } else {
      if (conversationFilter === 'UNREAD_ADMIN' && (c.unreadCountForAdmin || 0) <= 0) return false;
      if (conversationFilter === 'UNREAD_REPORTER' && !(c.lastSenderRole === 'ADMIN' && (c.unreadCountForReporter || 0) > 0)) return false;
      if (conversationFilter === 'READ' && !((c.unreadCountForAdmin || 0) === 0 && (c.unreadCountForReporter || 0) === 0)) return false;
      if (conversationFilter === 'WARNINGS') {
        const isWarn = (c.lastMessage || '').includes('⚠️') || (c.lastMessage || '').includes('హెచ్చరిక');
        if (!isWarn) return false;
      }
    }

    if (!q) return true;
    return (
      (c.reporterName || '').toLowerCase().includes(q) ||
      (c.reporterDistrict || '').toLowerCase().includes(q) ||
      (c.reporterPhone || '').includes(q) ||
      (c.lastMessage || '').toLowerCase().includes(q)
    );
  });

  const filteredAllReporters = allReporters.filter(r => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.district || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q)
    );
  });

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateHeader = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('te-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="font-mallanna text-black animate-fade-in w-full h-full flex flex-col min-h-0">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 px-4 py-2.5 rounded-2xl mb-2 flex items-center justify-between shadow-md text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-white backdrop-blur-md shadow-inner text-xl">
            💬
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-ramabhadra font-bold leading-tight">
              {isAdmin ? 'రిపోర్టర్ కమ్యూనికేషన్స్ & చాట్' : 'అల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్'}
            </h2>
            <p className="text-teal-100 text-xs font-semibold hidden md:block">
              {isAdmin ? 'ప్రత్యక్ష సంభాషణలు • హెచ్చరికలు • బ్రాడ్‌కాస్ట్ నోటీసులు' : 'వార్తల ప్రచురణ లేదా ఏవైనా సమస్యలు ఉంటే ఇక్కడ సంప్రదించండి'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
            >
              <span>📢</span>
              <span>అందరికీ ప్రకటన (Broadcast)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Split Interface */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-row min-h-0">
        {/* Left Side: Conversation Directory (Admin Only) */}
        {isAdmin && (
          <div className={`w-full md:w-5/12 lg:w-4/12 border-r border-gray-200 flex flex-col h-full min-h-0 bg-white shrink-0 ${activeReporter ? 'hidden md:flex' : 'flex'}`}>
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="రిపోర్టర్ పేరు, ఫోన్, జిల్లా వెతుకు..."
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all text-black"
                />
                <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/50 p-1 shrink-0">
              <button
                onClick={() => setSelectedTab(0)}
                className={`flex-1 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTab === 0 ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>సంభాషణలు</span>
                <span className="text-xs">({conversations.length})</span>
                {unreadAdminCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                )}
              </button>

              <button
                onClick={() => setSelectedTab(1)}
                className={`flex-1 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTab === 1 ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>రిపోర్టర్లు</span>
                <span className="text-xs">({allReporters.length})</span>
              </button>

              <button
                onClick={() => setSelectedTab(2)}
                className={`flex-1 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  selectedTab === 2 ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>హెచ్చరికలు</span>
                <span className="text-xs">({warningCount})</span>
              </button>
            </div>

            {/* Filter Chips (Only in Conversations Tab) */}
            {selectedTab === 0 && (
              <div className="flex items-center gap-1.5 p-2.5 border-b border-gray-100 overflow-x-auto no-scrollbar bg-gray-50/30 text-xs shrink-0">
                <button
                  onClick={() => setConversationFilter('ALL')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
                    conversationFilter === 'ALL'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  అన్నీ ({conversations.length})
                </button>
                <button
                  onClick={() => setConversationFilter('UNREAD_ADMIN')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    conversationFilter === 'UNREAD_ADMIN'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span>🔴 కొత్తవి</span>
                  {unreadAdminCount > 0 && <span className="font-extrabold">({unreadAdminCount})</span>}
                </button>
                <button
                  onClick={() => setConversationFilter('UNREAD_REPORTER')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
                    conversationFilter === 'UNREAD_REPORTER'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  ⏳ చదవనివి ({unreadReporterCount})
                </button>
                <button
                  onClick={() => setConversationFilter('READ')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
                    conversationFilter === 'READ'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ✓ చదివినవి ({readCount})
                </button>
                <button
                  onClick={() => setConversationFilter('WARNINGS')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
                    conversationFilter === 'WARNINGS'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  ⚠️ హెచ్చరికలు ({warningCount})
                </button>
              </div>
            )}

            {/* List Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-0">
              {loadingConv ? (
                <div className="p-10 text-center text-gray-400 font-bold flex flex-col items-center">
                  <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span>లోడ్ అవుతోంది...</span>
                </div>
              ) : selectedTab === 1 ? (
                /* All Registered Reporters List */
                filteredAllReporters.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 font-bold">రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.</div>
                ) : (
                  filteredAllReporters.map(reporter => {
                    const existingConv = conversations.find(c => c.reporterId === reporter.id);
                    return (
                      <div
                        key={reporter.id}
                        onClick={() => {
                          setActiveReporter(existingConv || {
                            id: reporter.id,
                            reporterId: reporter.id,
                            reporterName: reporter.name || 'రిపోర్టర్',
                            reporterDistrict: reporter.district || '',
                            reporterPhone: reporter.phone || '',
                            reporterPhotoUrl: reporter.photoUrl || '',
                            lastMessage: '',
                            lastMessageTime: Date.now(),
                            lastSenderRole: 'REPORTER',
                            unreadCountForAdmin: 0,
                            unreadCountForReporter: 0,
                            updatedAt: Date.now()
                          });
                        }}
                        className="p-3.5 hover:bg-teal-50/50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={reporter.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(reporter.name || 'R')}&background=random`}
                            alt={reporter.name}
                            className="w-11 h-11 rounded-2xl object-cover border border-gray-200 shadow-sm shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 truncate text-base leading-snug">{reporter.name}</h4>
                            <p className="text-xs text-gray-500 truncate">
                              {reporter.district ? `${reporter.district} • ` : ''}{reporter.phone || 'రిపోర్టర్'}
                            </p>
                          </div>
                        </div>

                        <span className="bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors">
                          {existingConv ? 'ఓపెన్ చాట్' : 'సందేశం'}
                        </span>
                      </div>
                    );
                  })
                )
              ) : (
                /* Conversations List (Tab 0 or Tab 2) */
                filteredConversations.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 font-bold flex flex-col items-center">
                    <span className="text-4xl mb-2">📭</span>
                    <span>సంభాషణలు ఏవీ లేవు.</span>
                    <button
                      onClick={() => setSelectedTab(1)}
                      className="mt-3 text-teal-700 font-bold text-sm underline"
                    >
                      'రిపోర్టర్లు' ట్యాబ్ నుండి కొత్త చాట్ ప్రారంభించండి
                    </button>
                  </div>
                ) : (
                  filteredConversations.map(conv => {
                    const hasUnreadByAdmin = (conv.unreadCountForAdmin || 0) > 0;
                    const isPendingReporterRead = conv.lastSenderRole === 'ADMIN' && (conv.unreadCountForReporter || 0) > 0;
                    const isReadByReporter = conv.lastSenderRole === 'ADMIN' && (conv.unreadCountForReporter || 0) === 0;
                    const isWarning = (conv.lastMessage || '').includes('⚠️') || (conv.lastMessage || '').includes('హెచ్చరిక');

                    // Gmail-style contrast:
                    // UNREAD: Elevated, bold, high contrast, colored ring, unread dot
                    // READ: Muted, regular font weight, soft gray text
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setActiveReporter(conv)}
                        className={`w-full text-left p-3.5 transition-all flex items-start gap-3 border-l-4 ${
                          activeReporter?.reporterId === conv.reporterId
                            ? 'bg-teal-50/90 border-teal-700'
                            : hasUnreadByAdmin
                            ? 'bg-white border-red-500 shadow-sm'
                            : 'bg-gray-50/40 hover:bg-gray-100/60 border-transparent'
                        }`}
                      >
                        {/* Avatar with unread indicator dot */}
                        <div className="relative shrink-0">
                          <img
                            src={conv.reporterPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.reporterName || 'R')}&background=random`}
                            alt={conv.reporterName}
                            className="w-12 h-12 rounded-2xl object-cover border border-gray-200 shadow-sm"
                          />
                          {hasUnreadByAdmin && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full"></span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <h4
                              className={`truncate text-base ${
                                hasUnreadByAdmin
                                  ? 'font-extrabold text-gray-950 font-ramabhadra'
                                  : 'font-normal text-gray-700'
                              }`}
                            >
                              {conv.reporterName}
                            </h4>
                            <span
                              className={`text-[11px] shrink-0 ${
                                hasUnreadByAdmin ? 'text-teal-800 font-bold' : 'text-gray-400'
                              }`}
                            >
                              {formatMessageTime(conv.lastMessageTime)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            {conv.reporterDistrict && (
                              <span className="font-semibold text-gray-700">{conv.reporterDistrict}</span>
                            )}
                            {conv.reporterPhone && <span>• {conv.reporterPhone}</span>}
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <p
                              className={`text-xs truncate flex-1 ${
                                isWarning
                                  ? 'text-red-600 font-bold'
                                  : hasUnreadByAdmin
                                  ? 'text-gray-900 font-bold'
                                  : 'text-gray-500'
                              }`}
                            >
                              {conv.lastSenderRole === 'ADMIN' ? 'మీరు: ' : ''}
                              {conv.lastMessage || 'సందేశం ప్రారంభించండి...'}
                            </p>

                            {hasUnreadByAdmin ? (
                              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                                {conv.unreadCountForAdmin} కొత్తవి
                              </span>
                            ) : isPendingReporterRead ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                ⏳ చదవలేదు
                              </span>
                            ) : isReadByReporter ? (
                              <span className="text-emerald-700 text-[11px] font-bold shrink-0">
                                ✓✓ చదివారు
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>
        )}

        {/* Right Side: Active 1-on-1 Chat Screen (Admin & Reporter) */}
        <div className={`${isAdmin ? 'w-full md:w-7/12 lg:w-8/12' : 'w-full'} flex flex-col h-full min-h-0 bg-gray-100/50 ${!activeReporter ? 'hidden md:flex' : 'flex'}`}>
          {activeReporter ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={() => setActiveReporter(null)}
                      className="md:hidden p-2 -ml-1 text-gray-700 hover:bg-gray-100 rounded-xl font-bold"
                    >
                      ←
                    </button>
                  )}

                  <img
                    src={
                      isAdmin
                        ? activeReporter.reporterPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeReporter.reporterName || 'R')}&background=random`
                        : '/Subba Reddy Sign.png'
                    }
                    onError={(e: any) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(isAdmin ? activeReporter.reporterName : 'Admin')}&background=random`;
                    }}
                    alt="Desk"
                    className="w-11 h-11 rounded-2xl object-cover border border-gray-200 shadow-sm"
                  />

                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight font-ramabhadra">
                      {isAdmin ? activeReporter.reporterName : 'అల్ఫా న్యూస్ అడ్మిన్ డెస్క్ (Admin Desk)'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {isAdmin ? (
                        <>
                          {activeReporter.reporterDistrict && <span className="font-semibold text-teal-800">{activeReporter.reporterDistrict}</span>}
                          {activeReporter.reporterPhone && <span>• {activeReporter.reporterPhone}</span>}
                        </>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          ప్రత్యక్ష సంభాషణ
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {activeReporter.reporterPhone && (
                      <a
                        href={`tel:${activeReporter.reporterPhone}`}
                        className="p-2 text-teal-700 hover:bg-teal-50 rounded-xl border border-teal-200 flex items-center gap-1 text-xs font-bold transition-colors"
                        title="ఫోన్ కాల్ చేయండి"
                      >
                        <span>📞</span>
                        <span className="hidden sm:inline">కాల్</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Warning Templates Toolbar */}
              {isAdmin && (
                <div className="px-3 py-2 bg-amber-50/70 border-b border-amber-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
                  <span className="font-bold text-amber-900 mr-1 shrink-0">త్వరిత సందేశాలు:</span>
                  <button
                    onClick={() => handleQuickTemplate('⚠️ దయచేసి వార్తా ప్రమాణాలను మరియు సరైన అధిక-నాణ్యత ఫోటోలను జత చేయండి.', 'WARNING')}
                    className="bg-white border border-red-200 text-red-700 px-2.5 py-1 rounded-xl hover:bg-red-50 transition-colors font-semibold shadow-xs shrink-0"
                  >
                    ⚠️ నాణ్యత హెచ్చరిక
                  </button>
                  <button
                    onClick={() => handleQuickTemplate('📢 మీ ప్రాంతంలోని తాజా బ్రేకింగ్ వార్తలను వెంటనే అప్‌డేట్ చేయండి.', 'CHAT')}
                    className="bg-white border border-teal-200 text-teal-800 px-2.5 py-1 rounded-xl hover:bg-teal-50 transition-colors font-semibold shadow-xs shrink-0"
                  >
                    📢 బ్రేకింగ్ అలర్ట్
                  </button>
                  <button
                    onClick={() => handleQuickTemplate('✅ మీ వార్త విజయవంతంగా ఆమోదించబడింది మరియు ప్రచురించబడింది.', 'CHAT')}
                    className="bg-white border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-xl hover:bg-emerald-50 transition-colors font-semibold shadow-xs shrink-0"
                  >
                    ✅ ఆమోదం నోటీసు
                  </button>
                  <button
                    onClick={() => handleQuickTemplate('📍 మీ మండలానికి సంబంధించిన స్థానిక సమస్యలపై ప్రత్యేక కథనం పంపగలరు.', 'CHAT')}
                    className="bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-xl hover:bg-gray-50 transition-colors font-semibold shadow-xs shrink-0"
                  >
                    📍 కథనం అభ్యర్థన
                  </button>
                </div>
              )}

              {/* Support Banner for Reporters */}
              {!isAdmin && (
                <div className="mx-4 mt-3 p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3 shadow-xs shrink-0">
                  <span className="text-2xl">🤝</span>
                  <div>
                    <h4 className="font-bold text-teal-900 text-sm font-ramabhadra">అల్ఫా న్యూస్ రిపోర్టర్ సపోర్ట్ డెస్క్</h4>
                    <p className="text-xs text-teal-800">
                      వార్తల వెరిఫికేషన్, ఐడీ కార్డు అభ్యర్థనలు లేదా ఇతర సందేహాలు ఉంటే ఇక్కడ నేరుగా మెసేజ్ చేయండి.
                    </p>
                  </div>
                </div>
              )}

              {/* Messages Flow Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar min-h-0 bg-gray-50/60">
                {loadingMessages ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center">
                    <span className="text-5xl mb-3">💬</span>
                    <span className="text-base text-gray-600">సందేశాలు ఏవీ లేవు.</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {isAdmin ? 'ఈ రిపోర్టర్‌తో సంభాషణను ప్రారంభించండి.' : 'ఎడిటోరియల్ డెస్క్‌తో మీ సంభాషణ ప్రారంభించండి.'}
                    </span>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMyMessage = isAdmin
                      ? msg.senderRole === 'ADMIN' || msg.senderId === currentUser.id
                      : msg.senderRole !== 'ADMIN' || msg.senderId === currentUser.id;

                    const isWarning = msg.type === 'WARNING';
                    const isBroadcast = msg.type === 'BROADCAST';

                    // Show date stamp header when day changes
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDateHeader = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {showDateHeader && (
                          <div className="flex justify-center my-2">
                            <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs">
                              {formatDateHeader(msg.timestamp)}
                            </span>
                          </div>
                        )}

                        {/* WARNING MESSAGE CARD */}
                        {isWarning ? (
                          <div className="flex justify-center my-1">
                            <div className="w-full max-w-lg bg-red-50 border-2 border-red-300 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl shrink-0">⚠️</span>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-bold text-red-900 text-sm font-ramabhadra">
                                    అధికారిక హెచ్చరిక (Official Notice)
                                  </h5>
                                  <p className="text-red-950 text-sm mt-1 whitespace-pre-wrap font-medium leading-relaxed">
                                    {msg.text}
                                  </p>
                                  <div className="text-[10px] text-red-700 font-bold mt-2 text-right">
                                    {formatMessageTime(msg.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : isBroadcast ? (
                          /* BROADCAST ANNOUNCEMENT CARD */
                          <div className="flex justify-center my-1">
                            <div className="w-full max-w-lg bg-teal-50 border-2 border-teal-300 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl shrink-0">📢</span>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-bold text-teal-900 text-sm font-ramabhadra">
                                    అధికారిక ప్రకటన (Official Announcement)
                                  </h5>
                                  <p className="text-teal-950 text-sm mt-1 whitespace-pre-wrap font-medium leading-relaxed">
                                    {msg.text}
                                  </p>
                                  <div className="text-[10px] text-teal-700 font-bold mt-2 text-right">
                                    {formatMessageTime(msg.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* STANDARD CHAT BUBBLE */
                          <div className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                            <div
                              className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3.5 shadow-sm text-sm ${
                                isMyMessage
                                  ? 'bg-teal-700 text-white rounded-br-xs'
                                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs'
                              }`}
                            >
                              {!isMyMessage && (
                                <div className="font-bold mb-1 text-[11px] text-teal-700">
                                  {msg.senderRole === 'ADMIN' ? 'అడ్మిన్ డెస్క్' : msg.senderName || 'రిపోర్టర్'}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap font-medium text-sm leading-relaxed">{msg.text}</p>
                              
                              <div
                                className={`text-[10px] mt-1.5 flex items-center justify-end gap-1.5 ${
                                  isMyMessage ? 'text-teal-100' : 'text-gray-400'
                                }`}
                              >
                                <span>{formatMessageTime(msg.timestamp)}</span>
                                {isMyMessage && (
                                  <span className="font-bold text-xs">
                                    {msg.read ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Footer */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 shrink-0 shadow-md sticky bottom-0 z-10">
                {isAdmin && (
                  <div className="flex items-center gap-3 mb-2 px-1 text-xs">
                    <span className="text-gray-500 font-semibold">సందేశం రకం:</span>
                    <label className="flex items-center gap-1 cursor-pointer font-bold text-teal-800">
                      <input
                        type="radio"
                        name="msgType"
                        checked={messageType === 'CHAT'}
                        onChange={() => setMessageType('CHAT')}
                        className="text-teal-600"
                      />
                      సాధారణ చాట్
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer font-bold text-red-600">
                      <input
                        type="radio"
                        name="msgType"
                        checked={messageType === 'WARNING'}
                        onChange={() => setMessageType('WARNING')}
                        className="text-red-600"
                      />
                      ⚠️ అధికారిక హెచ్చరిక
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={
                      isAdmin
                        ? 'రిపోర్టర్‌కు సందేశం టైప్ చేయండి...'
                        : 'అడ్మిన్ డెస్క్‌కు సందేశం టైప్ చేయండి...'
                    }
                    className="flex-1 border border-gray-300 px-4 py-3 rounded-2xl text-base bg-gray-50 outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all text-black"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-base transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'పంపు'
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Empty State when no reporter is selected */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <span className="text-6xl mb-3">💬</span>
              <h3 className="font-ramabhadra text-2xl text-gray-700 font-bold">రిపోర్టర్‌ను ఎంచుకోండి</h3>
              <p className="text-sm text-gray-500 max-w-sm mt-1">
                ఎడమ వైపు జాబితా నుండి రిపోర్టర్‌ను ఎంచుకుని ప్రత్యక్ష సంభాషణ ప్రారంభించండి.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Announcement Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📢</span>
                <h3 className="font-ramabhadra text-xl font-bold text-gray-900">
                  అందరు రిపోర్టర్లకు ప్రకటన (Broadcast)
                </h3>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  ప్రకటన శీర్షిక (Title)
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full border border-gray-300 p-3 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  సందేశం వివరాలు (Body)
                </label>
                <textarea
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="అందరు రిపోర్టర్లకు పంపవలసిన ముఖ్య సమాచారాన్ని ఇక్కడ నమోదు చేయండి..."
                  rows={5}
                  className="w-full border border-gray-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600"
                  required
                ></textarea>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                ℹ️ ఈ సందేశం యాక్టివ్‌గా ఉన్న అందరు రిపోర్టర్ల చాట్‌లోకి వెళ్తుంది మరియు హై-ప్రయారిటీ పుష్ నోటిఫికేషన్ రూపంలో డెలివరీ అవుతుంది.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50"
                >
                  రద్దు చేయి
                </button>
                <button
                  type="submit"
                  disabled={!broadcastBody.trim() || isBroadcasting}
                  className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isBroadcasting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>పంపుతున్నాము...</span>
                    </>
                  ) : (
                    '📢 బ్రాడ్‌కాస్ట్ చేయి'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReporterMessagingPage;
