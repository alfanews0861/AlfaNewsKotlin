package com.alfanews.telugu.viewmodels

import android.app.Activity
import android.content.Context
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import com.alfanews.telugu.R

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    private lateinit var viewModel: LoginViewModel
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        viewModel = LoginViewModel()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial ui state is default`() {
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.errorMessage)
        assertFalse(state.isLoginSuccessful)
    }

    @Test
    fun `sendOtp with invalid phone sets error message`() {
        val mockContext = mockk<Context>(relaxed = true)
        val mockActivity = mockk<Activity>()

        every { mockContext.getString(R.string.enter_valid_phone) } returns "Enter valid phone number"

        viewModel.sendOtp(mockActivity, "123", mockContext) {}

        val state = viewModel.uiState.value
        assertEquals("Enter valid phone number", state.errorMessage)
        assertFalse(state.isLoading)
    }

    @Test
    fun `resetState clears all fields`() {
        // First simulate an error
        val mockContext = mockk<Context>(relaxed = true)
        val mockActivity = mockk<Activity>()
        every { mockContext.getString(R.string.enter_valid_phone) } returns "Error"
        viewModel.sendOtp(mockActivity, "123", mockContext) {}
        
        assertNotNull(viewModel.uiState.value.errorMessage)

        // Then reset
        viewModel.resetState()
        
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.errorMessage)
        assertFalse(state.isLoginSuccessful)
    }
}
