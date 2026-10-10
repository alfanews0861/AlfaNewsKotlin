const { Firestore, FieldValue } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();
client.setCredentials({ access_token: configData.tokens.access_token });
const firestore = new Firestore({ projectId: 'alfa-news-31bf7', authClient: client });

// 🛡️ Safety lock: Prevent accidental execution which causes multi-gigabyte egress costs
if (process.env.CONFIRM_UPGRADE !== 'true') {
  console.log('🔒 Safety lock: This one-time upgrade script has already been completed.');
  console.log('To re-run intentionally, execute with: CONFIRM_UPGRADE=true node upgrade_all_reporters.js');
  process.exit(0);
}

async function executeReporterUpgrades() {
  console.log('🚀 Starting system-wide Reporter Upgrade & Restoration...');

  const [usersSnap, appsSnap] = await Promise.all([
    firestore.collection('users').get(),
    firestore.collection('reporter_applications').get()
  ]);

  const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const appByUid = new Map();
  const appByPhone = new Map();
  apps.forEach(a => {
    const p = (a.phone || a.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    if (p.length === 10) appByPhone.set(p, a);
    const uid = a.userId || a.uid;
    if (uid) appByUid.set(uid, a);
  });

  const upgradedReporters = [];
  const resetWarnings = [];

  // ==========================================
  // STEP 1: RESTORE & UPGRADE PAST REPORTERS
  // ==========================================
  for (const doc of usersSnap.docs) {
    const u = { id: doc.id, ...doc.data() };
    const role = (u.role || '').toString().toUpperCase();
    const isSenior = ['ADMIN', 'EDITOR', 'REGIONAL_INCHARGE', '5', '4', '3'].includes(role);
    if (isSenior || u.id === 'system') continue;

    const isCurrentReporter = role === 'REPORTER' || role === '2' || u.role === 2 || u.role === 2.0;

    // A) If already reporter, clear warnings and downgrade flags
    if (isCurrentReporter) {
      const needsReset = (
        (u.warningLevel !== undefined && u.warningLevel > 0) ||
        u.previouslyDowngraded === true ||
        u.downgradedReason ||
        u.suspended === true ||
        u.inProbation === true ||
        u.lastWarningDate
      );

      if (needsReset) {
        await doc.ref.update({
          warningLevel: 0,
          inProbation: false,
          previouslyDowngraded: false,
          suspended: false,
          downgradedReason: FieldValue.delete(),
          downgradedAt: FieldValue.delete(),
          downgradedBy: FieldValue.delete(),
          lastWarningDate: FieldValue.delete(),
          roleUpdatedAt: FieldValue.serverTimestamp()
        });
        resetWarnings.push({ id: u.id, name: u.name || u.displayName || 'Reporter' });
      }
      continue;
    }

    // B) If NOT current reporter, check if they were a reporter in the past
    const phone10 = (u.phone || u.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const matchedApp = appByUid.get(u.id) || (phone10.length === 10 ? appByPhone.get(phone10) : null);

    let newsDocs = [];
    try {
      const [s1, s2, s3, s4] = await Promise.all([
        firestore.collection('news').where('reporter.id', '==', u.id).get().catch(() => ({ docs: [] })),
        firestore.collection('news').where('originalReporterId', '==', u.id).get().catch(() => ({ docs: [] })),
        firestore.collection('news').where('reporter', '==', u.id).get().catch(() => ({ docs: [] })),
        firestore.collection('news').where('userId', '==', u.id).get().catch(() => ({ docs: [] }))
      ]);
      const seen = new Set();
      [...s1.docs, ...s2.docs, ...s3.docs, ...s4.docs].forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          newsDocs.push(d.data());
        }
      });
    } catch (e) {}

    const hasReporterHistory = Boolean(
      u.idCardUrl ||
      u.signatureUrl ||
      u.promotedBy ||
      u.promotedAt ||
      u.lastPostTimestamp !== undefined ||
      u.assignedMandal ||
      u.mandal ||
      (u.badges && u.badges.length > 0) ||
      (u.points !== undefined && u.points > 0) ||
      u.previouslyDowngraded ||
      u.downgradedReason ||
      u.suspended ||
      matchedApp ||
      newsDocs.length > 0
    );

    if (hasReporterHistory) {
      // Determine name
      let bestName = (u.name || u.displayName || '').trim();
      if (!bestName || ['User', 'New User', 'NO_NAME'].includes(bestName)) {
        if (matchedApp && (matchedApp.fullName || matchedApp.name)) {
          bestName = matchedApp.fullName || matchedApp.name;
        } else if (newsDocs.length > 0) {
          const authorNames = newsDocs
            .map(n => typeof n.reporter === 'object' ? n.reporter?.name : null)
            .filter(n => n && n !== 'అజ్ఞాత పౌరుడు' && n !== 'సిటిజెన్ పోస్ట్');
          if (authorNames.length > 0) bestName = authorNames[0];
        }
      }
      if (!bestName) bestName = 'విలేకరి';

      // Determine district & mandal
      let bestDistrict = u.district || matchedApp?.district || '';
      let bestMandal = u.assignedMandal || u.mandal || matchedApp?.mandal || matchedApp?.assignedMandal || '';

      if ((!bestDistrict || !bestMandal) && newsDocs.length > 0) {
        const sample = newsDocs[0];
        if (!bestDistrict) bestDistrict = sample.district || '';
        if (!bestMandal) bestMandal = sample.location || sample.mandal || '';
      }

      // Name-based overrides
      const cleanNameUpper = (bestName || '').toUpperCase();
      if (cleanNameUpper.includes('KOLA MAHESH') || cleanNameUpper.includes('KOLA MOHAN') || (cleanNameUpper.includes('KOLA') && cleanNameUpper.includes('MAHESH'))) {
        bestDistrict = 'యాదాద్రి భువనగిరి';
        bestMandal = 'సంస్థాన్ నారాయణపూర్';
      }

      // Calculate points
      let totalPoints = (u.points && typeof u.points === 'number') ? u.points : 0;
      let latestPostMillis = 0;
      if (newsDocs.length > 0) {
        let calcPoints = 0;
        newsDocs.forEach(n => {
          const isVideo = (n.mediaType || '').toUpperCase() === 'VIDEO';
          calcPoints += isVideo ? 20 : 10;
          const ts = n.timestamp || n.createdAt;
          if (ts) {
            const m = ts.toMillis ? ts.toMillis() : (ts._seconds ? ts._seconds * 1000 : null);
            if (m && m > latestPostMillis) latestPostMillis = m;
          }
        });
        if (calcPoints > totalPoints) totalPoints = calcPoints;
      }

      const badges = [];
      if (totalPoints >= 100) badges.push("BRONZE");
      if (totalPoints >= 500) badges.push("SILVER");
      if (totalPoints >= 2000) badges.push("GOLD");
      if (totalPoints >= 10000) badges.push("DIAMOND");

      const isSeniorRep = newsDocs.length >= 5 || totalPoints >= 50;

      const payload = {
        role: 'REPORTER',
        name: bestName,
        district: bestDistrict || 'సాధారణ',
        assignedMandal: bestMandal || 'స్థానిక',
        mandal: bestMandal || 'స్థానిక',
        points: totalPoints,
        badges: badges,
        warningLevel: 0,
        inProbation: false,
        previouslyDowngraded: false,
        suspended: false,
        isProtectedSenior: isSeniorRep,
        lastPostTimestamp: latestPostMillis > 0 ? latestPostMillis : Date.now(),
        promotedAt: u.promotedAt || FieldValue.serverTimestamp(),
        rejoinedAt: FieldValue.serverTimestamp(),
        roleUpdatedAt: FieldValue.serverTimestamp(),
        promotedBy: 'UPGRADE_ALL_REPORTERS_SYSTEM',
        downgradedReason: FieldValue.delete(),
        downgradedAt: FieldValue.delete(),
        downgradedBy: FieldValue.delete(),
        lastWarningDate: FieldValue.delete()
      };

      await doc.ref.set(payload, { merge: true });

      // Update associated application if exists
      if (matchedApp) {
        try {
          await firestore.collection('reporter_applications').doc(matchedApp.id).update({
            status: 'JOINED',
            userId: u.id,
            reason: FieldValue.delete(),
            suspendedAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
          });
        } catch (e) {}
      }

      upgradedReporters.push({
        id: u.id,
        name: bestName,
        previousRole: u.role || 'NONE',
        district: bestDistrict || 'సాధారణ',
        mandal: bestMandal || 'స్థానిక',
        points: totalPoints,
        newsCount: newsDocs.length
      });
      console.log(`[UPGRADED] ${bestName} (${u.id}) -> REPORTER (${bestDistrict} - ${bestMandal})`);
    }
  }

  // ==========================================
  // STEP 2: AUTO-APPROVE PENDING APPLICATIONS
  // ==========================================
  const pendingAppsSnap = await firestore.collection('reporter_applications')
    .where('status', 'in', ['PENDING', 'SUSPENDED'])
    .get();

  let approvedAppsCount = 0;
  for (const aDoc of pendingAppsSnap.docs) {
    const a = aDoc.data();
    await aDoc.ref.update({
      status: 'JOINED',
      reason: FieldValue.delete(),
      suspendedAt: FieldValue.delete(),
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    approvedAppsCount++;

    // If userId exists, make sure that user is REPORTER and has mandal
    if (a.userId) {
      try {
        const uDoc = await firestore.collection('users').doc(a.userId).get();
        if (uDoc.exists) {
          const u = uDoc.data();
          const dist = a.district || u.district || 'సాధారణ';
          const mandal = a.mandal || a.assignedMandal || u.assignedMandal || 'స్థానిక';
          await uDoc.ref.set({
            role: 'REPORTER',
            district: dist,
            assignedMandal: mandal,
            mandal: mandal,
            warningLevel: 0,
            inProbation: false,
            previouslyDowngraded: false,
            suspended: false,
            roleUpdatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      } catch (e) {}
    }
  }

  // ==========================================
  // STEP 3: LOG SYSTEM AUDIT REPORT
  // ==========================================
  await firestore.collection('system_logs').doc('reporter_restoration_report').set({
    timestamp: FieldValue.serverTimestamp(),
    totalUpgraded: upgradedReporters.length,
    upgradedReporters: upgradedReporters,
    totalResetWarnings: resetWarnings.length,
    approvedApplicationsCount: approvedAppsCount,
    status: 'SUCCESS'
  });

  await firestore.collection('system_logs').doc('reporter_reactivation_status').set({
    lastRunTime: Date.now(),
    status: 'COMPLETED',
    reactivatedCount: upgradedReporters.length,
    names: upgradedReporters.map(r => r.name),
    summary: {
      mode: 'UPGRADE_ALL_PAST_AND_DOWNGRADED_REPORTERS',
      totalUpgraded: upgradedReporters.length,
      resetWarningsCount: resetWarnings.length,
      approvedAppsCount: approvedAppsCount
    }
  });

  console.log('\n======================================================');
  console.log(`✅ SUCCESS! Upgraded ${upgradedReporters.length} past/downgraded reporters to REPORTER.`);
  console.log(`✅ Reset warnings & downgrade flags for ${resetWarnings.length} active reporters.`);
  console.log(`✅ Auto-approved & joined ${approvedAppsCount} pending applications.`);
  console.log('======================================================');
}

executeReporterUpgrades().catch(err => {
  console.error('Fatal upgrade error:', err);
  process.exit(1);
});
