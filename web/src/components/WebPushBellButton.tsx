import React, { useEffect, useState } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import {
  getWebPushStatus,
  isWebPushSubscribed,
  requestNotificationPermission,
  WebPushPermissionStatus,
} from '../services/pushNotificationService';

interface WebPushBellButtonProps {
  userId?: string | null;
  district?: string | null;
  variant?: 'desktop' | 'mobile';
}

const WebPushBellButton: React.FC<WebPushBellButtonProps> = ({
  userId,
  district,
  variant = 'desktop',
}) => {
  const [status, setStatus] = useState<WebPushPermissionStatus>(() => getWebPushStatus());
  const [subscribed, setSubscribed] = useState<boolean>(() => isWebPushSubscribed());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setStatus(getWebPushStatus());
    setSubscribed(isWebPushSubscribed());
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (status === 'unsupported') return null;

  const handleToggleAlerts = async () => {
    if (loading) return;
    if (status === 'denied') {
      setFeedback('బ్రౌజర్ సెట్టింగ్స్‌లో నోటిఫికేషన్లు అనుమతించండి');
      return;
    }

    setLoading(true);
    const result = await requestNotificationPermission({ userId, district });
    setLoading(false);
    setStatus(result.status);
    setSubscribed(result.success);

    if (result.success) {
      setFeedback('తాజా వార్తల అలర్ట్స్ యాక్టివేట్ అయ్యాయి!');
    } else if (result.error) {
      setFeedback(result.error);
    }
  };

  const label = subscribed
    ? 'వార్తల అలర్ట్స్ ఆన్‌లో ఉన్నాయి'
    : status === 'denied'
      ? 'నోటిఫికేషన్లు బ్లాక్ అయ్యాయి'
      : 'తాజా వార్తల అలర్ట్స్ పొందండి';

  const Icon = loading ? Loader2 : subscribed ? BellRing : status === 'denied' ? BellOff : Bell;

  const buttonClass =
    variant === 'mobile'
      ? `p-2 rounded-full border transition-all active:scale-95 ${
          subscribed
            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
            : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
        }`
      : `p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-ramabhadra ${
          subscribed
            ? 'bg-emerald-600/90 hover:bg-emerald-700 text-white'
            : 'text-white/90 hover:text-white hover:bg-red-800'
        }`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggleAlerts}
        disabled={loading}
        className={buttonClass}
        aria-label={label}
        title={label}
        data-push-state={subscribed ? 'subscribed' : status}
      >
        <Icon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {variant === 'desktop' && (
          <span className="hidden xl:inline whitespace-nowrap">
            {subscribed ? 'అలర్ట్స్ ON' : 'అలర్ట్స్'}
          </span>
        )}
      </button>

      {feedback && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 w-60 rounded-lg bg-slate-900 text-white text-xs font-mallanna px-3 py-2 shadow-xl border border-slate-700 z-50 leading-snug"
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

export default WebPushBellButton;
