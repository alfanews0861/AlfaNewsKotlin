package com.alfanews.telugu.data

import com.alfanews.telugu.models.Content
import com.alfanews.telugu.models.Headline
import com.alfanews.telugu.models.NewsPost
import org.junit.Assert.assertEquals
import org.junit.Test

class NewsItemTest {

    @Test
    fun testNewsPostCreation() {
        val id = "123"
        val headline = Headline(telugu = "ముఖ్య వార్త", english = "Test Title")
        val content = Content(telugu = "వివరణ", english = "Test Content")
        val timestamp = System.currentTimeMillis()

        val post = NewsPost(
            id = id,
            headline = headline,
            content = content,
            timestamp = timestamp
        )

        assertEquals(id, post.id)
        assertEquals("ముఖ్య వార్త", post.headline.telugu)
        assertEquals("Test Title", post.headline.english)
        assertEquals("వివరణ", post.content.telugu)
        assertEquals("Test Content", post.content.english)
        assertEquals(timestamp, post.timestamp)
    }
}

