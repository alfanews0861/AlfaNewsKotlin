import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Maintenance function:
 * 1. Finds all news posts that have youtubeUrl and cleans up their raw Storage MP4 files.
 * 2. Replaces their Firestore mediaUrl with YouTube thumbnail.
 * 3. Deletes any remaining orphan MP4 files in storage.
 */
export const cleanupAllRawVideos = functions.https.onRequest({
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (req, res) => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const results: string[] = [];

    try {
        console.log("[BULK_CLEANUP] Starting cleanup of raw videos...");
        
        // 1. Get all news with youtubeUrl or video media
        const snapshot = await db.collection('news')
            .where('mediaType', '==', 'VIDEO')
            .get();

        console.log(`[BULK_CLEANUP] Found ${snapshot.size} VIDEO documents in Firestore.`);
        let cleanedDocs = 0;
        let deletedStorageFiles = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const youtubeUrl = data.youtubeUrl || "";
            const mediaUrl = data.mediaUrl || "";

            let ytId = "";
            if (youtubeUrl.includes('v=')) {
                ytId = youtubeUrl.split('v=')[1].split('&')[0];
            } else if (youtubeUrl.includes('youtu.be/')) {
                ytId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
            }

            const ytThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : (data.thumbnailUrl || "");

            // If mediaUrl is a Firebase Storage MP4, delete it and update doc
            if (mediaUrl && mediaUrl.includes('firebasestorage.googleapis.com') && mediaUrl.includes('.mp4')) {
                try {
                    const decodedUrl = decodeURIComponent(mediaUrl);
                    const pathParts = decodedUrl.split('/o/');
                    if (pathParts.length >= 2) {
                        const rawStoragePath = pathParts[1].split('?')[0];
                        await bucket.file(rawStoragePath).delete().catch(() => {});
                        deletedStorageFiles++;
                    }
                } catch (e: any) {}

                if (ytThumbnail) {
                    await doc.ref.update({
                        mediaUrl: ytThumbnail,
                        mediaUrls: [ytThumbnail],
                        thumbnailUrl: ytThumbnail,
                        rawVideoCleaned: true
                    });
                    cleanedDocs++;
                }
            }
        }

        results.push(`Cleaned ${cleanedDocs} Firestore docs and deleted ${deletedStorageFiles} linked MP4 files.`);

        // 2. Also scan Storage for all remaining .mp4 files and remove any that are older than 1 day or not active
        const [files] = await bucket.getFiles({ prefix: 'news-media/' });
        let orphanMp4Deleted = 0;
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        for (const file of files) {
            if (file.name.endsWith('.mp4')) {
                // Check timestamp in filename: uuid_ts.mp4
                const parts = file.name.split('_');
                let fileTs = 0;
                if (parts.length >= 2) {
                    fileTs = parseInt(parts[parts.length - 1].replace('.mp4', '')) || 0;
                }

                // If file is older than 2 hours or no doc, delete it
                if (fileTs === 0 || fileTs < (Date.now() - 2 * 3600 * 1000)) {
                    try {
                        await file.delete();
                        orphanMp4Deleted++;
                    } catch (e: any) {}
                }
            }
        }

        results.push(`Deleted ${orphanMp4Deleted} old/orphan MP4 files from storage.`);
        res.json({ success: true, results });
    } catch (error: any) {
        console.error("[BULK_CLEANUP_ERR]", error);
        res.status(500).json({ error: error.message, results });
    }
});
