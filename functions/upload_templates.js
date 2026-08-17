const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (fs.existsSync(path.join(__dirname, '.env.alfa-news-31bf7'))) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '.env.alfa-news-31bf7');
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        storageBucket: 'alfa-news-31bf7.appspot.com'
    });
}

const bucket = admin.storage().bucket();
const mediaDir = path.join(__dirname, 'assets');

async function uploadAssets() {
    const files = [
        'YouTube_channel_intro_16_9.mp4',
        'YouTube_intro_BBC_style_9_16.mp4',
        'alfanews_outro_like_share_16_9.mp4',
        'alfanews_outro_like_share_9_16.mp4',
        'logo.png'
    ];

    for (const file of files) {
        const localPath = path.join(mediaDir, file);
        if (fs.existsSync(localPath)) {
            console.log(`Uploading ${file} to templates/${file}...`);
            await bucket.upload(localPath, {
                destination: `templates/${file}`,
                public: true,
                metadata: {
                    cacheControl: 'public, max-age=31536000',
                }
            });
            console.log(`✅ Uploaded templates/${file}`);
        }
    }
}

uploadAssets().catch(err => {
    console.error("Upload error:", err.message);
});
