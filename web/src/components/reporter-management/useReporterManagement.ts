import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { app, db } from '../../services/firebase';
import {
  ReporterReminderLog,
  ReporterTrackingConfig,
  User,
  UserRole,
} from '../../types';
import {
  DEFAULT_TRACKING_CONFIG,
  extractCanonicalReporterMetrics,
  parseEpochMs,
} from '../../utils/reporterTracking';
import {
  buildOccupiedMandalsMap,
  deduplicateFormerReporters,
  resolveSmartDefaultTab,
} from '../../utils/reporterManagementHelpers';
import {
  FormerReporter,
  ReporterApplication,
  ReporterDrawerDetails,
  ReporterRecentArticle,
  ReporterTab,
  ReporterWithCounts,
  ToastNotice,
} from './types';
import {
  ALL_NEWS_COLLECTIONS,
  getCollectionForEdition,
  getLocalizedText,
  resolveStateCode,
} from '../../data/editions';

const {
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  where,
  orderBy,
  limit,
} = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;
const functions = getFunctions(app, 'asia-south1');

const REPORTER_QUERY_ROLES: (string | number)[] = [
  UserRole.REPORTER,
  'reporter',
  UserRole.STAFF_REPORTER,
  'staff_reporter',
  UserRole.REGIONAL_INCHARGE,
  'regional_incharge',
  2,
  '2',
  3,
  '3',
];

function parseReporterDoc(
  id: string,
  data: any,
  nowMs: number,
  config: ReporterTrackingConfig
): ReporterWithCounts {
  const metrics = extractCanonicalReporterMetrics(data, nowMs, config);
  return {
    id,
    ...data,
    referralCount: typeof data.referralCount === 'number' ? data.referralCount : 0,
    totalNewsCount: metrics.totalNewsCount,
    todayNewsCount: metrics.todayNewsCount,
    lastWeekNewsCount: metrics.lastWeekNewsCount,
    last30DaysNewsCount: metrics.last30DaysNewsCount,
    lastPostTimestamp: metrics.lastPostTimestamp,
    joinedAt: metrics.joinedAt,
    daysSinceJoined: metrics.daysSinceJoined,
    daysInactive: metrics.daysInactive,
    inactivityStage: metrics.inactivityStage,
    isNewlyJoined: metrics.isNewlyJoined,
  } as ReporterWithCounts;
}

export function useReporterManagement(currentUser: User) {
  const [selectedTab, setSelectedTabState] = useState<ReporterTab>('reporters');
  const userPickedTabRef = useRef(false);

  const [trackingConfig, setTrackingConfig] = useState<ReporterTrackingConfig>(DEFAULT_TRACKING_CONFIG);
  const trackingConfigRef = useRef<ReporterTrackingConfig>(DEFAULT_TRACKING_CONFIG);

  const [applications, setApplications] = useState<ReporterApplication[]>([]);
  const [reporters, setReporters] = useState<ReporterWithCounts[]>([]);
  const [formerReporters, setFormerReporters] = useState<FormerReporter[]>([]);
  const [formerLoaded, setFormerLoaded] = useState(false);

  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingReporters, setLoadingReporters] = useState(true);
  const [loadingFormer, setLoadingFormer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [isSyncingLeaderboard, setIsSyncingLeaderboard] = useState(false);

  const [toast, setToast] = useState<ToastNotice | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Per-session cache for Detail Drawer bounded queries
  const [drawerCache, setDrawerCache] = useState<Record<string, ReporterDrawerDetails>>({});
  const [loadingDrawerId, setLoadingDrawerId] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now();
    setToast({ id, type, text });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
    }, 6000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const setSelectedTab = useCallback((tab: ReporterTab) => {
    userPickedTabRef.current = true;
    setSelectedTabState(tab);
  }, []);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setUpdatingIds((prev) => ({ ...prev, [id]: busy }));
  }, []);

  const updateTrackingConfig = useCallback((cfg: ReporterTrackingConfig) => {
    trackingConfigRef.current = cfg;
    setTrackingConfig(cfg);
    const nowMs = Date.now();
    setReporters((prev) => prev.map((rep) => parseReporterDoc(rep.id, rep, nowMs, cfg)));
  }, []);

  const fetchReporters = useCallback(async (configOverride?: ReporterTrackingConfig) => {
    setLoadingReporters(true);
    try {
      const activeCfg = configOverride || trackingConfigRef.current;
      const q = query(
        collection(db, 'users'),
        where('role', 'in', REPORTER_QUERY_ROLES),
        limit(500)
      );
      const snap = await getDocs(q);
      const nowMs = Date.now();

      const activeList: ReporterWithCounts[] = [];
      const flaggedFormer: FormerReporter[] = [];

      snap.docs.forEach((userDoc: any) => {
        const data = userDoc.data();
        if (data.suspended === true || data.previouslyDowngraded === true) {
          flaggedFormer.push({ id: userDoc.id, ...data } as FormerReporter);
          return;
        }
        activeList.push(parseReporterDoc(userDoc.id, data, nowMs, activeCfg));
      });

      setReporters(activeList);
      if (flaggedFormer.length > 0) {
        setFormerReporters((prev) => deduplicateFormerReporters([...prev, ...flaggedFormer]));
      }
      setLoadingReporters(false);

      // Non-blocking background enrichment for today's approved reporter news across all 5 edition collections (bounded)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      Promise.allSettled(
        ALL_NEWS_COLLECTIONS.map((colName) =>
          getDocs(
            query(
              collection(db, colName),
              where('approved', '==', true),
              where('isReporter', '==', true),
              where('timestamp', '>=', startOfToday),
              limit(colName === 'news' ? 200 : 80)
            )
          )
        )
      )
        .then((results) => {
          const allDocs: any[] = [];
          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value?.docs) {
              allDocs.push(...r.value.docs);
            }
          });
          if (allDocs.length === 0) return;
          const liveTodayCounts: Record<string, number> = {};
          allDocs.forEach((d: any) => {
            const nData = d.data();
            if (nData.isCitizen === true) return;
            const canonicalId =
              (typeof nData.originalReporterId === 'string' && nData.originalReporterId.trim()) ||
              (typeof nData.reporter === 'object'
                ? nData.reporter?.id
                : typeof nData.reporter === 'string'
                ? nData.reporter
                : null) ||
              nData.reporterId;
            if (
              !canonicalId ||
              String(canonicalId).toUpperCase().startsWith('BOT_') ||
              canonicalId === 'ALFA_DESK'
            ) {
              return;
            }
            liveTodayCounts[canonicalId] = (liveTodayCounts[canonicalId] || 0) + 1;
          });

          setReporters((prev) =>
            prev.map((rep) => {
              const liveToday = liveTodayCounts[rep.id] || 0;
              if (liveToday > (rep.todayNewsCount || 0)) {
                return {
                  ...rep,
                  todayNewsCount: liveToday,
                  lastWeekNewsCount: Math.max(rep.lastWeekNewsCount || 0, liveToday),
                  last30DaysNewsCount: Math.max(rep.last30DaysNewsCount || 0, liveToday),
                  totalNewsCount: Math.max(rep.totalNewsCount || 0, liveToday),
                  daysInactive: 0,
                  inactivityStage: rep.exemptFromInactivity ? 'EXEMPT' : 'ACTIVE',
                };
              }
              return rep;
            })
          );
        })
        .catch(() => {});

      return activeList;
    } catch (err: any) {
      console.error('Error fetching reporters:', err);
      setLoadError(`రిపోర్టర్ల జాబితా లోడ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
      setLoadingReporters(false);
      return [];
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setLoadingApps(true);
    try {
      const appsSnap = await getDocs(query(collection(db, 'reporter_applications'), limit(400)));
      const list: ReporterApplication[] = appsSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));
      list.sort((a, b) => {
        const aTs = parseEpochMs(a.timestamp) ?? 0;
        const bTs = parseEpochMs(b.timestamp) ?? 0;
        return bTs - aTs;
      });
      setApplications(list);
      return list;
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      setLoadError(`దరఖాస్తులు లోడ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
      return [];
    } finally {
      setLoadingApps(false);
    }
  }, []);

  const fetchFormerReporters = useCallback(async () => {
    setLoadingFormer(true);
    try {
      const [prevDownSnap, suspendedSnap, downAtSnap] = await Promise.allSettled([
        getDocs(query(collection(db, 'users'), where('previouslyDowngraded', '==', true), limit(150))),
        getDocs(query(collection(db, 'users'), where('suspended', '==', true), limit(150))),
        getDocs(query(collection(db, 'users'), where('downgradedAt', '>', 0), limit(150))),
      ]);

      const collected: FormerReporter[] = [];
      for (const res of [prevDownSnap, suspendedSnap, downAtSnap]) {
        if (res.status === 'fulfilled' && res.value?.docs) {
          res.value.docs.forEach((d: any) => {
            const data = d.data();
            // Exclude anyone currently active and neither suspended nor previously downgraded
            const isActiveRole = REPORTER_QUERY_ROLES.includes(data.role);
            if (isActiveRole && data.suspended !== true && data.previouslyDowngraded !== true) {
              return;
            }
            collected.push({ id: d.id, ...data } as FormerReporter);
          });
        }
      }

      setFormerReporters((prev) => {
        const merged = deduplicateFormerReporters([...prev, ...collected]);
        return merged.filter((u) => {
          const isActiveRole = REPORTER_QUERY_ROLES.includes(u.role);
          return !isActiveRole || u.suspended === true || u.previouslyDowngraded === true;
        });
      });
      setFormerLoaded(true);
    } catch (err: any) {
      console.error('Error fetching former reporters:', err);
      showToast('error', `మాజీ రిపోర్టర్ల జాబితా లోడ్ విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingFormer(false);
    }
  }, [showToast]);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setLoadError(null);
    try {
      // Load live tracking config first/parallel so inactivity stages use real saved thresholds immediately
      let liveConfig = trackingConfigRef.current;
      const configPromise = (async () => {
        try {
          const fn = httpsCallable(functions, 'getReporterTrackingSettings');
          const res: any = await fn();
          if (res?.data?.config) {
            liveConfig = { ...DEFAULT_TRACKING_CONFIG, ...res.data.config };
            trackingConfigRef.current = liveConfig;
            setTrackingConfig(liveConfig);
          }
        } catch {
          // Graceful fallback to DEFAULT_TRACKING_CONFIG
        }
        return liveConfig;
      })();

      const [resolvedCfg, appsList] = await Promise.all([configPromise, fetchApplications()]);
      await fetchReporters(resolvedCfg);

      if (!userPickedTabRef.current) {
        const pendingCount = appsList.filter((a) => {
          const s = (a.status || 'PENDING').toUpperCase();
          return s !== 'JOINED' && s !== 'APPROVED' && s !== 'REJECTED';
        }).length;
        setSelectedTabState(resolveSmartDefaultTab(pendingCount));
      }
    } finally {
      setLoadingWorkspace(false);
    }
  }, [fetchApplications, fetchReporters]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Lazy-load former reporters on first visit to the Former tab
  useEffect(() => {
    if (selectedTab === 'former' && !formerLoaded && !loadingFormer) {
      fetchFormerReporters();
    }
  }, [selectedTab, formerLoaded, loadingFormer, fetchFormerReporters]);

  // Live occupied mandals lookup derived from active reporters (zero extra Firestore reads)
  const occupiedMandalsMap = useMemo(() => buildOccupiedMandalsMap(reporters), [reporters]);

  const pendingAppsCount = useMemo(
    () =>
      applications.filter((a) => {
        const status = (a.status || 'PENDING').toUpperCase();
        return status !== 'JOINED' && status !== 'APPROVED' && status !== 'REJECTED';
      }).length,
    [applications]
  );

  const totalReferralInstalls = useMemo(
    () => reporters.reduce((acc, r) => acc + (r.referralCount || 0), 0),
    [reporters]
  );

  // On-demand bounded loader for Reporter Profile & History Side Drawer
  const loadReporterDrawerDetails = useCallback(
    async (reporterId: string, forceRefresh = false) => {
      if (!forceRefresh && drawerCache[reporterId]) {
        return drawerCache[reporterId];
      }
      setLoadingDrawerId(reporterId);
      try {
        const repObj = reporters.find((r) => r.id === reporterId);
        const repState = resolveStateCode((repObj as any)?.stateCode || (repObj as any)?.state, repObj?.district);
        const repEditionCol = getCollectionForEdition(repState || 'AP', (repObj as any)?.language);
        const targetCols = Array.from(new Set([repEditionCol, 'news']));

        const newsQueries: Promise<any>[] = [];
        for (const colName of targetCols) {
          newsQueries.push(
            getDocs(
              query(
                collection(db, colName),
                where('reporter.id', '==', reporterId),
                orderBy('timestamp', 'desc'),
                limit(10)
              )
            ).then((snap: any) => ({ snap, isCross: false })),
            getDocs(
              query(
                collection(db, colName),
                where('originalReporterId', '==', reporterId),
                orderBy('timestamp', 'desc'),
                limit(10)
              )
            ).then((snap: any) => ({ snap, isCross: true }))
          );
        }

        const [logsRes, ...newsResults] = await Promise.allSettled([
          getDocs(
            query(
              collection(db, 'reporter_reminder_logs'),
              where('reporterId', '==', reporterId),
              limit(15)
            )
          ),
          ...newsQueries,
        ]);

        const articleMap = new Map<string, ReporterRecentArticle>();
        const ingestSnap = (snap: any, isCrossQuery: boolean) => {
          if (!snap?.docs) return;
          snap.docs.forEach((d: any) => {
            const data = d.data();
            const headline =
              getLocalizedText(data.headline, data.language || 'te') ||
              data.title ||
              'శీర్షిక లేదు';
            const ts = parseEpochMs(data.timestamp) ?? parseEpochMs(data.createdAt) ?? 0;
            const existing = articleMap.get(d.id);
            articleMap.set(d.id, {
              id: d.id,
              headline: String(headline),
              district: data.district || data.location || '',
              mandal: data.mandal || '',
              timestamp: ts,
              approved: data.approved === true,
              isCrossMandal:
                Boolean(existing?.isCrossMandal) ||
                isCrossQuery ||
                (Boolean(data.originalReporterId) && data.reporter?.name === 'Alfa News Desk'),
              mediaType: data.mediaType,
            });
          });
        };

        newsResults.forEach((res) => {
          if (res.status === 'fulfilled' && res.value?.snap) {
            ingestSnap(res.value.snap, Boolean(res.value.isCross));
          }
        });

        const articles = Array.from(articleMap.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);

        const reminderLogs: ReporterReminderLog[] = [];
        if (logsRes.status === 'fulfilled' && logsRes.value?.docs) {
          logsRes.value.docs.forEach((d: any) => {
            reminderLogs.push({ id: d.id, ...d.data() } as ReporterReminderLog);
          });
        }
        reminderLogs.sort((a, b) => (parseEpochMs(b.timestamp) ?? 0) - (parseEpochMs(a.timestamp) ?? 0));

        const entry: ReporterDrawerDetails = {
          articles,
          reminderLogs,
          loadedAt: Date.now(),
        };
        setDrawerCache((prev) => ({ ...prev, [reporterId]: entry }));
        return entry;
      } catch (err: any) {
        console.error('Error loading reporter drawer details:', err);
        showToast('error', `రిపోర్టర్ చరిత్ర లోడ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
        return null;
      } finally {
        setLoadingDrawerId((curr) => (curr === reporterId ? null : curr));
      }
    },
    [drawerCache, showToast]
  );

  // Mutations (zero native browser alert/confirm)
  const approveApplication = useCallback(
    async (
      appRecord: ReporterApplication,
      override: { district: string; mandal: string; role: UserRole }
    ) => {
      setBusy(appRecord.id, true);
      try {
        const targetUserId = appRecord.userId || appRecord.id;
        const cleanDistrict = override.district.trim();
        const cleanMandal = override.mandal.trim();
        const assignedRole = override.role || UserRole.REPORTER;
        const nowMs = Date.now();

        const userPatch = {
          role: assignedRole,
          district: cleanDistrict,
          state_district: cleanDistrict,
          assignedMandal: cleanMandal,
          mandal: cleanMandal,
          name: appRecord.name || 'Reporter',
          phone: appRecord.phone || appRecord.phoneNumber || '',
          promotedAt: nowMs,
          rejoinedAt: nowMs,
          suspended: false,
          previouslyDowngraded: false,
          'reporterActivity.inactivityStage': 'ACTIVE',
        };

        await updateDoc(doc(db, 'users', targetUserId), userPatch).catch(async () => {
          await setDoc(
            doc(db, 'users', targetUserId),
            {
              role: assignedRole,
              district: cleanDistrict,
              state_district: cleanDistrict,
              assignedMandal: cleanMandal,
              mandal: cleanMandal,
              name: appRecord.name || 'Reporter',
              phone: appRecord.phone || appRecord.phoneNumber || '',
              promotedAt: nowMs,
              rejoinedAt: nowMs,
              suspended: false,
              previouslyDowngraded: false,
              reporterActivity: { totalApprovedPosts: 0, inactivityStage: 'ACTIVE' },
            },
            { merge: true }
          );
        });

        await updateDoc(doc(db, 'reporter_applications', appRecord.id), {
          status: 'JOINED',
          district: cleanDistrict,
          mandal: cleanMandal,
          approvedAt: nowMs,
          approvedBy: currentUser.name || 'Admin',
        });

        setApplications((prev) =>
          prev.map((a) =>
            a.id === appRecord.id
              ? { ...a, status: 'JOINED', district: cleanDistrict, mandal: cleanMandal, approvedAt: nowMs }
              : a
          )
        );
        await fetchReporters();
        showToast(
          'success',
          `${appRecord.name || 'దరఖాస్తుదారు'} గారు ${cleanDistrict} · ${cleanMandal} రిపోర్టర్‌గా ఆమోదించబడ్డారు.`
        );
        return true;
      } catch (err: any) {
        showToast('error', `ఆమోదించడంలో లోపం: ${err?.message || 'Unknown error'}`);
        return false;
      } finally {
        setBusy(appRecord.id, false);
      }
    },
    [currentUser.name, fetchReporters, setBusy, showToast]
  );

  const rejectApplication = useCallback(
    async (appRecord: ReporterApplication) => {
      setBusy(appRecord.id, true);
      try {
        const nowMs = Date.now();
        await updateDoc(doc(db, 'reporter_applications', appRecord.id), {
          status: 'REJECTED',
          rejectedAt: nowMs,
          rejectedBy: currentUser.name || 'Admin',
        });
        setApplications((prev) =>
          prev.map((a) => (a.id === appRecord.id ? { ...a, status: 'REJECTED', rejectedAt: nowMs } : a))
        );
        showToast('info', `${appRecord.name || 'దరఖాస్తు'} తిరస్కరించబడింది.`);
      } catch (err: any) {
        showToast('error', `తిరస్కరించడంలో లోపం: ${err?.message || 'Unknown error'}`);
      } finally {
        setBusy(appRecord.id, false);
      }
    },
    [currentUser.name, setBusy, showToast]
  );

  const deleteApplication = useCallback(
    async (appRecord: ReporterApplication) => {
      setBusy(appRecord.id, true);
      try {
        await deleteDoc(doc(db, 'reporter_applications', appRecord.id));
        setApplications((prev) => prev.filter((a) => a.id !== appRecord.id));
        showToast('success', 'దరఖాస్తు తొలగించబడింది.');
      } catch (err: any) {
        showToast('error', `తొలగించడంలో లోపం: ${err?.message || 'Unknown error'}`);
      } finally {
        setBusy(appRecord.id, false);
      }
    },
    [setBusy, showToast]
  );

  const updateReporterRole = useCallback(
    async (reporter: ReporterWithCounts, newRole: UserRole) => {
      setBusy(reporter.id, true);
      try {
        await updateDoc(doc(db, 'users', reporter.id), {
          role: newRole,
          roleUpdatedAt: Date.now(),
        });
        setReporters((prev) => prev.map((u) => (u.id === reporter.id ? { ...u, role: newRole } : u)));
        showToast('success', `${reporter.name} గారి హోదా విజయవంతంగా అప్‌డేట్ చేయబడింది.`);
      } catch (err: any) {
        showToast('error', `హోదా అప్‌డేట్ విఫలమైంది: ${err?.message || 'Unknown error'}`);
      } finally {
        setBusy(reporter.id, false);
      }
    },
    [setBusy, showToast]
  );

  const saveReporterLocation = useCallback(
    async (reporter: ReporterWithCounts, district: string, mandal: string) => {
      setBusy(reporter.id, true);
      try {
        const cleanDist = district.trim();
        const cleanMandal = mandal.trim();
        await updateDoc(doc(db, 'users', reporter.id), {
          district: cleanDist,
          assignedMandal: cleanMandal,
          mandal: cleanMandal,
          state_district: cleanDist,
        });
        setReporters((prev) =>
          prev.map((u) =>
            u.id === reporter.id
              ? { ...u, district: cleanDist, assignedMandal: cleanMandal, mandal: cleanMandal }
              : u
          )
        );
        showToast('success', `${reporter.name} గారి ప్రాంతం ${cleanDist} · ${cleanMandal} గా మార్చబడింది.`);
        return true;
      } catch (err: any) {
        showToast('error', `లొకేషన్ సేవ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
        return false;
      } finally {
        setBusy(reporter.id, false);
      }
    },
    [setBusy, showToast]
  );

  const toggleExemption = useCallback(
    async (reporter: ReporterWithCounts) => {
      const nextExempt = !(reporter.exemptFromInactivity === true);
      setBusy(reporter.id, true);
      try {
        await updateDoc(doc(db, 'users', reporter.id), {
          exemptFromInactivity: nextExempt,
          'reporterActivity.inactivityStage': nextExempt ? 'EXEMPT' : 'ACTIVE',
        });
        const nowMs = Date.now();
        setReporters((prev) =>
          prev.map((u) => {
            if (u.id !== reporter.id) return u;
            const updated = {
              ...u,
              exemptFromInactivity: nextExempt,
              reporterActivity: {
                ...(u.reporterActivity || { totalApprovedPosts: u.totalNewsCount || 0 }),
                inactivityStage: (nextExempt ? 'EXEMPT' : 'ACTIVE') as any,
              },
            };
            const metrics = extractCanonicalReporterMetrics(updated, nowMs, trackingConfigRef.current);
            return { ...updated, inactivityStage: metrics.inactivityStage };
          })
        );
        showToast(
          'success',
          nextExempt
            ? `${reporter.name} గారికి పుష్ రిమైండర్లు నిలిపివేయబడ్డాయి (మినహాయింపు).`
            : `${reporter.name} గారికి పుష్ రిమైండర్లు తిరిగి ప్రారంభించబడ్డాయి.`
        );
      } catch (err: any) {
        showToast('error', `మినహాయింపు మార్చడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
      } finally {
        setBusy(reporter.id, false);
      }
    },
    [setBusy, showToast]
  );

  const downgradeReporter = useCallback(
    async (reporter: ReporterWithCounts, reason?: string) => {
      setBusy(reporter.id, true);
      try {
        const nowMs = Date.now();
        const cleanReason = (reason || '').trim() || 'MANUAL_ADMIN_ACTION';
        await updateDoc(doc(db, 'users', reporter.id), {
          role: UserRole.SUBSCRIBER,
          previousRole: reporter.role,
          previouslyDowngraded: true,
          warningLevel: 0,
          inProbation: false,
          downgradedAt: nowMs,
          downgradedBy: currentUser.name || 'Admin',
          downgradedReason: cleanReason,
        });

        try {
          const appsSnap = await getDocs(
            query(collection(db, 'reporter_applications'), where('userId', '==', reporter.id), limit(10))
          );
          for (const appDoc of appsSnap.docs) {
            await updateDoc(appDoc.ref, {
              status: 'SUSPENDED',
              suspendedAt: nowMs,
              reason: cleanReason,
            });
          }
        } catch {
          // Non-critical if application doc is missing
        }

        setReporters((prev) => prev.filter((u) => u.id !== reporter.id));
        const formerEntry: FormerReporter = {
          ...reporter,
          role: UserRole.SUBSCRIBER,
          previousRole: reporter.role,
          previouslyDowngraded: true,
          downgradedAt: nowMs,
          downgradedBy: currentUser.name || 'Admin',
          downgradedReason: cleanReason,
        };
        setFormerReporters((prev) => deduplicateFormerReporters([formerEntry, ...prev]));
        showToast('success', `"${reporter.name}" గారిని సబ్‌స్క్రైబర్‌గా మార్చి మాజీ రిపోర్టర్ల జాబితాలోకి తరలించాము.`);
        return true;
      } catch (err: any) {
        showToast('error', `హోదా తొలగింపు విఫలమైంది: ${err?.message || 'Unknown error'}`);
        return false;
      } finally {
        setBusy(reporter.id, false);
      }
    },
    [currentUser.name, setBusy, showToast]
  );

  const reinstateReporter = useCallback(
    async (
      former: FormerReporter,
      assignment: { district: string; mandal: string; role: UserRole }
    ) => {
      setBusy(former.id, true);
      try {
        const nowMs = Date.now();
        const cleanDistrict = assignment.district.trim();
        const cleanMandal = assignment.mandal.trim();
        const nextRole = assignment.role || UserRole.REPORTER;

        await updateDoc(doc(db, 'users', former.id), {
          role: nextRole,
          district: cleanDistrict,
          state_district: cleanDistrict,
          assignedMandal: cleanMandal,
          mandal: cleanMandal,
          previouslyDowngraded: false,
          suspended: false,
          rejoinedAt: nowMs,
          promotedAt: nowMs,
          roleUpdatedAt: nowMs,
          reinstatedBy: currentUser.name || 'Admin',
          'reporterActivity.inactivityStage': 'ACTIVE',
        });

        try {
          const appsSnap = await getDocs(
            query(collection(db, 'reporter_applications'), where('userId', '==', former.id), limit(10))
          );
          for (const appDoc of appsSnap.docs) {
            await updateDoc(appDoc.ref, {
              status: 'JOINED',
              district: cleanDistrict,
              mandal: cleanMandal,
              reinstatedAt: nowMs,
            });
          }
        } catch {
          // Optional application record sync
        }

        const restored = parseReporterDoc(
          former.id,
          {
            ...former,
            role: nextRole,
            district: cleanDistrict,
            assignedMandal: cleanMandal,
            mandal: cleanMandal,
            previouslyDowngraded: false,
            suspended: false,
            rejoinedAt: nowMs,
            promotedAt: nowMs,
          },
          nowMs,
          trackingConfigRef.current
        );

        setFormerReporters((prev) => prev.filter((u) => u.id !== former.id));
        setReporters((prev) => [restored, ...prev.filter((u) => u.id !== former.id)]);
        showToast(
          'success',
          `"${former.name}" గారు ${cleanDistrict} · ${cleanMandal} రిపోర్టర్‌గా తిరిగి నియమించబడ్డారు.`
        );
        return true;
      } catch (err: any) {
        showToast('error', `తిరిగి నియమించడంలో లోపం: ${err?.message || 'Unknown error'}`);
        return false;
      } finally {
        setBusy(former.id, false);
      }
    },
    [currentUser.name, setBusy, showToast]
  );

  const deleteReporterPermanently = useCallback(
    async (userId: string, reporterName: string) => {
      setBusy(userId, true);
      try {
        await deleteDoc(doc(db, 'users', userId));
        try {
          const appsSnap = await getDocs(
            query(collection(db, 'reporter_applications'), where('userId', '==', userId), limit(10))
          );
          for (const appDoc of appsSnap.docs) {
            await deleteDoc(appDoc.ref);
          }
        } catch {
          // Non-critical
        }
        setReporters((prev) => prev.filter((u) => u.id !== userId));
        setFormerReporters((prev) => prev.filter((u) => u.id !== userId));
        showToast('success', `"${reporterName}" ఖాతా శాశ్వతంగా తొలగించబడింది.`);
        return true;
      } catch (err: any) {
        showToast('error', `ఖాతా తొలగింపు విఫలమైంది: ${err?.message || 'Unknown error'}`);
        return false;
      } finally {
        setBusy(userId, false);
      }
    },
    [setBusy, showToast]
  );

  const syncActivityStats = useCallback(async () => {
    setIsSyncingStats(true);
    try {
      const syncFn = httpsCallable(functions, 'syncReporterActivityStats');
      const res: any = await syncFn({ maxNewsScan: 2000 });
      showToast(
        'success',
        res?.data?.message ||
          `వార్తల గణాంకాలు సింక్ పూర్తయింది (${res?.data?.reportersUpdated || 0} మంది రిపోర్టర్లు).`
      );
      await fetchReporters();
    } catch (err: any) {
      showToast('error', `వార్తల గణాంకాల సింక్ విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncingStats(false);
    }
  }, [fetchReporters, showToast]);

  const syncLeaderboardPoints = useCallback(async () => {
    setIsSyncingLeaderboard(true);
    try {
      const syncFn = httpsCallable(functions, 'backfillReporterPoints');
      const res: any = await syncFn();
      showToast('success', res?.data?.message || 'లీడర్‌బోర్డ్ & పాయింట్లు విజయవంతంగా సింక్ చేయబడ్డాయి.');
      await Promise.all([fetchReporters(), fetchApplications()]);
    } catch (err: any) {
      showToast('error', `లీడర్‌బోర్డ్ సింక్ విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncingLeaderboard(false);
    }
  }, [fetchApplications, fetchReporters, showToast]);

  return {
    selectedTab,
    setSelectedTab,
    trackingConfig,
    updateTrackingConfig,
    applications,
    reporters,
    formerReporters,
    formerLoaded,
    occupiedMandalsMap,
    pendingAppsCount,
    totalReferralInstalls,
    loadingWorkspace,
    loadingApps,
    loadingReporters,
    loadingFormer,
    loadError,
    updatingIds,
    isSyncingStats,
    isSyncingLeaderboard,
    toast,
    showToast,
    dismissToast,
    drawerCache,
    loadingDrawerId,
    loadWorkspace,
    fetchApplications,
    fetchReporters,
    fetchFormerReporters,
    loadReporterDrawerDetails,
    approveApplication,
    rejectApplication,
    deleteApplication,
    updateReporterRole,
    saveReporterLocation,
    toggleExemption,
    downgradeReporter,
    reinstateReporter,
    deleteReporterPermanently,
    syncActivityStats,
    syncLeaderboardPoints,
  };
}
