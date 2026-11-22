import React, { useEffect, useState } from 'react';
import { UserRole } from '../../types';
import { ALL_STATE_CODES, EDITIONS } from '../../data/editions';
import { MANDAL_DATA } from '../../data/mandalData';
import {
  findMandalOccupant,
  formatDisplayPhone,
  MandalOccupantEntry,
} from '../../utils/reporterManagementHelpers';
import {
  ConfirmModalConfig,
  FormerReporter,
  ReporterApplication,
  ReporterWithCounts,
} from './types';
import { AlertTriangle, CheckCircle2, MapPin, RotateCcw, X } from 'lucide-react';

function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}

interface ConfirmActionModalProps {
  config: ConfirmModalConfig | null;
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({ config, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (config) {
      setReason(config.defaultReason || '');
      setSubmitting(false);
    }
  }, [config]);

  useEscapeToClose(Boolean(config), () => {
    if (!submitting) onClose();
  });

  if (!config) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await config.onConfirm(config.requireReason ? reason : undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmBtnClass =
    config.tone === 'danger'
      ? 'bg-rose-700 hover:bg-rose-800 text-white'
      : config.tone === 'warning'
      ? 'bg-amber-700 hover:bg-amber-800 text-white'
      : 'bg-teal-700 hover:bg-teal-800 text-white';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {config.tone !== 'primary' && (
              <AlertTriangle
                size={20}
                className={config.tone === 'danger' ? 'text-rose-700 shrink-0 mt-0.5' : 'text-amber-700 shrink-0 mt-0.5'}
              />
            )}
            <h3 className="text-lg font-ramabhadra text-slate-900 leading-snug">{config.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
            aria-label="మూసివేయి"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">{config.description}</p>

        {config.requireReason && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {config.reasonLabel || 'కారణం (ఐచ్ఛికం)'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonPlaceholder || 'ఉదా: నిరంతర నిష్క్రియాత్మకత / అభ్యర్థన మేరకు'}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-teal-600 outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            రద్దు చేయి
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 whitespace-nowrap ${confirmBtnClass}`}
          >
            {submitting ? 'ప్రాసెస్ అవుతోంది...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ApplicationApprovalModalProps {
  application: ReporterApplication | null;
  occupiedMandalsMap: Record<string, MandalOccupantEntry[]>;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (override: { district: string; mandal: string; role: UserRole }) => Promise<boolean>;
}

export const ApplicationApprovalModal: React.FC<ApplicationApprovalModalProps> = ({
  application,
  occupiedMandalsMap,
  submitting,
  onClose,
  onConfirm,
}) => {
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.REPORTER);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (application) {
      setDistrict((application.district || application.state_district || '').trim());
      setMandal((application.mandal || '').trim());
      setRole(UserRole.REPORTER);
      setValidationError(null);
    }
  }, [application]);

  useEscapeToClose(Boolean(application), () => {
    if (!submitting) onClose();
  });

  if (!application) return null;

  const mandalOptions = district ? MANDAL_DATA[district] || [] : [];
  const hasCustomMandal = Boolean(mandal && !mandalOptions.includes(mandal));
  const occupant = findMandalOccupant(
    occupiedMandalsMap,
    district,
    mandal,
    application.userId || application.id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!district.trim() || !mandal.trim()) {
      setValidationError('దయచేసి జిల్లా మరియు మండలం రెండింటినీ ఎంచుకోండి.');
      return;
    }
    setValidationError(null);
    const ok = await onConfirm({ district: district.trim(), mandal: mandal.trim(), role });
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-teal-700 shrink-0" />
            <h3 className="text-lg font-ramabhadra text-slate-900">రిపోర్టర్ దరఖాస్తు ఆమోదం</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            aria-label="మూసివేయి"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-slate-700 space-y-0.5">
          <div className="font-bold text-slate-900 text-base">{application.name || 'పేరు లేదు'}</div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {formatDisplayPhone(application.phone || application.phoneNumber) || 'ఫోన్ లేదు'}
            {application.education ? ` · ${application.education}` : ''}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">జిల్లా (District)</label>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setMandal('');
                setValidationError(null);
              }}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none"
            >
              <option value="">-- జిల్లా ఎంచుకోండి --</option>
              {ALL_STATE_CODES.map((code) => (
                <optgroup key={code} label={`${EDITIONS[code].nameNative} (${code})`}>
                  {EDITIONS[code].districts.map((d) => (
                    <option key={`${code}_${d}`} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">మండలం (Mandal)</label>
            <select
              value={mandal}
              onChange={(e) => {
                setMandal(e.target.value);
                setValidationError(null);
              }}
              disabled={!district}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none disabled:bg-slate-50"
            >
              <option value="">-- మండలం ఎంచుకోండి --</option>
              {hasCustomMandal && <option value={mandal}>{mandal} (దరఖాస్తు చేసినది)</option>}
              {mandalOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ప్రారంభ హోదా (Role)</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none"
          >
            <option value={UserRole.REPORTER}>రిపోర్టర్ (Mandal Reporter)</option>
            <option value={UserRole.STAFF_REPORTER}>స్టాఫ్ రిపోర్టర్ (Staff Reporter)</option>
            <option value={UserRole.REGIONAL_INCHARGE}>రీజినల్ ఇంచార్జ్ (Regional Incharge)</option>
          </select>
        </div>

        {occupant && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <span>
              ఈ మండలంలో ఇప్పటికే యాక్టివ్ రిపోర్టర్ ఉన్నారు: <strong className="font-bold">{occupant.label}</strong>. కావాలంటే పైన వేరే మండలం ఎంచుకోవచ్చు లేదా అలాగే ఆమోదించవచ్చు.
            </span>
          </div>
        )}

        {validationError && (
          <p className="text-xs font-bold text-rose-700">{validationError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            రద్దు చేయి
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'ఆమోదిస్తోంది...' : 'నియమించు & ఆమోదించు'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface LocationEditModalProps {
  reporter: ReporterWithCounts | null;
  occupiedMandalsMap: Record<string, MandalOccupantEntry[]>;
  submitting: boolean;
  onClose: () => void;
  onSave: (district: string, mandal: string) => Promise<boolean>;
}

export const LocationEditModal: React.FC<LocationEditModalProps> = ({
  reporter,
  occupiedMandalsMap,
  submitting,
  onClose,
  onSave,
}) => {
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reporter) {
      setDistrict((reporter.district || '').trim());
      setMandal((reporter.assignedMandal || reporter.mandal || '').trim());
      setError(null);
    }
  }, [reporter]);

  useEscapeToClose(Boolean(reporter), () => {
    if (!submitting) onClose();
  });

  if (!reporter) return null;

  const mandalOptions = district ? MANDAL_DATA[district] || [] : [];
  const hasCustomMandal = Boolean(mandal && !mandalOptions.includes(mandal));
  const occupant = findMandalOccupant(occupiedMandalsMap, district, mandal, reporter.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!district.trim() || !mandal.trim()) {
      setError('దయచేసి జిల్లా మరియు మండలం రెండింటినీ ఎంచుకోండి.');
      return;
    }
    setError(null);
    const ok = await onSave(district.trim(), mandal.trim());
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-ramabhadra text-slate-900 flex items-center gap-2">
            <MapPin size={19} className="text-teal-700" />
            <span>మండలం కేటాయింపు మార్పు</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            aria-label="మూసివేయి"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm">
          <div className="font-bold text-slate-900">{reporter.name}</div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {formatDisplayPhone(reporter.phone) || 'ఫోన్ లేదు'}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">జిల్లా (District)</label>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setMandal('');
                setError(null);
              }}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none"
            >
              <option value="">-- జిల్లా ఎంచుకోండి --</option>
              {ALL_STATE_CODES.map((code) => (
                <optgroup key={code} label={`${EDITIONS[code].nameNative} (${code})`}>
                  {EDITIONS[code].districts.map((d) => (
                    <option key={`${code}_${d}`} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">మండలం (Mandal)</label>
            <select
              value={mandal}
              onChange={(e) => {
                setMandal(e.target.value);
                setError(null);
              }}
              disabled={!district}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none disabled:bg-slate-50"
            >
              <option value="">-- మండలం ఎంచుకోండి --</option>
              {hasCustomMandal && <option value={mandal}>{mandal}</option>}
              {mandalOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {occupant && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <span>
              గమనిక: ఈ మండలంలో ప్రస్తుతం <strong className="font-bold">{occupant.label}</strong> ఉన్నారు.
            </span>
          </div>
        )}

        {error && <p className="text-xs font-bold text-rose-700">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            రద్దు చేయి
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'సేవ్ అవుతోంది...' : 'లొకేషన్ సేవ్ చేయి'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface ReinstateReporterModalProps {
  former: FormerReporter | null;
  occupiedMandalsMap: Record<string, MandalOccupantEntry[]>;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (assignment: { district: string; mandal: string; role: UserRole }) => Promise<boolean>;
}

export const ReinstateReporterModal: React.FC<ReinstateReporterModalProps> = ({
  former,
  occupiedMandalsMap,
  submitting,
  onClose,
  onConfirm,
}) => {
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.REPORTER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (former) {
      setDistrict((former.district || '').trim());
      setMandal((former.assignedMandal || former.mandal || '').trim());
      const prevRole = former.previousRole;
      if (
        prevRole === UserRole.STAFF_REPORTER ||
        prevRole === UserRole.REGIONAL_INCHARGE ||
        prevRole === UserRole.REPORTER
      ) {
        setRole(prevRole);
      } else {
        setRole(UserRole.REPORTER);
      }
      setError(null);
    }
  }, [former]);

  useEscapeToClose(Boolean(former), () => {
    if (!submitting) onClose();
  });

  if (!former) return null;

  const mandalOptions = district ? MANDAL_DATA[district] || [] : [];
  const hasCustomMandal = Boolean(mandal && !mandalOptions.includes(mandal));
  const occupant = findMandalOccupant(occupiedMandalsMap, district, mandal, former.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!district.trim() || !mandal.trim()) {
      setError('దయచేసి జిల్లా మరియు మండలం ఎంచుకోండి.');
      return;
    }
    setError(null);
    const ok = await onConfirm({ district: district.trim(), mandal: mandal.trim(), role });
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => !submitting && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-ramabhadra text-slate-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-teal-700" />
            <span>రిపోర్టర్‌గా తిరిగి నియామకం</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            aria-label="మూసివేయి"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-slate-700">
          <div className="font-bold text-slate-900">{former.name}</div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {formatDisplayPhone(former.phone) || 'ఫోన్ లేదు'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">జిల్లా (District)</label>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setMandal('');
                setError(null);
              }}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none"
            >
              <option value="">-- జిల్లా ఎంచుకోండి --</option>
              {ALL_STATE_CODES.map((code) => (
                <optgroup key={code} label={`${EDITIONS[code].nameNative} (${code})`}>
                  {EDITIONS[code].districts.map((d) => (
                    <option key={`${code}_${d}`} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">మండలం (Mandal)</label>
            <select
              value={mandal}
              onChange={(e) => {
                setMandal(e.target.value);
                setError(null);
              }}
              disabled={!district}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none disabled:bg-slate-50"
            >
              <option value="">-- మండలం ఎంచుకోండి --</option>
              {hasCustomMandal && <option value={mandal}>{mandal}</option>}
              {mandalOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">హోదా (Role)</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-teal-600 outline-none"
          >
            <option value={UserRole.REPORTER}>రిపోర్టర్</option>
            <option value={UserRole.STAFF_REPORTER}>స్టాఫ్ రిపోర్టర్</option>
            <option value={UserRole.REGIONAL_INCHARGE}>రీజినల్ ఇంచార్జ్</option>
          </select>
        </div>

        {occupant && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <span>
              ఈ మండలంలో ప్రస్తుతం <strong className="font-bold">{occupant.label}</strong> ఉన్నారు.
            </span>
          </div>
        )}

        {error && <p className="text-xs font-bold text-rose-700">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            రద్దు చేయి
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'నియమిస్తోంది...' : 'తిరిగి నియమించు'}
          </button>
        </div>
      </form>
    </div>
  );
};
