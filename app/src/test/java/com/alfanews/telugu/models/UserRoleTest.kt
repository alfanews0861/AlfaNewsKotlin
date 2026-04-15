package com.alfanews.telugu.models

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UserRoleTest {

    // Simulating the logic found in AdminPanelView to check roles
    private fun getAccessiblePages(role: UserRole): List<String> {
        val allPages = listOf("profile", "edit-profile", "id-card", "post", "ads", "manage", "manageReporters", "manageUsers", "adminNotify", "scraping", "gnews_dashboard")
        
        return when (role) {
            UserRole.GUEST, UserRole.SUBSCRIBER -> allPages.filter { it == "profile" }
            UserRole.REPORTER -> allPages.filter { listOf("profile", "post", "ads", "edit-profile", "id-card").contains(it) }
            UserRole.REGIONAL_INCHARGE -> allPages.filter { listOf("profile", "post", "ads", "manage", "manageReporters", "manageUsers", "edit-profile", "id-card").contains(it) }
            UserRole.EDITOR -> allPages.filter { listOf("profile", "post", "ads", "manage", "manageReporters", "manageUsers", "edit-profile", "id-card").contains(it) }
            UserRole.ADMIN -> allPages
        }
    }

    @Test
    fun `Guest and Subscriber only have access to profile`() {
        val guestPages = getAccessiblePages(UserRole.GUEST)
        val subscriberPages = getAccessiblePages(UserRole.SUBSCRIBER)

        assertTrue(guestPages.size == 1 && guestPages.contains("profile"))
        assertTrue(subscriberPages.size == 1 && subscriberPages.contains("profile"))
        assertFalse(guestPages.contains("post"))
        assertFalse(subscriberPages.contains("manageUsers"))
    }

    @Test
    fun `Reporter has access to post news and ads but not management`() {
        val reporterPages = getAccessiblePages(UserRole.REPORTER)
        
        assertTrue(reporterPages.contains("post"))
        assertTrue(reporterPages.contains("ads"))
        assertFalse(reporterPages.contains("manage"))
        assertFalse(reporterPages.contains("adminNotify"))
    }

    @Test
    fun `Editor and Regional Incharge have access to manage users and reporters`() {
        val editorPages = getAccessiblePages(UserRole.EDITOR)
        val regionalInchargePages = getAccessiblePages(UserRole.REGIONAL_INCHARGE)

        assertTrue(editorPages.contains("manageUsers"))
        assertTrue(editorPages.contains("manageReporters"))
        assertTrue(editorPages.contains("manage"))
        
        assertTrue(regionalInchargePages.contains("manageUsers"))
        assertTrue(regionalInchargePages.contains("manageReporters"))
        
        assertFalse(editorPages.contains("adminNotify"))
        assertFalse(regionalInchargePages.contains("adminNotify"))
    }

    @Test
    fun `Admin has access to all pages including notifications and scraping`() {
        val adminPages = getAccessiblePages(UserRole.ADMIN)

        assertTrue(adminPages.contains("adminNotify"))
        assertTrue(adminPages.contains("scraping"))
        assertTrue(adminPages.contains("manageUsers"))
        assertTrue(adminPages.size == 11) // All pages
    }
}
