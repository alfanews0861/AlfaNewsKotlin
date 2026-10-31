const admin = require('c:/AlfaKotlin/functions/node_modules/firebase-admin');
const serviceAccount = require('c:/AlfaKotlin/web/alfa-news-31bf7-firebase-adminsdk-fbsvc-555ca0b18c.json');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function normalizeTo10Digit(raw) {
    if (!raw) return null;
    let str = String(raw).trim();
    
    // Explicit known anomalous entries
    if (str === '+1919014319593') return '9014319593';
    if (str === '+61919505656803') return '9505656803';
    if (str === '+19618765616') return '9618765616';
    if (str === '+19010698030') return '9010698030';
    if (str === '+18500066392') return '8500066392';
    if (str === '573075236') return '9573075236'; // Sudheer S news, Karimnagar

    let digits = str.replace(/[^0-9]/g, '');

    if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.substring(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.substring(1);
    } else if (digits.length > 10) {
        const last10 = digits.slice(-10);
        if (/^[6-9]/.test(last10)) {
            digits = last10;
        }
    }
    
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return digits;
    }
    return null;
}

async function fixReporterPhones() {
    console.log('1. Fetching Firebase Auth users...');
    const authUsers = [];
    let pageToken;
    do {
        const res = await admin.auth().listUsers(1000, pageToken);
        authUsers.push(...res.users);
        pageToken = res.pageToken;
    } while (pageToken);

    const authByUid = new Map();
    const authByEmail = new Map();
    authUsers.forEach(u => {
        if (u.phoneNumber) {
            authByUid.set(u.uid, u.phoneNumber);
            if (u.email) authByEmail.set(u.email.toLowerCase().trim(), u.phoneNumber);
        }
    });

    console.log('2. Loading CSV reference data...');
    const csvContent = fs.readFileSync('c:/AlfaKotlin/AlfaNews_Reporters_List.csv', 'utf8');
    const csvByEmail = new Map();
    const csvByNameAndDistrict = new Map();

    const genericNames = new Set(['user', 'new user', 'reporter', 'admin', 'test', 'unknown']);

    csvContent.split(/\r?\n/).forEach(l => {
        const parts = l.split(',');
        if (parts.length >= 3) {
            const name = (parts[1] || '').trim().toLowerCase();
            const rawPhone = (parts[2] || '').replace(/[^0-9+]/g, '').trim();
            const altPhone = (parts[3] || '').replace(/[^0-9+]/g, '').trim();
            const district = (parts[4] || '').trim().toLowerCase();
            const email = (parts[6] || '').trim().toLowerCase();
            const phone = rawPhone || altPhone;
            if (phone && phone.length >= 10 && !phone.includes('నమోదు')) {
                if (email && email !== '-') csvByEmail.set(email, phone);
                if (name && !name.includes('నమోదు') && !genericNames.has(name) && name.length >= 3) {
                    csvByNameAndDistrict.set(`${name}|${district}`, phone);
                    if (!csvByNameAndDistrict.has(name)) {
                        csvByNameAndDistrict.set(name, phone);
                    }
                }
            }
        }
    });

    console.log('3. Loading reporters from Firestore...');
    const usersSnap = await db.collection('users').get();
    const reporterRoles = ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 'ADMIN', 'admin'];

    const backupData = [];
    const updates = [];

    usersSnap.forEach(d => {
        const u = d.data();
        const role = (u.role || '').toUpperCase();
        if (!reporterRoles.includes(role) && u.isReporter !== true) return;

        const curPhone = u.phone || u.phoneNumber || u.mobile;
        backupData.push({
            id: d.id,
            name: u.name,
            email: u.email,
            district: u.district,
            role: u.role,
            currentPhone: curPhone || null
        });

        if (curPhone) {
            const clean10 = normalizeTo10Digit(curPhone);
            if (clean10) {
                const target = `+91${clean10}`;
                if (curPhone !== target) {
                    updates.push({
                        id: d.id,
                        name: u.name,
                        district: u.district,
                        oldPhone: curPhone,
                        newPhone: target,
                        reason: 'Format correction'
                    });
                }
            }
        } else {
            // Missing phone - check Auth & CSV
            let candidate = null;
            let source = null;

            if (authByUid.has(d.id)) {
                candidate = authByUid.get(d.id);
                source = 'Auth UID';
            } else if (u.email && authByEmail.has(u.email.toLowerCase().trim())) {
                candidate = authByEmail.get(u.email.toLowerCase().trim());
                source = 'Auth Email';
            } else if (u.email && u.email !== '-' && csvByEmail.has(u.email.toLowerCase().trim())) {
                candidate = csvByEmail.get(u.email.toLowerCase().trim());
                source = 'CSV Email';
            } else if (u.name && !genericNames.has(u.name.trim().toLowerCase())) {
                const normName = u.name.trim().toLowerCase();
                const normDist = (u.district || '').trim().toLowerCase();
                if (normDist && csvByNameAndDistrict.has(`${normName}|${normDist}`)) {
                    candidate = csvByNameAndDistrict.get(`${normName}|${normDist}`);
                    source = 'CSV Name+District';
                } else if (csvByNameAndDistrict.has(normName)) {
                    candidate = csvByNameAndDistrict.get(normName);
                    source = 'CSV Name';
                }
            }

            if (candidate) {
                const clean10 = normalizeTo10Digit(candidate);
                if (clean10) {
                    updates.push({
                        id: d.id,
                        name: u.name,
                        district: u.district,
                        oldPhone: null,
                        newPhone: `+91${clean10}`,
                        reason: `Discovered from ${source}`
                    });
                }
            }
        }
    });

    console.log(`\nFound ${updates.length} records to update.`);
    
    // Save backup first
    const backupFile = path.join(__dirname, `backup_reporter_phones_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`Backup saved to ${backupFile}`);

    // Perform batch update
    const batchSize = 400;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = db.batch();
        const chunk = updates.slice(i, i + batchSize);
        chunk.forEach(up => {
            const userRef = db.collection('users').doc(up.id);
            batch.update(userRef, { phone: up.newPhone });
        });
        await batch.commit();
        console.log(`Committed batch of ${chunk.length} updates (${i + chunk.length}/${updates.length})`);
    }

    console.log('\nAll reporter phone updates successfully committed to Firestore!');
}

fixReporterPhones().catch(console.error);
