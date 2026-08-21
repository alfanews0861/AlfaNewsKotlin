const { TwitterApi } = require('twitter-api-v2');

async function test() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!apiKey) {
        console.log("No TWITTER_API_KEY provided");
        return;
    }

    const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
    });

    try {
        const user = await client.v2.userByUsername('ncbn');
        console.log("User ID:", user.data.id);
        const tweets = await client.v2.userTimeline(user.data.id, { max_results: 5, 'tweet.fields': ['created_at'] });
        console.log("Tweets:");
        for (const t of tweets.data.data) {
            console.log(t.created_at, t.text.substring(0, 50));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
