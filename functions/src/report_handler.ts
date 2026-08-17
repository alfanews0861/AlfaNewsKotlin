import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

const db = admin.firestore();

/**
 * Report News Post - Cloud Function
 * Handles user reports on news articles.
 * When an article receives 3 or more reports:
 * 1. Automatically sets approved: false and status: "REPORTED_HIDDEN" (instant takedown from feeds)
 * 2. Sends an urgent HTML email notification to Admin (alfanews0861@gmail.com)
 * 3. Dispatches an FCM alert notification to the admin_alerts topic
 */
export const reportNewsPost = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { postId, reason, details } = request.data || {};

    if (!postId || typeof postId !== "string") {
        throw new HttpsError("invalid-argument", "Valid Post ID is required.");
    }
    if (!reason || typeof reason !== "string") {
        throw new HttpsError("invalid-argument", "Report reason is required.");
    }

    try {
        const postRef = db.collection("news").doc(postId);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            throw new HttpsError("not-found", "News post not found.");
        }

        const postData = postDoc.data() || {};
        const userId = request.auth?.uid || `guest_${(request.rawRequest.ip || "unknown").replace(/[^a-zA-Z0-9]/g, "_")}`;

        // 1. Prevent duplicate reports from the same user on this post
        const userReportRef = postRef.collection("reports").doc(userId);
        const existingReport = await userReportRef.get();

        if (existingReport.exists) {
            return {
                success: true,
                message: "మీరు ఇప్పటికే ఈ వార్తపై ఫిర్యాదు చేశారు.",
                alreadyReported: true
            };
        }

        // 2. Save user report document
        await userReportRef.set({
            userId,
            reason,
            details: details || "",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Atomically increment reportCount
        await postRef.update({
            reportCount: admin.firestore.FieldValue.increment(1),
            lastReportedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. Check total reports
        const updatedDoc = await postRef.get();
        const updatedData = updatedDoc.data() || {};
        const totalReports = updatedData.reportCount || 1;

        console.log(`[NEWS_REPORT] Post ${postId} reported by ${userId}. Reason: ${reason}. Total reports: ${totalReports}`);

        // 5. 3-Report Auto-Takedown Threshold Trigger
        if (totalReports >= 3 && updatedData.approved !== false) {
            console.warn(`[AUTO_TAKEDOWN] Post ${postId} reached ${totalReports} reports. Hiding post and notifying admin...`);

            // Hide immediately
            await postRef.update({
                approved: false,
                status: "REPORTED_HIDDEN",
                reportedHiddenAt: admin.firestore.FieldValue.serverTimestamp(),
                hiddenReason: `Received ${totalReports} user reports`
            });

            // Fetch report details for email
            const reportsSnapshot = await postRef.collection("reports").get();
            const reportReasonsList = reportsSnapshot.docs
                .map((d, index) => {
                    const data = d.data();
                    return `<li><b>రిపోర్ట్ ${index + 1}:</b> ${data.reason} ${data.details ? `(${data.details})` : ""} - User: ${data.userId}</li>`;
                })
                .join("");

            const teluguHeadline = updatedData.headline?.telugu || updatedData.headline || "N/A";
            const teluguContent = updatedData.content?.telugu || updatedData.content || "N/A";
            const reporterName = updatedData.reporter?.name || (typeof updatedData.reporter === "string" ? updatedData.reporter : "Unknown");
            const location = updatedData.location || "Unknown";

            // Send Admin Alert Email
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                try {
                    const transporter = nodemailer.createTransport({
                        service: "gmail",
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    const htmlEmail = `
                        <div style="font-family: Arial, sans-serif; max-width: 650px; border: 2px solid #dc2626; border-radius: 8px; overflow: hidden; margin: 0 auto;">
                            <div style="background-color: #dc2626; color: white; padding: 18px; text-align: center;">
                                <h2 style="margin: 0; font-size: 20px;">⚠️ అభ్యంతరకర ఆర్టికల్ ఆటో-హైడ్ చేయబడింది</h2>
                                <p style="margin: 5px 0 0 0; font-size: 14px;">3 యూజర్ రిపోర్టులు వచ్చినందున ఈ ఆర్టికల్ ఫీడ్ నుండి తొలగించబడింది</p>
                            </div>
                            <div style="padding: 20px; color: #333333; line-height: 1.6;">
                                <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 12px; margin-bottom: 16px; border-radius: 4px;">
                                    <strong>శీర్షిక (Headline):</strong> ${teluguHeadline}
                                </div>
                                <p><strong>వార్తా వివరణ (Content):</strong><br/>${teluguContent}</p>
                                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    <tr><td style="padding: 6px 0; color: #6b7280;"><b>Post ID:</b></td><td>${postId}</td></tr>
                                    <tr><td style="padding: 6px 0; color: #6b7280;"><b>రిపోర్టర్ / సోర్స్:</b></td><td>${reporterName}</td></tr>
                                    <tr><td style="padding: 6px 0; color: #6b7280;"><b>ప్రాంతం (Location):</b></td><td>${location}</td></tr>
                                    <tr><td style="padding: 6px 0; color: #6b7280;"><b>మొత్తం రిపోర్టులు:</b></td><td><span style="color: #dc2626; font-weight: bold;">${totalReports}</span></td></tr>
                                </table>
                                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                                <h4 style="margin: 10px 0 8px 0; color: #111827;">యూజర్లు తెలిపిన కారణాలు:</h4>
                                <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                                    ${reportReasonsList}
                                </ul>
                                <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">
                                    గమనిక: ఈ వార్తను మీరు అడ్మిన్ ప్యానెల్ లేదా ఫైర్‌బేస్ నుండి సమీక్షించి మళ్లీ అప్రూవ్ చేయవచ్చు లేదా శాశ్వతంగా తొలగించవచ్చు.
                                </p>
                            </div>
                        </div>
                    `;

                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: "alfanews0861@gmail.com",
                        subject: `🚨 [Auto-Takedown Alert] 3 Reports Received: ${teluguHeadline.substring(0, 50)}...`,
                        html: htmlEmail
                    });

                    console.log(`[ADMIN_ALERT_EMAIL] Alert email sent to alfanews0861@gmail.com for post ${postId}`);
                } catch (emailErr: any) {
                    console.error("[ADMIN_ALERT_EMAIL_ERROR] Failed to send email:", emailErr.message);
                }
            }

            // Send FCM Admin Push Notification to admin_alerts topic
            try {
                const adminPushMessage: admin.messaging.TopicMessage = {
                    topic: "admin_alerts",
                    notification: {
                        title: "⚠️ ఆర్టికల్ ఆటో-హైడ్ చేయబడింది (3 Reports)",
                        body: teluguHeadline.substring(0, 100)
                    },
                    data: {
                        postId: postId,
                        type: "REPORTED_TAKEDOWN",
                        totalReports: String(totalReports),
                        headline: teluguHeadline
                    },
                    android: {
                        notification: {
                            channelId: "admin_alerts",
                            priority: "high"
                        }
                    }
                };

                await admin.messaging().send(adminPushMessage);
                console.log(`[ADMIN_ALERT_FCM] FCM push dispatched to admin_alerts for post ${postId}`);
            } catch (fcmErr: any) {
                console.error("[ADMIN_ALERT_FCM_ERROR] Failed to send FCM admin alert:", fcmErr.message);
            }
        }

        return {
            success: true,
            message: "ధన్యవాదాలు! మీ ఫిర్యాదు అందింది. మేము తక్షణమే పరిశీలిస్తాము.",
            reportCount: totalReports,
            isHidden: totalReports >= 3
        };
    } catch (error: any) {
        console.error(`[NEWS_REPORT_ERROR] Failed to report post ${postId}:`, error.message);
        throw new HttpsError("internal", error.message || "Failed to submit report.");
    }
});
