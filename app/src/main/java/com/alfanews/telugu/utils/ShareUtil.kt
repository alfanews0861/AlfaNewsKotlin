package com.alfanews.telugu.utils

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.google.firebase.dynamiclinks.DynamicLink
import com.google.firebase.dynamiclinks.FirebaseDynamicLinks

/**
 * Utility for generating and sharing Firebase Dynamic Links
 *
 * Dynamic links handle two scenarios:
 * 1. App installed → Opens deeplink directly in app
 * 2. App not installed → Redirects to Play Store, then opens deeplink after install
 */
object ShareUtil {

    /**
     * Generate a Firebase Dynamic Link for sharing a news post
     *
     * This creates a short link that:
     * - If app installed: Opens the app directly to the news post
     * - If app not installed: Takes user to Play Store, remembers the post, and opens it after install
     *
     * @param postId The ID of the post to share
     * @param postTitle The title of the post (usually in Telugu)
     * @param onLinkReady Callback with the generated short link URL
     * @param onError Callback if link generation fails
     */
    fun generateDynamicLinkForPost(
        postId: String,
        postTitle: String,
        onLinkReady: (String) -> Unit,
        onError: (Exception) -> Unit = {}
    ) {
        try {
            // The deep link that should open when user clicks in the app
            // This is what the app will receive when installed
            val deepLink = Uri.Builder()
                .scheme("alfanews")
                .authority("news")
                .appendPath(postId)
                .build()

            // Domain where the dynamic link is hosted (Firebase DL domain)
            val domainUriPrefix = "https://alfanews.page.link"

            FirebaseDynamicLinks.getInstance()
                .createDynamicLink()
                .setLink(deepLink) // Set the deep link
                .setDomainUriPrefix(domainUriPrefix) // Set the Firebase DL domain
                .setAndroidParameters(
                    DynamicLink.AndroidParameters.Builder()
                        .setFallbackUrl(
                            Uri.parse("https://play.google.com/store/apps/details?id=com.alfanews.telugu")
                        )
                        .build()
                )
                .buildShortDynamicLink() // Build the short link
                .addOnSuccessListener { result ->
                    val shortLink = result.shortLink
                    Log.d("ShareUtil", "Dynamic link generated: ${shortLink?.toString()}")
                    onLinkReady(shortLink.toString())
                }
                .addOnFailureListener { e ->
                    Log.e("ShareUtil", "Failed to generate dynamic link", e)
                    onError(e)
                }
        } catch (e: Exception) {
            Log.e("ShareUtil", "Error in generateDynamicLinkForPost", e)
            onError(e)
        }
    }

    /**
     * Share a news post using Android's share sheet
     *
     * This will:
     * 1. Generate a Firebase Dynamic Link for the post
     * 2. Open the system share dialog (WhatsApp, Facebook, Email, etc.)
     * 3. User can then share the link to others
     *
     * @param context The context for starting the share intent
     * @param postId The ID of the post to share
     * @param postTitle The title of the post
     * @param additionalText Any additional text to include in the share
     */
    fun shareNewsPost(
        context: Context,
        postId: String,
        postTitle: String,
        additionalText: String = ""
    ) {
        generateDynamicLinkForPost(
            postId = postId,
            postTitle = postTitle,
            onLinkReady = { shortLink ->
                val shareText = buildString {
                    append("Check out this news: ")
                    append(postTitle)
                    if (additionalText.isNotEmpty()) {
                        append("\n")
                        append(additionalText)
                    }
                    append("\n\n")
                    append(shortLink)
                }

                val shareIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_TEXT, shareText)
                    type = "text/plain"
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                val chooser = Intent.createChooser(shareIntent, "Share News").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                try {
                    context.startActivity(chooser)
                } catch (e: Exception) {
                    Log.e("ShareUtil", "Could not start share activity", e)
                }
            },
            onError = { e ->
                Log.e("ShareUtil", "Failed to share post", e)
                // Fallback: Share without dynamic link (just the post ID)
                val fallbackText = buildString {
                    append("Check out this news: ")
                    append(postTitle)
                    if (additionalText.isNotEmpty()) {
                        append("\n")
                        append(additionalText)
                    }
                    append("\n\n")
                    append("https://alfanews.app/news/")
                    append(postId)
                }

                val fallbackIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_TEXT, fallbackText)
                    type = "text/plain"
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                val chooser = Intent.createChooser(fallbackIntent, "Share News").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                try {
                    context.startActivity(chooser)
                } catch (ex: Exception) {
                    Log.e("ShareUtil", "Could not start fallback share activity", ex)
                }
            }
        )
    }

    /**
     * Share a news post using WhatsApp Rich Link Preview format.
     * This generates a rich card with big image preview in WhatsApp,
     * allowing users to tap the image/card to open the AlfaNews app directly.
     */
    fun shareNewsWhatsAppRichLink(
        context: Context,
        postId: String,
        headline: String,
        customText: String? = null
    ) {
        val shareUrl = "https://alfanews.app/news/$postId"
        val shareText = customText ?: buildString {
            append("🔴 ")
            append(headline)
            append("\n\n👇 పూర్తి వార్త & వీడియో కోసం క్రింది లింక్ క్లిక్ చేయండి:\n")
            append(shareUrl)
            append("\n\n📲 తాజా తెలుగు వార్తల కోసం Alfa News యాప్ ఇన్‌స్టాల్ చేసుకోండి!")
        }

        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            action = Intent.ACTION_SEND
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
            putExtra(Intent.EXTRA_SUBJECT, headline)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val chooser = Intent.createChooser(sendIntent, "Share News").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(chooser)
        } catch (e: Exception) {
            Log.e("ShareUtil", "Could not start rich link share", e)
        }
    }

    /**
     * Generate a shareable link without actually opening the share sheet
     * Useful if you want to copy the link to clipboard instead of sharing immediately
     *
     * @param postId The ID of the post
     * @param postTitle The title of the post
     * @param onLinkReady Callback with the generated link
     */
    fun generateShareLink(
        postId: String,
        postTitle: String,
        onLinkReady: (String) -> Unit
    ) {
        generateDynamicLinkForPost(
            postId = postId,
            postTitle = postTitle,
            onLinkReady = onLinkReady,
            onError = {
                // Fallback to direct link if dynamic link generation fails
                onLinkReady("https://alfanews.app/news/$postId")
            }
        )
    }
}


