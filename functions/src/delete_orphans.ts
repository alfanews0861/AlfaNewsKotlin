import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const deleteOrphans = functions.https.onRequest(async (req, res) => {
    const bucket = admin.storage().bucket();
    const orphans = [
        "1b428a5d-b87e-4f51-a3f9-7f8f59700a08_1786278482607.mp4",
        "1fba8c5e-5db2-4496-8c3f-ebcc76abb38f_1786510339657.mp4",
        "258e9420-aee1-4df6-9f7f-117b4bebc003_1786457124071.mp4",
        "2f055d08-2ff6-47ea-a669-068d4b2a8d4c_1786276854896.mp4",
        "30670a1e-53b2-45c1-901f-b7fcc2d5561d_1786451884018.mp4",
        "3a044805-0108-4f77-8c6f-c2a517a20d33_1786324915935.mp4",
        "50bca652-63f0-45ba-9b4e-67a8a10e3fd0_1786279980030.mp4",
        "68e7ff38-3352-4a0c-9af7-57edf37c1a76_1786639236910.mp4",
        "dc12030e-9c98-416e-9766-af2ce6ecf252_1786185584001.mp4",
        "ffd7597a-84f4-4cae-81ee-75f02f48cc2d_1786361845048.mp4"
    ];

    let results = [];
    for (const o of orphans) {
        const name = `news-media/${o}`;
        try {
            await bucket.file(name).delete();
            results.push(`Deleted ${name}`);
        } catch (e: any) {
            results.push(`Failed to delete ${name}: ${e.message}`);
        }
    }
    
    res.json({ results });
});
