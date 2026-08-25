
import React, { useState, useEffect } from 'react';
import { User, UserRole, Language, NewsPost, SurveyQuestion, SurveyOption, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } = _firestore as any;

interface ManageSurveysPageProps {
  currentUser: User;
  language?: Language;
}

const ManageSurveysPage: React.FC<ManageSurveysPageProps> = ({ currentUser }) => {
  const [surveys, setSurveys] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingSurvey, setViewingSurvey] = useState<NewsPost | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<NewsPost | null>(null);

  // Form State
  const [headline, setHeadline] = useState('');
  const [content, setContent] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [state, setState] = useState('TS');
  const [district, setDistrict] = useState('హైదరాబాద్');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    {
      id: 'q1',
      questionText: '',
      options: [
        { id: 'o1', text: '' },
        { id: 'o2', text: '' }
      ]
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'news'),
      where('type', '==', 'survey')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: NewsPost[] = snapshot.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          headline: data.headline || { telugu: '', english: '' },
          content: data.content || { telugu: '', english: '' },
          reporter: data.reporter || { id: '', name: 'Admin' },
          surveyQuestions: data.surveyQuestions || [],
          votes: data.votes || {},
          realVotesCount: data.realVotesCount || 0,
          fakeVotesBase: data.fakeVotesBase || 540,
          surveyCreatedAt: data.surveyCreatedAt || data.timestamp || Date.now(),
          timestamp: data.timestamp || Date.now()
        } as NewsPost;
      });

      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSurveys(list);
      setLoading(false);
    }, (err: any) => {
      console.error('Surveys fetch error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'news', id), {
        approved: true,
        status: 'PUBLISHED'
      });
    } catch (e: any) {
      alert(`ఆమోదించడంలో లోపం: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ఈ సర్వేను ఖచ్చితంగా తొలగించాలా?')) return;
    try {
      await deleteDoc(doc(db, 'news', id));
      if (viewingSurvey?.id === id) setViewingSurvey(null);
    } catch (e: any) {
      alert(`తొలగించడంలో లోపం: ${e.message}`);
    }
  };

  const resetForm = () => {
    setHeadline('');
    setContent('');
    setIsGlobal(true);
    setState('TS');
    setDistrict('హైదరాబాద్');
    setQuestions([
      {
        id: 'q1',
        questionText: '',
        options: [
          { id: 'o1', text: '' },
          { id: 'o2', text: '' }
        ]
      }
    ]);
    setEditingSurvey(null);
    setShowCreateModal(false);
  };

  const handleOpenEdit = (survey: NewsPost) => {
    setEditingSurvey(survey);
    setHeadline(survey.headline?.telugu || '');
    setContent(survey.content?.telugu || '');
    setIsGlobal(survey.isGlobal ?? true);
    setState(survey.state || 'TS');
    setDistrict(survey.district || 'హైదరాబాద్');
    if (survey.surveyQuestions && survey.surveyQuestions.length > 0) {
      setQuestions(survey.surveyQuestions);
    } else {
      setQuestions([
        {
          id: 'q1',
          questionText: '',
          options: [{ id: 'o1', text: '' }, { id: 'o2', text: '' }]
        }
      ]);
    }
    setShowCreateModal(true);
  };

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: `q${Date.now()}`,
        questionText: '',
        options: [
          { id: `o${Date.now()}_1`, text: '' },
          { id: `o${Date.now()}_2`, text: '' }
        ]
      }
    ]);
  };

  const removeQuestion = (qIdx: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== qIdx));
  };

  const updateQuestionText = (qIdx: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, questionText: text } : q));
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIdx) {
        return {
          ...q,
          options: [...q.options, { id: `o${Date.now()}`, text: '' }]
        };
      }
      return q;
    }));
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIdx && q.options.length > 2) {
        return {
          ...q,
          options: q.options.filter((_, idx) => idx !== oIdx)
        };
      }
      return q;
    }));
  };

  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIdx) {
        const nextOpts = q.options.map((opt, idx) => idx === oIdx ? { ...opt, text } : opt);
        return { ...q, options: nextOpts };
      }
      return q;
    }));
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      alert('దయచేసి సర్వే శీర్షికను నమోదు చేయండి.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        alert(`దయచేసి ప్రశ్న ${i + 1} ని నమోదు చేయండి.`);
        return;
      }
      for (let j = 0; j < questions[i].options.length; j++) {
        if (!questions[i].options[j].text.trim()) {
          alert(`ప్రశ్న ${i + 1} లో ఆప్షన్ ${j + 1} నమోదు చేయండి.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const payload: any = {
        type: 'survey',
        headline: { telugu: headline.trim(), english: headline.trim() },
        content: { telugu: content.trim(), english: content.trim() },
        isGlobal,
        state: isGlobal ? 'ALL' : state,
        district: isGlobal ? 'ALL' : district,
        surveyQuestions: questions,
        timestamp: editingSurvey ? editingSurvey.timestamp : now,
        surveyCreatedAt: editingSurvey ? editingSurvey.surveyCreatedAt || now : now,
        categories: ['సర్వే', 'పోల్'],
        mediaUrl: '',
        mediaType: 'image'
      };

      if (!editingSurvey) {
        payload.reporter = {
          id: currentUser.id,
          name: currentUser.name || 'Admin'
        };
        payload.approved = true; // Admins create directly approved
        payload.status = 'PUBLISHED';
        payload.votes = {};
        payload.realVotesCount = 0;
        payload.fakeVotesBase = 450 + Math.floor(Math.random() * 200);
        payload.likes = 0;
        payload.comments = 0;
        payload.shares = 0;

        await addDoc(collection(db, 'news'), payload);
        alert('సర్వే విజయవంతంగా పబ్లిష్ చేయబడింది!');
      } else {
        await updateDoc(doc(db, 'news', editingSurvey.id), payload);
        alert('సర్వే విజయవంతంగా అప్‌డేట్ చేయబడింది!');
      }

      resetForm();
    } catch (e: any) {
      alert(`సర్వే సేవ్ చేయడంలో లోపం: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="font-mallanna text-black animate-fade-in pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-cyan-800 p-6 rounded-[2rem] mb-6 flex flex-col sm:flex-row justify-between items-center shadow-xl text-white gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-ramabhadra leading-tight">సర్వేల నిర్వహణ (Surveys & Polls)</h2>
            <p className="text-blue-200 text-sm font-bold uppercase tracking-wider">ప్రజల అభిప్రాయ సేకరణ & లైవ్ ఫలితాలు</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="bg-white text-blue-800 px-6 py-2.5 rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-2"
        >
          <span>➕</span>
          <span>కొత్త సర్వే (New Survey)</span>
        </button>
      </div>

      {/* List of Surveys */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : surveys.length === 0 ? (
        <div className="bg-white p-12 rounded-[2rem] border text-center text-gray-400 font-bold text-lg">
          ప్రస్తుతం సర్వేలు ఏవీ లేవు. పై బటన్ క్లిక్ చేసి కొత్త సర్వేను ప్రారంభించండి.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {surveys.map(survey => (
            <div
              key={survey.id}
              className="bg-white p-5 rounded-[2rem] border border-gray-200 shadow-sm hover:border-blue-300 transition-all flex flex-col md:flex-row justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                      survey.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {survey.approved ? 'LIVE' : 'PENDING'}
                  </span>

                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                    {survey.isGlobal ? 'అన్ని ప్రాంతాలు (Global)' : `${survey.state || ''} - ${survey.district || ''}`}
                  </span>

                  <span className="text-xs text-gray-400 font-semibold">
                    రిపోర్టర్: {survey.reporter?.name || 'Admin'}
                  </span>
                </div>

                <h3 className="font-ramabhadra text-xl text-gray-900 leading-snug mb-1">
                  {survey.headline?.telugu || 'శీర్షిక లేదు'}
                </h3>

                {survey.content?.telugu && (
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                    {survey.content.telugu}
                  </p>
                )}

                <div className="text-xs text-gray-400">
                  ప్రశ్నల సంఖ్య: <span className="font-bold text-gray-700">{survey.surveyQuestions?.length || 0}</span> | 
                  నిజమైన ఓట్లు: <span className="font-bold text-blue-600">{survey.realVotesCount || 0}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => setViewingSurvey(survey)}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>ఫలితాలు (Results)</span>
                </button>

                {!survey.approved && (
                  <button
                    onClick={() => handleApprove(survey.id)}
                    className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold text-sm transition-all"
                  >
                    ఆమోదించు
                  </button>
                )}

                <button
                  onClick={() => handleOpenEdit(survey)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                  title="Edit Survey"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  </svg>
                </button>

                <button
                  onClick={() => handleDelete(survey.id)}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all"
                  title="Delete Survey"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results View Modal */}
      {viewingSurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full uppercase">
                  లైవ్ సర్వే ఫలితాలు
                </span>
                <h3 className="font-ramabhadra text-2xl text-gray-900 mt-2">
                  {viewingSurvey.headline?.telugu}
                </h3>
              </div>
              <button
                onClick={() => setViewingSurvey(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 my-4">
              {viewingSurvey.surveyQuestions?.map((q, qIdx) => {
                const votesMap = viewingSurvey.votes || {};
                const totalVotes = q.options.reduce((acc, opt) => acc + (votesMap[`q_${q.id}_o_${opt.id}`] || 0), 0);

                return (
                  <div key={q.id || qIdx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h4 className="font-bold text-gray-800 text-lg mb-3">
                      {qIdx + 1}. {q.questionText}
                    </h4>

                    <div className="space-y-3">
                      {q.options.map(opt => {
                        const optVotes = votesMap[`q_${q.id}_o_${opt.id}`] || 0;
                        const pct = totalVotes > 0 ? (optVotes / totalVotes) * 100 : 0;

                        return (
                          <div key={opt.id} className="space-y-1">
                            <div className="flex justify-between text-sm font-semibold">
                              <span>{opt.text}</span>
                              <span className="text-blue-700 font-bold">{pct.toFixed(1)}% ({optVotes})</span>
                            </div>
                            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 gap-2">
              <div>
                నిజమైన ఓట్లు: <strong className="text-gray-900">{viewingSurvey.realVotesCount || 0}</strong>
              </div>
              <div>
                బయటకు కనిపించే ఓట్లు: <strong className="text-blue-700">
                  {((viewingSurvey.fakeVotesBase || 500) + Math.max(0, Math.floor((Date.now() - (viewingSurvey.surveyCreatedAt || Date.now())) / 86400000)) * 527 + (viewingSurvey.realVotesCount || 0))}+
                </strong>
              </div>
            </div>

            <button
              onClick={() => setViewingSurvey(null)}
              className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-2xl font-bold transition-all"
            >
              మూసివేయి (Close)
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-ramabhadra text-2xl text-gray-900">
                {editingSurvey ? 'సర్వేను సవరించండి (Edit Survey)' : 'కొత్త సర్వేను రూపొందించండి (Create Survey)'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-700 text-2xl font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleSubmitSurvey} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">సర్వే శీర్షిక (Headline in Telugu)</label>
                <input
                  type="text"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="ఉదా: రాబోయే ఎన్నికల్లో మీ అభిప్రాయం ఏమిటి?"
                  className="w-full border border-gray-300 p-3.5 rounded-2xl text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">వివరణ (Optional Description)</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="సర్వే గురించి మరిన్ని వివరాలు..."
                  rows={2}
                  className="w-full border border-gray-300 p-3.5 rounded-2xl text-base outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">ప్రాంతం (Scope)</label>
                  <select
                    value={isGlobal ? 'GLOBAL' : 'LOCAL'}
                    onChange={e => setIsGlobal(e.target.value === 'GLOBAL')}
                    className="w-full border border-gray-300 p-3 rounded-xl font-bold bg-gray-50 outline-none"
                  >
                    <option value="GLOBAL">అన్ని ప్రాంతాలు (Global)</option>
                    <option value="LOCAL">నిర్దిష్ట జిల్లా (District Only)</option>
                  </select>
                </div>

                {!isGlobal && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">రాష్ట్రం</label>
                      <select
                        value={state}
                        onChange={e => {
                          setState(e.target.value);
                          setDistrict(e.target.value === 'TS' ? TS_DISTRICTS[0] : AP_DISTRICTS[0]);
                        }}
                        className="w-full border border-gray-300 p-3 rounded-xl font-bold bg-gray-50 outline-none"
                      >
                        <option value="TS">తెలంగాణ</option>
                        <option value="AP">ఆంధ్రప్రదేశ్</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">జిల్లా</label>
                      <select
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        className="w-full border border-gray-300 p-3 rounded-xl font-bold bg-gray-50 outline-none"
                      >
                        {(state === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Questions Builder */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 text-lg">ప్రశ్నలు & ఆప్షన్స్ (Questions & Choices)</h4>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100"
                  >
                    + ప్రశ్నను చేర్చు
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={q.id || qIdx} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-blue-800 text-sm">ప్రశ్న {qIdx + 1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          ప్రశ్నను తీసివేయి ✕
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.questionText}
                      onChange={e => updateQuestionText(qIdx, e.target.value)}
                      placeholder={`ప్రశ్న ${qIdx + 1} ని ఇక్కడ రాయండి...`}
                      className="w-full border border-gray-300 p-3 rounded-xl text-base font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />

                    {/* Options list */}
                    <div className="space-y-2 pl-2 border-l-2 border-blue-200">
                      <span className="text-xs font-bold text-gray-500 uppercase">ఆప్షన్స్ (Options):</span>
                      {q.options.map((opt, oIdx) => (
                        <div key={opt.id || oIdx} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 w-5">{oIdx + 1}.</span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => updateOptionText(qIdx, oIdx, e.target.value)}
                            placeholder={`ఆప్షన్ ${oIdx + 1}`}
                            className="flex-1 border border-gray-300 p-2.5 rounded-xl text-sm bg-white outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qIdx, oIdx)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}

                      {q.options.length < 6 && (
                        <button
                          type="button"
                          onClick={() => addOption(qIdx)}
                          className="text-xs font-bold text-blue-600 hover:underline pt-1"
                        >
                          + మరో ఆప్షన్ చేర్చు
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-2xl font-bold text-lg shadow-md transition-all active:scale-[0.99]"
                >
                  {isSubmitting ? 'సేవ్ అవుతోంది...' : editingSurvey ? 'సర్వేను అప్‌డేట్ చేయి' : 'సర్వేను పబ్లిష్ చేయి'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-2xl font-bold text-lg transition-colors"
                >
                  రద్దు
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSurveysPage;
