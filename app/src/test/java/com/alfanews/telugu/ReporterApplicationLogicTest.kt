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

    @Test
    fun testMandalOccupancyKeyNormalizationAndLookup() {
        val occMap = mutableMapOf<String, String>()
        val dist = " ఖమ్మం "
        val mandal = " కొణిజర్ల "
        val name = "రమేష్"
        val phone = "9876543210"

        val occupantInfo = "$name ($phone)"
        val trimmedDist = dist.trim()
        val trimmedMandal = mandal.trim()

        occMap["$trimmedDist|$trimmedMandal"] = occupantInfo
        occMap["${trimmedDist.lowercase()}|${trimmedMandal.lowercase()}"] = occupantInfo
        occMap["${trimmedDist.replace(" ", "")}|${trimmedMandal.replace(" ", "")}"] = occupantInfo

        // Lookup with exact key
        val exactOccupant = occMap["ఖమ్మం|కొణిజర్ల"]
        assertNotNull(exactOccupant)
        assertEquals("రమేష్ (9876543210)", exactOccupant)

        // Lookup with untrimmed or spaced key
        val selectedDist = " ఖమ్మం"
        val selectedMandal = "కొణిజర్ల "
        val exactKey = "$selectedDist|$selectedMandal"
        val trimmedKey = "${selectedDist.trim()}|${selectedMandal.trim()}"
        val lowerKey = "${selectedDist.trim().lowercase()}|${selectedMandal.trim().lowercase()}"
        val noSpaceKey = "${selectedDist.replace(" ", "")}|${selectedMandal.replace(" ", "")}"

        val foundOccupant = occMap[exactKey] 
            ?: occMap[trimmedKey] 
            ?: occMap[lowerKey] 
            ?: occMap[noSpaceKey]

        assertNotNull(foundOccupant)
        assertEquals("రమేష్ (9876543210)", foundOccupant)
    }

    @Test
    fun testActiveReporterFilterExcludesSuspendedAndDowngraded() {
        val users = listOf(
            mapOf("id" to "1", "role" to "REPORTER", "district" to "ఖమ్మం", "assignedMandal" to "కొణిజర్ల", "name" to "Active Rep 1"),
            mapOf("id" to "2", "role" to "REPORTER", "district" to "ఖమ్మం", "assignedMandal" to "వైరా", "suspended" to true, "name" to "Suspended Rep"),
            mapOf("id" to "3", "role" to "REPORTER", "district" to "ఖమ్మం", "assignedMandal" to "మధిర", "previouslyDowngraded" to true, "name" to "Downgraded Rep"),
            mapOf("id" to "4", "role" to "SUBSCRIBER", "district" to "ఖమ్మం", "assignedMandal" to "సత్తుపల్లి", "name" to "Subscriber")
        )

        val activeMap = mutableMapOf<String, String>()
        for (u in users) {
            val isSuspended = u["suspended"] == true || u["previouslyDowngraded"] == true
            val roleStr = u["role"]?.toString()?.uppercase() ?: ""
            if (isSuspended || roleStr == "SUBSCRIBER" || roleStr == "GUEST") continue

            val dist = (u["district"] as? String ?: "").trim()
            val mandal = (u["assignedMandal"] as? String ?: "").trim()
            val name = u["name"] as? String ?: ""
            if (dist.isNotEmpty() && mandal.isNotEmpty()) {
                activeMap["$dist|$mandal"] = name
            }
        }

        assertEquals(1, activeMap.size)
        assertTrue(activeMap.containsKey("ఖమ్మం|కొణిజర్ల"))
        assertFalse(activeMap.containsKey("ఖమ్మం|వైరా"))
        assertFalse(activeMap.containsKey("ఖమ్మం|మధిర"))
        assertFalse(activeMap.containsKey("ఖమ్మం|సత్తుపల్లి"))
    }

    // Simulates the client and server validation logic for reporter applications
    private fun validateReporterApplication(
        fullName: String,
        fatherName: String,
        phone: String,
        address: String,
        district: String,
        mandal: String,
        interestedArea: String,
        education: String,
        currentOrg: String,
        rulesAgreed: Boolean
    ): Pair<Boolean, String?> {
        val cleanPhone = phone.filter { it.isDigit() }.let { if (it.length > 10) it.takeLast(10) else it }
        val phoneRegex = Regex("^[6-9]\\d{9}$")

        return when {
            fullName.trim().length < 3 -> false to "పూర్తి పేరు"
            fatherName.trim().length < 3 -> false to "తండ్రి పేరు"
            !phoneRegex.matches(cleanPhone) -> false to "ఫోన్ నంబర్"
            address.trim().length < 6 -> false to "చిరునామా"
            district.trim().isEmpty() -> false to "జిల్లా"
            mandal.trim().isEmpty() -> false to "మండలం"
            interestedArea.trim().isEmpty() -> false to "ఆసక్తి ఉన్న కేటగిరీ"
            education.trim().isEmpty() -> false to "విద్యార్హత"
            currentOrg.trim().isEmpty() -> false to "ప్రస్తుత సంస్థ"
            !rulesAgreed -> false to "నిబంధనలు"
            else -> true to null
        }
    }

    @Test
    fun testFormValidationFailsOnIncompleteOrBlankFields() {
        // Blank form
        val (blankValid, blankErr) = validateReporterApplication(
            fullName = "",
            fatherName = "",
            phone = "",
            address = "",
            district = "",
            mandal = "",
            interestedArea = "",
            education = "",
            currentOrg = "",
            rulesAgreed = false
        )
        assertFalse(blankValid)
        assertEquals("పూర్తి పేరు", blankErr)

        // Invalid phone (e.g. only 5 digits or starts with 2)
        val (invalidPhoneValid, invalidPhoneErr) = validateReporterApplication(
            fullName = "రమేష్ కుమార్",
            fatherName = "సోమయ్య",
            phone = "12345",
            address = "గాంధీ నగర్, ఖమ్మం",
            district = "ఖమ్మం",
            mandal = "ఖమ్మం",
            interestedArea = "రాజకీయం",
            education = "డిగ్రీ",
            currentOrg = "స్వతంత్ర విలేకరి",
            rulesAgreed = true
        )
        assertFalse(invalidPhoneValid)
        assertEquals("ఫోన్ నంబర్", invalidPhoneErr)

        // Short address
        val (shortAddrValid, shortAddrErr) = validateReporterApplication(
            fullName = "రమేష్ కుమార్",
            fatherName = "సోమయ్య",
            phone = "9876543210",
            address = "గ్రామం",
            district = "ఖమ్మం",
            mandal = "ఖమ్మం",
            interestedArea = "రాజకీయం",
            education = "డిగ్రీ",
            currentOrg = "స్వతంత్ర విలేకరి",
            rulesAgreed = true
        )
        assertFalse(shortAddrValid)
        assertEquals("చిరునామా", shortAddrErr)

        // Rules not agreed
        val (rulesNotAgreedValid, rulesNotAgreedErr) = validateReporterApplication(
            fullName = "రమేష్ కుమార్",
            fatherName = "సోమయ్య",
            phone = "9876543210",
            address = "గాంధీ నగర్, ఖమ్మం టౌన్",
            district = "ఖమ్మం",
            mandal = "ఖమ్మం",
            interestedArea = "రాజకీయం",
            education = "డిగ్రీ",
            currentOrg = "స్వతంత్ర విలేకరి",
            rulesAgreed = false
        )
        assertFalse(rulesNotAgreedValid)
        assertEquals("నిబంధనలు", rulesNotAgreedErr)
    }

    @Test
    fun testFormValidationPassesOnCompleteAndValidForm() {
        val (valid, err) = validateReporterApplication(
            fullName = "రమేష్ కుమార్",
            fatherName = "సోమయ్య",
            phone = "9876543210",
            address = "గాంధీ నగర్, ఖమ్మం టౌన్",
            district = "ఖమ్మం",
            mandal = "ఖమ్మం",
            interestedArea = "రాజకీయం",
            education = "డిగ్రీ",
            currentOrg = "స్వతంత్ర విలేకరి",
            rulesAgreed = true
        )
        assertTrue(valid)
        assertNull(err)
    }
}
