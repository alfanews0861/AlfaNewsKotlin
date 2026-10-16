import React, { useState, useEffect } from 'react';
import { NewsPost, Language, User, SurveyQuestion, SurveyOption } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { CheckCircle2, Clock, Share2, BarChart3, AlertCircle } from 'lucide-react';

const { doc, updateDoc, setDoc, getDoc, onSnapshot, increment, serverTimestamp } = _firestore as any;

interface SurveyCardProps {
  post: NewsPost;
  language: Language;
  currentUser: User | null;
  onProfileClick: () => void;
}

export const SurveyCard: React.FC<SurveyCardProps> = ({
  post,
  language,
  currentUser,
  onProfileClick
}) => {
  const isExpired = post.expiryTimestamp
    ? Date.now() > post.expiryTimestamp
    : (Date.now() > ((post.surveyCreatedAt || post.timestamp || Date.now()) + 7 * 86400000));

  const [hasVoted, setHasVoted] = useState<boolean>(() => {
    return isExpired || localStorage.getItem(`alfa_survey_voted_${post.id}`) === 'true';
  });

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const [liveVotes, setLiveVotes] = useState<Record<string, number>>(post.votes || {});
  const [liveRealVotesCount, setLiveRealVotesCount] = useState<number>(post.realVotesCount || 0);

  // Check Firestore voted receipt
  useEffect(() => {
    if (isExpired) {
      setHasVoted(true);
      return;
    }
    if (currentUser?.id) {
      getDoc(doc(db, 'news', post.id, 'voted_users', currentUser.id))
        .then((snap: any) => {
          if (snap && snap.exists()) {
            setHasVoted(true);
            localStorage.setItem(`alfa_survey_voted_${post.id}`, 'true');
          }
        })
        .catch(() => {});
    }
  }, [post.id, currentUser?.id, isExpired]);

  // Real-time vote counts listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'news', post.id), (docSnap: any) => {
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        if (data.votes) setLiveVotes(data.votes);
        if (typeof data.realVotesCount === 'number') setLiveRealVotesCount(data.realVotesCount);
      }
    });
    return () => unsub();
  }, [post.id]);

  const questions: SurveyQuestion[] = post.surveyQuestions || [];
  const currentQuestion: SurveyQuestion | undefined = questions[currentPageIndex];

  const handleSelectOption = async (questionId: string, optionId: string, nextQId?: string | null) => {
    if (isExpired) return;
    if (!currentUser) {
      onProfileClick();
      return;
    }

    const updatedAnswers = { ...selectedAnswers, [questionId]: optionId };
    setSelectedAnswers(updatedAnswers);

    if (post.isMultiPage && questions.length > 1) {
      if (nextQId === 'END' || currentPageIndex === questions.length - 1) {
        await submitVote(updatedAnswers);
      } else if (nextQId) {
        const targetIdx = questions.findIndex(q => q.id === nextQId);
        if (targetIdx !== -1) {
          setCurrentPageIndex(targetIdx);
        } else {
          setCurrentPageIndex(prev => Math.min(prev + 1, questions.length - 1));
        }
      } else {
        setCurrentPageIndex(prev => Math.min(prev + 1, questions.length - 1));
      }
    } else {
      await submitVote(updatedAnswers);
    }
  };

  const submitVote = async (answers: Record<string, string>) => {
    if (isSubmitting || !currentUser?.id) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {
        realVotesCount: increment(1)
      };
      Object.entries(answers).forEach(([qId, oId]) => {
        updates[`votes.q_${qId}_o_${oId}`] = increment(1);
        updates[`votes.${oId}`] = increment(1);
      });

      await updateDoc(doc(db, 'news', post.id), updates);
      await setDoc(doc(db, 'news', post.id, 'voted_users', currentUser.id), {
        userId: currentUser.id,
        timestamp: serverTimestamp(),
        answers
      });

      localStorage.setItem(`alfa_survey_voted_${post.id}`, 'true');
      setHasVoted(true);
    } catch (e: any) {
      console.error('Error submitting vote:', e);
      alert(language === Language.TELUGU ? 'ఓటు నమోదు చేయడంలో లోపం జరిగింది.' : 'Failed to record vote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysSinceCreation = Math.max(
    0,
    Math.floor((Date.now() - (post.surveyCreatedAt || post.timestamp || Date.now())) / 86400000)
  );
  const displayedVotesCount =
    (post.fakeVotesBase || 11000) + daysSinceCreation * 527 + liveRealVotesCount;

  const headlineText = language === Language.TELUGU ? (post.headline?.telugu || '') : (post.headline?.english || '');
  const contentText = language === Language.TELUGU ? (post.content?.telugu || '') : (post.content?.english || '');

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      let shareBody = `${headlineText}\n\n`;
      questions.forEach((q) => {
        shareBody += `${q.questionText}\n`;
        const qTotal = q.options.reduce((acc, o) => acc + (liveVotes[`q_${q.id}_o_${o.id}`] || liveVotes[o.id] || 0), 0);
        q.options.forEach((opt) => {
          const v = liveVotes[`q_${q.id}_o_${opt.id}`] || liveVotes[opt.id] || 0;
          const pct = qTotal > 0 ? (v * 100 / qTotal).toFixed(1) : '0.0';
          shareBody += `- ${opt.text}: ${pct}%\n`;
        });
        shareBody += '\n';
      });

      shareBody += `మొత్తం అభిప్రాయాలు: ${displayedVotesCount.toLocaleString()}+\n`;
      shareBody += `మీ ఓటు వేయడానికి లింక్ క్లిక్ చేయండి: https://alfanews.app/news/${post.id}`;

      if (navigator.share) {
        await navigator.share({
          title: headlineText,
          text: shareBody,
          url: `https://alfanews.app/news/${post.id}`
        });
      } else {
        await navigator.clipboard.writeText(shareBody);
        alert(language === Language.TELUGU ? 'లింక్ మరియు వివరాలు కాపీ చేయబడ్డాయి!' : 'Share text copied!');
      }
    } catch (e) {
      console.warn('Share canceled or failed', e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="w-full h-full snap-start snap-always shrink-0 overflow-y-auto text-white bg-gradient-to-b from-slate-900 via-zinc-950 to-black flex flex-col p-6 sm:p-8 border-b border-white/5">
      {/* Header Meta */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
            📊 {language === Language.TELUGU ? 'ప్రజాభిప్రాయ సేకరణ' : 'Public Survey'}
          </span>
          <span className="text-gray-300 font-semibold">
            {post.reporter?.name || 'Alfa News'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>{post.isGlobal ? (language === Language.TELUGU ? 'రాష్ట్రం' : 'State') : (post.district || 'State')}</span>
        </div>
      </div>

      {/* Main Title & Description */}
      <h1 className="font-ramabhadra text-2xl sm:text-3xl leading-snug text-white font-bold mb-2">
        {headlineText}
      </h1>
      {contentText && (
        <p className="font-mallanna text-base sm:text-lg text-gray-300 leading-relaxed mb-6">
          {contentText}
        </p>
      )}

      {/* Expiry Banner */}
      {isExpired && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-600/30 text-amber-300 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold mb-6">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{language === Language.TELUGU ? 'ఈ సర్వే గడువు ముగిసింది. అంతిమ ఫలితాలు కింద చూడవచ్చు.' : 'This survey has ended. Final results are shown below.'}</span>
        </div>
      )}

      {/* Survey Body: Questionnaire vs Results */}
      {!hasVoted && !isExpired && currentQuestion ? (
        <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto my-auto space-y-4">
          {post.isMultiPage && questions.length > 1 && (
            <div className="flex items-center justify-between text-xs text-blue-400 font-semibold mb-1">
              <span>ప్రశ్న {currentPageIndex + 1} / {questions.length}</span>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${((currentPageIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
            {currentQuestion.questionText}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswers[currentQuestion.id] === option.id;
              return (
                <button
                  key={option.id}
                  disabled={isSubmitting}
                  onClick={() => handleSelectOption(currentQuestion.id, option.id, option.nextQuestionId)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-base sm:text-lg">{option.text}</span>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {!currentUser && (
            <p className="text-xs text-center text-gray-400 mt-2">
              {language === Language.TELUGU ? '* ఓటు వేయడానికి లాగిన్ అవ్వడం అవసరం.' : '* Login required to cast your vote.'}
            </p>
          )}
        </div>
      ) : (
        /* Results Section */
        <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto my-auto space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">
                {isExpired
                  ? (language === Language.TELUGU ? 'అంతిమ ఫలితాలు' : 'Final Results')
                  : (language === Language.TELUGU ? 'సర్వే లైవ్ ఫలితాలు' : 'Live Results')}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isExpired ? 'ముగిసింది' : 'ఓటు నమోదైంది'}</span>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const qTotal = q.options.reduce(
                (acc, opt) => acc + (liveVotes[`q_${q.id}_o_${opt.id}`] || liveVotes[opt.id] || 0),
                0
              );

              return (
                <div key={q.id || qIdx} className="space-y-3">
                  <p className="font-semibold text-gray-200 text-sm sm:text-base">
                    {questions.length > 1 ? `${qIdx + 1}. ` : ''}{q.questionText}
                  </p>

                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const count = liveVotes[`q_${q.id}_o_${opt.id}`] || liveVotes[opt.id] || 0;
                      const pct = qTotal > 0 ? (count * 100 / qTotal) : 0;

                      return (
                        <div key={opt.id} className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 p-3">
                          <div
                            className="absolute inset-y-0 left-0 bg-blue-600/30 border-r border-blue-500/50 transition-all duration-700"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                          <div className="relative z-10 flex items-center justify-between text-sm sm:text-base">
                            <span className="font-medium text-white">{opt.text}</span>
                            <span className="font-bold text-blue-400">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aggregate counts footer */}
          <div className="pt-2 text-center text-xs text-gray-400 font-medium">
            మొత్తం అభిప్రాయాలు: <strong className="text-white">{displayedVotesCount.toLocaleString()}+</strong>
          </div>

          {/* Share Results Button */}
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>{language === Language.TELUGU ? 'ఫలితాలను షేర్ చేయండి' : 'Share Results'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SurveyCard;
