
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, ReporterConversation, ReporterMessage } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, getDocs, addDoc, doc, setDoc, updateDoc, query, orderBy, onSnapshot, increment } = _firestore as any;

interface AdminReporterMessagingPageProps {
  currentUser: User;
  initialReporterId?: string | null;
}

const AdminReporterMessagingPage: React.FC<AdminReporterMessagingPageProps> = ({ currentUser, initialReporterId }) => {
  const isAdmin = [UserRole.ADMIN, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE].includes(currentUser.role);
  const [conversations, setConversations] = useState<ReporterConversation[]>([]);
  const [activeReporter, setActiveReporter] = useState<ReporterConversation | null>(null);
  const [messages, setMessages] = useState<ReporterMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // For non-admin user (reporter / applicant), automatically initialize activeReporter
  useEffect(() => {
    if (!isAdmin && currentUser?.id && currentUser.id !== 'guest') {
      setActiveReporter({
        id: currentUser.id,
        reporterId: currentUser.id,
        reporterName: currentUser.name || 'Applicant / Reporter',
        reporterDistrict: currentUser.district || '',
        reporterPhone: currentUser.phone || '',
        reporterPhotoUrl: currentUser.photoUrl || '',
        lastMessage: '',
        lastMessageTime: Date.now(),
        lastSenderRole: 'REPORTER',
        unreadCountForAdmin: 0,
        unreadCountForReporter: 0,
        updatedAt: Date.now()
      });
      setLoadingConv(false);
    }
  }, [isAdmin, currentUser?.id]);

  // Listen to conversations (for admin)
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, 'reporter_conversations'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: ReporterConversation[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          reporterId: data.reporterId || d.id,
          reporterName: data.reporterName || 'Reporter',
          reporterDistrict: data.reporterDistrict || '',
          reporterPhone: data.reporterPhone || '',
          reporterPhotoUrl: data.reporterPhotoUrl || '',
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime || data.updatedAt || 0,
          lastSenderRole: data.lastSenderRole || 'REPORTER',
          unreadCountForAdmin: data.unreadCountForAdmin || 0,
          unreadCountForReporter: data.unreadCountForReporter || 0,
          updatedAt: data.updatedAt || Date.now()
        } as ReporterConversation;
      });

      setConversations(list);
      setLoadingConv(false);

      if (initialReporterId && !activeReporter) {
        const matched = list.find(c => c.reporterId === initialReporterId);
        if (matched) setActiveReporter(matched);
      }
    }, (err: any) => {
      console.error('Conversations error:', err);
      setLoadingConv(false);
    });

    return () => unsubscribe();
  }, [isAdmin, initialReporterId]);

  // Listen to messages of active conversation
  useEffect(() => {
    if (!activeReporter) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesCol = collection(db, 'reporter_conversations', activeReporter.reporterId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: ReporterMessage[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      } as ReporterMessage));

      setMessages(list);
      setLoadingMessages(false);

      // Mark unread count as 0
      if (isAdmin && activeReporter.unreadCountForAdmin > 0) {
        updateDoc(doc(db, 'reporter_conversations', activeReporter.reporterId), {
          unreadCountForAdmin: 0
        }).catch(console.error);
      } else if (!isAdmin && activeReporter.unreadCountForReporter > 0) {
        updateDoc(doc(db, 'reporter_conversations', activeReporter.reporterId), {
          unreadCountForReporter: 0
        }).catch(console.error);
      }
    }, (err: any) => {
      console.error('Messages error:', err);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [isAdmin, activeReporter?.reporterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeReporter) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const now = Date.now();
      const messagesCol = collection(db, 'reporter_conversations', activeReporter.reporterId, 'messages');
      const senderRole = isAdmin ? 'ADMIN' : 'REPORTER';
      const senderName = currentUser.name || (isAdmin ? 'Admin Desk' : 'Reporter');
      
      await addDoc(messagesCol, {
        senderId: currentUser.id,
        senderName: senderName,
        senderRole: senderRole,
        text: textToSend,
        timestamp: now,
        read: false
      });

      const convDocRef = doc(db, 'reporter_conversations', activeReporter.reporterId);
      const updateData: any = {
        lastMessage: textToSend,
        lastMessageTime: now,
        lastSenderRole: senderRole,
        lastSenderId: currentUser.id,
        updatedAt: now
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
    } catch (err: any) {
      alert(`మెసేజ్ పంపడంలో లోపం: ${err.message}`);
    }
  };

  const handleQuickTemplate = (templateText: string) => {
    setInputText(templateText);
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.reporterName.toLowerCase().includes(q) ||
      (c.reporterDistrict && c.reporterDistrict.toLowerCase().includes(q)) ||
      (c.reporterPhone && c.reporterPhone.includes(q))
    );
  });

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="font-mallanna text-black animate-fade-in pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-ramabhadra leading-tight">రిపోర్టర్ డెస్క్ మెసేజెస్ (Reporter Chat)</h2>
            <p className="text-teal-100 text-sm font-bold uppercase tracking-wider">రిపోర్టర్లతో ప్రత్యక్ష సంభాషణ & మార్గదర్శకాలు</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
        {/* Left: Conversation List (Visible only to Admin) */}
        {isAdmin && (
          <div className={`md:col-span-4 border-r border-gray-200 flex flex-col ${activeReporter ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="రిపోర్టర్ పేరు లేదా జిల్లా..."
                className="w-full border border-gray-300 px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {loadingConv ? (
                <div className="p-8 text-center text-gray-400 font-bold">లోడ్ అవుతోంది...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-bold">సంభాషణలు ఏవీ లేవు.</div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveReporter(conv)}
                    className={`w-full text-left p-4 hover:bg-teal-50/50 transition-colors flex items-start gap-3 ${
                      activeReporter?.reporterId === conv.reporterId ? 'bg-teal-50 border-l-4 border-teal-600' : ''
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-lg shadow-sm">
                      {conv.reporterName ? conv.reporterName.charAt(0).toUpperCase() : 'R'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-gray-900 truncate text-base">{conv.reporterName}</h4>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatMessageTime(conv.lastMessageTime)}</span>
                      </div>

                      {conv.reporterDistrict && (
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-semibold mb-1 inline-block">
                          {conv.reporterDistrict}
                        </span>
                      )}

                      <p className="text-gray-500 text-xs truncate">
                        {conv.lastSenderRole === 'ADMIN' ? 'మీరు: ' : ''}{conv.lastMessage || 'మెసేజ్ లేదు'}
                      </p>
                    </div>

                    {conv.unreadCountForAdmin > 0 && (
                      <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                        {conv.unreadCountForAdmin}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Right: Active Chat Window */}
        <div className={`${isAdmin ? 'md:col-span-8' : 'md:col-span-12'} flex flex-col bg-gray-50 ${!activeReporter ? 'hidden md:flex' : 'flex'}`}>
          {activeReporter ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={() => setActiveReporter(null)}
                      className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      ←
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center">
                    {isAdmin ? activeReporter.reporterName.charAt(0).toUpperCase() : '📢'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">
                      {isAdmin ? activeReporter.reporterName : 'అల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ (Editorial Desk)'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isAdmin ? (
                        <>
                          {activeReporter.reporterDistrict ? `${activeReporter.reporterDistrict} • ` : ''}
                          {activeReporter.reporterPhone || 'రిపోర్టర్'}
                        </>
                      ) : (
                        'ప్రత్యక్ష సంభాషణ • ఆన్‌లైన్'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Template Alerts (Admin Only) */}
              {isAdmin && (
                <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 flex flex-wrap gap-2 items-center text-xs">
                  <span className="font-bold text-teal-900">త్వరిత సందేశాలు:</span>
                  <button
                    onClick={() => handleQuickTemplate('⚠️ దయచేసి వార్తా ప్రమాణాలను మరియు సరైన ఫోటోలను జత చేయండి.')}
                    className="bg-white border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    ⚠️ నాణ్యత హెచ్చరిక
                  </button>
                  <button
                    onClick={() => handleQuickTemplate('📢 మీ ప్రాంతంలోని బ్రేకింగ్ వార్తలను వెంటనే అప్‌డేట్ చేయండి.')}
                    className="bg-white border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    📢 బ్రేకింగ్ అలర్ట్
                  </button>
                  <button
                    onClick={() => handleQuickTemplate('✅ మీ వార్త ఆమోదించబడింది మరియు పబ్లిష్ చేయబడింది.')}
                    className="bg-white border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    ✅ ఆమోదం
                  </button>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 font-bold">
                    {isAdmin ? 'ఈ రిపోర్టర్‌తో సంభాషణ ప్రారంభించండి.' : 'ఎడిటోరియల్ డెస్క్‌తో మీ సంభాషణ ప్రారంభించండి.'}
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMyMessage = msg.senderId === currentUser.id || (isAdmin ? msg.senderRole === 'ADMIN' : msg.senderRole !== 'ADMIN');
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-sm ${
                            isMyMessage
                              ? 'bg-teal-700 text-white rounded-br-none'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                          }`}
                        >
                          <div className="font-semibold mb-1 text-[11px] opacity-75">
                            {isMyMessage ? 'మీరు' : (msg.senderRole === 'ADMIN' ? 'అడ్మిన్ డెస్క్' : (msg.senderName || 'రిపోర్టర్'))}
                          </div>
                          <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                          <div className={`text-[10px] mt-1 text-right ${isMyMessage ? 'text-teal-200' : 'text-gray-400'}`}>
                            {formatMessageTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="సందేశాన్ని టైప్ చేయండి..."
                  className="flex-1 border border-gray-300 p-3 rounded-2xl text-base bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-md active:scale-95"
                >
                  పంపు (Send)
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="font-ramabhadra text-xl text-gray-600">రిపోర్టర్‌ను ఎంచుకోండి</h3>
              <p className="text-sm text-gray-400">ఎడమ వైపు జాబితా నుండి రిపోర్టర్‌ను ఎంచుకుని సంభాషణ ప్రారంభించండి.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReporterMessagingPage;
