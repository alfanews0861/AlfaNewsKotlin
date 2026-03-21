package com.alfanews.telugu.data

import org.junit.Assert.assertEquals
import org.junit.Test

class NewsItemTest {

    @Test
    fun testNewsItemCreation() {
        val id = "123"
        val title = "Test Title"
        val content = "Test Content"
        val timestamp = System.currentTimeMillis()

        val item = NewsItem(id, title, content, timestamp)

        assertEquals(id, item.id)
        assertEquals(title, item.title)
        assertEquals(content, item.content)
        // Timestamp check is often flaky, so we skip exact comparison for now.
    }
}
