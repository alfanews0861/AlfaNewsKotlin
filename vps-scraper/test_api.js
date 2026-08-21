async function test() {
    const handle = 'ncbn';
    const urls = [
        `https://api.vxtwitter.com/user/${handle}`,
        `https://api.fxtwitter.com/user/${handle}`
    ];
    for(const u of urls) {
        try {
            console.log("Trying", u);
            const r = await fetch(u);
            const d = await r.text();
            console.log(r.status, d.substring(0, 200));
        } catch(e) { console.error(e.message) }
    }
}
test();
