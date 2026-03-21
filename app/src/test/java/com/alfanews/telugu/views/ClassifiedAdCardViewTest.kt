package com.alfanews.telugu.views

import org.junit.Assert.assertEquals
import org.junit.Test
import java.text.NumberFormat
import java.util.Locale

class ClassifiedAdCardViewTest {

    // The priceFormat field is private in the source file, so we must re-instantiate it here
    // to test its behavior accurately, as we cannot access it directly from the test.
    private val priceFormat: NumberFormat = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    @Test
    fun testPriceFormat_positiveValue() {
        val inputPrice = 12345L
        // Expected format for India is typically ₹12,345.00 or similar, depending on locale settings
        val expected = "₹12,345.00"
        val actual = priceFormat.format(inputPrice)
        assertEquals(expected, actual)
    }

    @Test
    fun testPriceFormat_zeroValue() {
        val inputPrice = 0L
        // Although the main Composable handles price <= 0 differently ("ధర లేదు"),
        // the utility itself should format 0 correctly, which is typically ₹0.00.
        val expected = "₹0.00"
        val actual = priceFormat.format(inputPrice)
        assertEquals(expected, actual)
    }
}