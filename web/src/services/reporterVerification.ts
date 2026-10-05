import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

let verifiedReporterIds = new Set<string>();
let verifiedReporterNames = new Set<string>();
let isInitialized = false;

const isExcludedAuthorName = (name: string): boolean => {
  const lower = name.toLowerCase().trim();
  return (
    lower.includes('alfa news desk') ||
    lower.includes('admin') ||
    lower.includes('సిటిజెన్') ||
    lower.includes('citizen') ||
    lower.includes('అజ్ఞాత') ||
    lower.length === 0
  );
};

export const initReporterVerification = () => {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const roles = ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 2, 2.0, '2', 3, 3.0, '3'];
    const q = query(collection(db, 'users'), where('role', 'in', roles), limit(500));

    onSnapshot(q, (snapshot) => {
      const validIds = new Set<string>();
      const validNames = new Set<string>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.suspended || data.previouslyDowngraded) return;
        const roleStr = String(data.role || '').toUpperCase();
        if (roleStr === 'SUBSCRIBER' || roleStr === 'GUEST' || roleStr === '1') return;

        const mandal = String(
          data.assignedMandal || data.mandal || data.mandalam || data.selectedMandal || ''
        ).trim();

        if (mandal) {
          validIds.add(doc.id);
          const name = String(data.name || '').trim();
          if (name && !isExcludedAuthorName(name)) {
            validNames.add(name.toLowerCase());
          }
        }
      });

      verifiedReporterIds = validIds;
      verifiedReporterNames = validNames;
    }, (err) => {
      console.warn('[REPORTER_VERIFY_SYNC_WARN]', err.message);
    });
  } catch (e) {
    console.warn('[REPORTER_VERIFY_INIT_ERROR]', e);
  }
};

export const isReporterVerified = (reporterId?: string, reporterName?: string): boolean => {
  if (!isInitialized) {
    initReporterVerification();
  }

  const name = (reporterName || '').trim();
  if (name && isExcludedAuthorName(name)) {
    return false;
  }

  const id = (reporterId || '').trim();
  if (id && verifiedReporterIds.has(id)) {
    return true;
  }

  if (name && verifiedReporterNames.has(name.toLowerCase())) {
    return true;
  }

  return false;
};

export const isUserVerifiedReporter = (user: any): boolean => {
  if (!user) return false;
  if (user.role === 'SUBSCRIBER' || user.role === 'GUEST' || user.role === 1) return false;

  const mandal = String(
    user.assignedMandal || user.mandal || user.mandalam || user.selectedMandal || ''
  ).trim();

  if (mandal) {
    return true;
  }

  return isReporterVerified(user.id, user.name);
};
