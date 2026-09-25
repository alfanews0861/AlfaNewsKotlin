const fs = require('fs');
const path = require('path');

function getInsertedHandles(logPath) {
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const inserted = [];
    lines.forEach(l => {
        const m = l.match(/(?:✅ INSERTED|➕ ADDED):\s*(@[a-zA-Z0-9_]+)/);
        if (m) inserted.push(m[1].toLowerCase().replace(/^@+/, '').trim());
    });
    return inserted;
}

async function cleanupDummyFeeds() {
    console.log("==================================================");
    console.log("🧹 CLEANING UP DUMMY / UNVERIFIED FEEDS FROM FIRESTORE");
    console.log("==================================================\n");

    const cfgPath = 'C:\\Users\\alfan\\.config\\configstore\\firebase-tools.json';
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const token = cfg.tokens.access_token;

    // 1. Gather all inserted handles from task logs
    const taskDir = 'C:\\Users\\alfan\\.gemini\\antigravity\\brain\\35b2910b-16ac-4b07-bb90-e78527dff521\\.system_generated\\tasks';
    const h214 = getInsertedHandles(path.join(taskDir, 'task-214.log'));
    const h258 = getInsertedHandles(path.join(taskDir, 'task-258.log'));
    const h312 = getInsertedHandles(path.join(taskDir, 'task-312.log'));
    const h348 = getInsertedHandles(path.join(taskDir, 'task-348.log'));

    const dummyHandleSet = new Set([...h214, ...h258, ...h312, ...h348]);
    console.log(`Identified ${dummyHandleSet.size} dummy/batch-inserted handles to remove.\n`);

    // 2. Fetch all current social_feeds from Firestore
    console.log("Fetching all current documents from Firestore...");
    let docs = [];
    let pageToken = '';
    do {
        const url = 'https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (data.documents) docs.push(...data.documents);
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    console.log(`Current total documents in social_feeds: ${docs.length}`);

    // 3. Save full backup locally first
    const backupPath = path.join(__dirname, '..', 'backup_social_feeds_before_cleanup.json');
    fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`✅ Safe backup created at: ${backupPath}\n`);

    // 4. Identify documents to delete
    const toDelete = [];
    const toKeep = [];

    docs.forEach(d => {
        const f = d.fields || {};
        const rawHandle = f.url ? f.url.stringValue : (f.handle ? f.handle.stringValue : '');
        const cleanHandle = rawHandle.toLowerCase().replace(/^@+/, '').replace(/^https?:\/\/(x|twitter)\.com\//, '').split('/')[0].split('?')[0].trim();
        const docId = d.name.split('/').pop();

        if (dummyHandleSet.has(cleanHandle)) {
            toDelete.push({ id: docId, handle: cleanHandle, name: f.sourceName?.stringValue });
        } else {
            toKeep.push({ id: docId, handle: cleanHandle, name: f.sourceName?.stringValue });
        }
    });

    console.log(`Documents to DELETE: ${toDelete.length}`);
    console.log(`Documents to KEEP (Original Authentic Feeds): ${toKeep.length}\n`);

    if (toDelete.length === 0) {
        console.log("No dummy feeds found to delete.");
        return;
    }

    // 5. Delete in batches
    let deletedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toDelete.length; i++) {
        const item = toDelete[i];
        const delUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds/${item.id}`;
        
        try {
            const res = await fetch(delUrl, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                deletedCount++;
                if (deletedCount % 25 === 0 || i === toDelete.length - 1) {
                    console.log(`[${i + 1}/${toDelete.length}] 🗑️ Deleted ${deletedCount} dummy feeds...`);
                }
            } else {
                const err = await res.json();
                console.error(`❌ Failed to delete ${item.handle}:`, err.message || err);
                errorCount++;
            }
        } catch (e) {
            console.error(`❌ Exception deleting ${item.handle}:`, e.message);
            errorCount++;
        }

        if ((i + 1) % 20 === 0) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    console.log("\n==================================================");
    console.log("🎉 CLEANUP COMPLETED");
    console.log(`🗑️ Successfully Deleted: ${deletedCount}`);
    console.log(`🛡️ Safely Preserved: ${toKeep.length}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("==================================================");
}

cleanupDummyFeeds().catch(console.error);
