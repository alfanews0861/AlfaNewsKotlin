const fs = require('fs');

async function auditCandidates() {
    const raw = JSON.parse(fs.readFileSync('C:\\AlfaKotlin\\scripts\\ap_tested_results.json', 'utf8'));
    // Deduplicate handles
    const uniqueHandles = [...new Set(raw.map(r => r.handle.replace('@', '').toLowerCase()))];
    console.log(`Auditing ${uniqueHandles.length} unique handles...\n`);

    const audited = [];

    for (const handle of uniqueHandles) {
        try {
            const res = await fetch(`https://api.fxtwitter.com/${handle}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.code === 200 && data.user) {
                    const u = data.user;
                    audited.push({
                        handle: `@${u.screen_name}`,
                        name: u.name,
                        tweets: u.tweets,
                        followers: u.followers,
                        description: u.description || '',
                        location: u.location || ''
                    });
                }
            }
        } catch (e) {
            console.log(`Error checking ${handle}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n--- DETAILED AUDIT RESULTS ---');
    audited.forEach(a => {
        console.log(`\nHandle: ${a.handle} | Name: "${a.name}" | Tweets: ${a.tweets} | Followers: ${a.followers}`);
        console.log(`Desc: ${a.description.replace(/\n/g, ' ')}`);
        console.log(`Loc: ${a.location}`);
    });

    fs.writeFileSync('C:\\AlfaKotlin\\scripts\\ap_deep_audited.json', JSON.stringify(audited, null, 2));
}

auditCandidates();
