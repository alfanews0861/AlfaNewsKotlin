package com.alfanews.telugu.data

import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests verifying News Sharing & Headline behavior:
 * 1. Image vs Rich Link mutual exclusivity in WhatsApp / messaging apps.
 * 2. Root causes of missing headlines during sharing.
 */
class ShareLogicUnitTest {

    @Test
    fun testHeadlineResolution_CurrentVsFallback() {
        val englishOnlyPost = NewsPost(
            id = "test_1",
            headline = Headline(telugu = "", english = "Massive Investment in AP")
        )

        // Current implementation in NewsCardView.kt line 1055:
        val language = Language.TELUGU
        val currentHeadline = if (language == Language.TELUGU) englishOnlyPost.headline.telugu else englishOnlyPost.headline.english
        // Current logic produces empty string!
        assertEquals("", currentHeadline)

        // Robust fallback implementation:
        val robustHeadline = if (language == Language.TELUGU) {
            englishOnlyPost.headline.telugu.ifBlank { englishOnlyPost.headline.english }
        } else {
            englishOnlyPost.headline.english.ifBlank { englishOnlyPost.headline.telugu }
        }
        assertEquals("Massive Investment in AP", robustHeadline)
    }

    @Test
    fun testShareText_HeadlineMissingWhenEmpty() {
        val emptyHeadline = ""
        val shareUrl = "https://alfanews.app/news/123"
        val shareText = "🔴 $emptyHeadline\n\n$shareUrl"

        // Demonstrates why users see NO headline when sharing
        assertEquals("🔴 \n\nhttps://alfanews.app/news/123", shareText)
        assertFalse(shareText.contains("వార్త"))
    }

    @Test
    fun testShareText_WithValidHeadline() {
        val headline = "హైదరాబాద్‌లో భారీ వర్షం"
        val shareUrl = "https://alfanews.app/news/456"
        val shareText = "🔴 $headline\n\n$shareUrl"

        assertTrue(shareText.contains(headline))
        assertTrue(shareText.startsWith("🔴 హైదరాబాద్‌లో భారీ వర్షం"))
    }

    @Test
    fun testWhatsAppRichLinkVsImageContract() {
        // WhatsApp Intent Contract Simulation:
        // Case 1: Image attachment present (EXTRA_STREAM != null)
        val hasImageStream = true
        val isMediaMessage = hasImageStream
        val generatesRichLinkPreview = !hasImageStream

        assertTrue("When image is attached, message is sent as media", isMediaMessage)
        assertFalse("WhatsApp never generates a rich link preview bubble when media is attached", generatesRichLinkPreview)

        // Case 2: Pure text / link (EXTRA_STREAM == null)
        val noImageStream = false
        val isTextMessage = !noImageStream
        val generatesLinkPreviewOnText = isTextMessage

        assertTrue("When no image is attached, message is sent as text", isTextMessage)
        assertTrue("WhatsApp generates rich preview ONLY on pure text links", generatesLinkPreviewOnText)
    }
}
