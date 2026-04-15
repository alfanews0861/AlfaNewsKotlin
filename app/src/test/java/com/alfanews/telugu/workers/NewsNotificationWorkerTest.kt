package com.alfanews.telugu.workers

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import com.alfanews.telugu.utils.PreferenceManager
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkAll
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest=Config.NONE)
class NewsNotificationWorkerTest {

    private lateinit var context: Context
    private lateinit var worker: NewsNotificationWorker

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        worker = TestListenableWorkerBuilder<NewsNotificationWorker>(context).build()
        mockkObject(PreferenceManager.Companion)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `doWork returns success when interests are empty`() = runBlocking {
        val mockPreferenceManager = mockk<PreferenceManager>()
        every { PreferenceManager.getInstance(any()) } returns mockPreferenceManager
        every { mockPreferenceManager.newsInterests } returns emptySet()

        val result = worker.doWork()

        assertEquals(ListenableWorker.Result.success(), result)
    }
}
