const candidates = [
    { handle: 'srjanyala', name: 'Sreenivas Janyala', desc: 'The Indian Express Deputy Editor (AP & Telangana)' },
    { handle: 'appajireddem', name: 'Appaji Reddem', desc: 'The Hindu Bureau Chief, Andhra Pradesh' },
    { handle: 'Paul_Oommen', name: 'Paul Oommen', desc: 'Senior Journalist, South Politics' },
    { handle: 'NewsMeter_In', name: 'NewsMeter', desc: 'Fact Check & In-depth Telugu Politics Analysis' },
    { handle: 'SwathiVadlamudi', name: 'Swathi Vadlamudi', desc: 'The Hindu Journalist, Telangana & AP politics' },
    { handle: 'kanizagarari', name: 'Kaniza Garari', desc: 'Deccan Chronicle Senior Journalist' },
    { handle: 'serish', name: 'Serish Nanisetti', desc: 'The Hindu Senior Journalist & Author' },
    { handle: 'TheSouthFirst', name: 'The South First', desc: 'South India Political News & Electoral Analysis' },
    { handle: 'thenewsminute', name: 'The News Minute', desc: 'South India & Telugu States Political Analysis' },
    { handle: 'GulteOfficial', name: 'Gulte', desc: 'AP & Telangana Political News & Editorials' },
    { handle: 'm9news', name: 'M9 News', desc: 'Political Commentary & Ground Analysis' },
    { handle: 'suraj_yengde', name: 'Suraj Yengde', desc: 'Public Intellectual' },
    { handle: 'CVoterData', name: 'CVoter Foundation', desc: 'Psephology & Election Analytics' },
    { handle: 'PradeepGuptaAMI', name: 'Pradeep Gupta (Axis My India)', desc: 'Psephologist & Election Analyst' },
    { handle: 'YashwantDeshmuk', name: 'Yashwant Deshmukh', desc: 'Founder Director CVoter, Political Analyst' },
    { handle: 'sanjaykumarbhu', name: 'Sanjay Kumar (CSDS)', desc: 'CSDS Psephologist & Election Analyst' },
    { handle: 'amitabhapi', name: 'Amitabh Tiwari', desc: 'Political Strategist & Election Analyst' },
    { handle: 'kalyan_kurucheti', name: 'Kalyan Kurucheti', desc: 'Political Observer' },
    { handle: 'AP_Politics', name: 'AP Politics', desc: 'AP Politics' }
];

async function check() {
    for (const c of candidates) {
        try {
            const res = await fetch('https://api.fxtwitter.com/' + c.handle);
            if (res.status === 200) {
                const d = await res.json();
                if (d.code === 200 && d.user) {
                    const u = d.user;
                    console.log(`✅ FOUND @${u.screen_name}: "${u.name}" (Tweets: ${u.tweets}, Followers: ${u.followers}) - ${c.desc}`);
                    console.log(`   Bio: ${(u.description || '').replace(/\n/g, ' ').substring(0, 100)}`);
                }
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
    }
}
check();
