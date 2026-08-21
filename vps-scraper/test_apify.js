const axios = require('axios');

async function test() {
    const handle = 'ncbn';
    const payload = {
        twitterHandles: [handle],
        maxItems: 3
    };
    console.log("Input:", payload);
}
test();
