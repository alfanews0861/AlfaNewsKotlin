import * as admin from "firebase-admin";
import { Buffer } from "buffer";

// Initialize with service account if available locally, or rely on default creds
// Ideally, the user should have run 'firebase login' or 'gcloud auth application-default login'
if (!admin.apps.length) {
    // try to load service account if it exists, otherwise default
    try {
        const serviceAccount = require("./service-account.json");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // We need to know the bucket name. If not set, this test might fail where the cloud function succeeds (or vice versa)
            storageBucket: "alfanews-31bf7.appspot.com" // Replace with actual bucket name if known, or try to discovery
        });
    } catch (e) {
        console.log("No service-account.json found, using default credentials");
        admin.initializeApp({
            storageBucket: "alfanews-31bf7.firebasestorage.app" // Common pattern, need to verify
        });
    }
}

const storage = admin.storage();

async function fetchWithTimeout(url: string, options: any = {}, timeout = 25000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function downloadAndUploadImage(url: string) {
    console.log(`Attempting to download: ${url}`);
    if (!url || url.includes('firebasestorage.googleapis.com')) return url;

    try {
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
            console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            return "";
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`Image downloaded. Size: ${buffer.length} bytes`);

        const bucket = storage.bucket(); // Uses default bucket
        console.log(`Uploading to bucket: ${bucket.name}`);

        const fileName = `news-media/debug_${Date.now()}.webp`;
        const file = bucket.file(fileName);

        await file.save(buffer, {
            metadata: { contentType: 'image/webp' },
            public: true
        });

        console.log("Upload successful!");
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
        console.log(`Public URL: ${publicUrl}`);
        return publicUrl;
    } catch (e) {
        console.error("[STORAGE] Image upload failed:", e);
        return null;
    }
}

// Test with a sample image
const TEST_IMAGE_URL = "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png";
downloadAndUploadImage(TEST_IMAGE_URL).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
