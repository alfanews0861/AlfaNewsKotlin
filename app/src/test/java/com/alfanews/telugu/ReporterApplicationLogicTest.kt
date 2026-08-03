package com.alfanews.telugu

import org.junit.Assert.*
import org.junit.Test

class ReporterApplicationLogicTest {

    // Simulates filteredApplications logic from ReporterManagementPageView.kt
    private fun filterApplications(applications: List<Map<String, Any>>, appFilterState: String): List<Map<String, Any>> {
        return when (appFilterState) {
            "PENDING" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: "PENDING"
                status != "JOINED" && status != "APPROVED" && status != "REJECTED"
            }
            "JOINED" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: ""
                status == "JOINED" || status == "APPROVED"
            }
            "REJECTED" -> applications.filter { doc ->
                val status = doc["status"]?.toString()?.uppercase() ?: ""
                status == "REJECTED"
            }
            else -> applications // "ALL"
        }
    }

    // Simulates regional incharge filtering
    private fun filterForRegionalIncharge(
        applications: List<Map<String, Any>>,
        assignedDistricts: List<String>
    ): List<Map<String, Any>> {
        if (assignedDistricts.isEmpty()) return applications
        return applications.filter { app ->
            val appDist = (app["district"] as? String)
                ?: (app["state_district"] as? String)
                ?: (app["selectedDistrict"] as? String)
                ?: ""
            assignedDistricts.any { assigned ->
                assigned.equals(appDist, ignoreCase = true) || appDist.isEmpty()
            }
        }
    }

    @Test
    fun testGuestApplicationSubmissionDataStructure() {
        // Create an application map as saved by a Guest user (userId is empty string or null)
        val guestApp = mapOf<String, Any>(
            "fullName" to "K. Ramesh",
            "fatherName" to "Somaiah",
            "phone" to "9876543210",
            "address" to "Main Road, Khammam",
            "position" to "Mandal Reporter",
            "interestedArea" to "Politics",
            "education" to "Degree",
            "currentOrg" to "Freelance",
            "state" to "Telangana",
            "district" to "Khammam",
            "mandal" to "Khammam",
            "message" to "Want to report news",
            "status" to "PENDING",
            "userId" to "",
            "timestamp" to 1722470000000L
        )

        val applications = listOf(guestApp)

        // Verify Pending filter includes Guest application
        val pendingList = filterApplications(applications, "PENDING")
        assertEquals(1, pendingList.size)
        assertEquals("K. Ramesh", pendingList[0]["fullName"])

        // Verify ALL filter includes Guest application
        val allList = filterApplications(applications, "ALL")
        assertEquals(1, allList.size)

        // Verify JOINED filter excludes Pending Guest application
        val joinedList = filterApplications(applications, "JOINED")
        assertEquals(0, joinedList.size)
    }

    @Test
    fun testGuestApplicationWithNullStatusDefaultsToPending() {
        val appWithoutExplicitStatus = mapOf<String, Any>(
            "name" to "Guest User",
            "phone" to "9123456789",
            "district" to "Warangal",
            "mandal" to "Warangal",
            "userId" to ""
        )

        val applications = listOf(appWithoutExplicitStatus)
        val pendingList = filterApplications(applications, "PENDING")
        assertEquals(1, pendingList.size)
    }

    @Test
    fun testRegionalInchargeCaseInsensitiveDistrictFilter() {
        val apps = listOf(
            mapOf("id" to "1", "district" to "Khammam", "status" to "PENDING"),
            mapOf("id" to "2", "district" to "WARANGAL", "status" to "PENDING"),
            mapOf("id" to "3", "district" to "Nalgonda", "status" to "PENDING")
        )

        val filtered = filterForRegionalIncharge(apps, listOf("khammam", "Warangal"))
        assertEquals(2, filtered.size)
        assertTrue(filtered.any { it["id"] == "1" })
        assertTrue(filtered.any { it["id"] == "2" })
        assertFalse(filtered.any { it["id"] == "3" })
    }

    @Test
    fun testPhoneLookupFallbackNormalizing() {
        val rawInputPhone = "+91 98765-43210"
        val digitsOnly = rawInputPhone.filter { it.isDigit() }
        val clean10Digits = if (digitsOnly.length >= 10) digitsOnly.takeLast(10) else digitsOnly

        assertEquals("9876543210", clean10Digits)
        val prefixedPhone = "+91$clean10Digits"
        assertEquals("+919876543210", prefixedPhone)
    }

    @Test
    fun testDeduplicateApplicationsList() {
        val apps = listOf(
            mapOf("id" to "1", "phone" to "9876543210", "fullName" to "Latest App"),
            mapOf("id" to "2", "phone" to "+91 98765 43210", "fullName" to "Old App Duplicate"),
            mapOf("id" to "3", "phone" to "7799340087", "fullName" to "Another Person")
        )
        val deduplicated = com.alfanews.telugu.views.deduplicateApplicationsList(apps)
        assertEquals(2, deduplicated.size)
        assertEquals("1", deduplicated[0]["id"])
        assertEquals("3", deduplicated[1]["id"])
    }
}
