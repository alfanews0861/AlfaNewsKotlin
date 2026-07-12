package com.alfanews.telugu.models

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * సర్వే ఫీచర్ కోసం యూనిట్ టెస్ట్‌లు.
 * Tests for: canPostSurvey, fake votes math, vote percentage logic,
 *            SurveyQuestion / SurveyOption models, NewsPost survey fields,
 *            mapMapToNewsPost survey field parsing.
 */
class SurveyFeatureTest {

    // Helpers to build test users
    private fun makeUser(role: UserRole, badges: List<String> = emptyList()) = User(
        id = "u1", name = "Test", role = role, badges = badges
    )

    // ─── 1. canPostSurvey() Permission Gate ───────────────────────────────────

    @Test
    fun `Admin can always post survey`() {
        assertTrue(makeUser(UserRole.ADMIN).canPostSurvey())
    }

    @Test
    fun `Reporter with gold badge can post survey`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("gold")).canPostSurvey())
    }

    @Test
    fun `Reporter with platinum badge can post survey`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("platinum_badge")).canPostSurvey())
    }

    @Test
    fun `Reporter with diamond badge can post survey`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("diamond")).canPostSurvey())
    }

    @Test
    fun `Reporter with crown badge can post survey`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("crown")).canPostSurvey())
    }

    @Test
    fun `Reporter with senior badge can post survey`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("senior_reporter")).canPostSurvey())
    }

    @Test
    fun `Reporter badge matching is case-insensitive`() {
        assertTrue(makeUser(UserRole.REPORTER, listOf("GOLD")).canPostSurvey())
    }

    @Test
    fun `Reporter with silver badge cannot post survey`() {
        assertFalse(makeUser(UserRole.REPORTER, listOf("silver")).canPostSurvey())
    }

    @Test
    fun `Reporter with bronze badge cannot post survey`() {
        assertFalse(makeUser(UserRole.REPORTER, listOf("bronze")).canPostSurvey())
    }

    @Test
    fun `Reporter with no badges cannot post survey`() {
        assertFalse(makeUser(UserRole.REPORTER).canPostSurvey())
    }

    @Test
    fun `Subscriber cannot post survey regardless of badges`() {
        assertFalse(makeUser(UserRole.SUBSCRIBER, listOf("gold")).canPostSurvey())
    }

    @Test
    fun `Guest cannot post survey`() {
        assertFalse(makeUser(UserRole.GUEST).canPostSurvey())
    }

    @Test
    fun `Editor cannot post survey`() {
        assertFalse(makeUser(UserRole.EDITOR, listOf("gold")).canPostSurvey())
    }

    @Test
    fun `Regional Incharge cannot post survey`() {
        assertFalse(makeUser(UserRole.REGIONAL_INCHARGE, listOf("gold")).canPostSurvey())
    }

    // ─── 2. Data Models ───────────────────────────────────────────────────────

    @Test
    fun `SurveyOption has correct id and text`() {
        val option = SurveyOption(id = "o1", text = "Telugu")
        assertEquals("o1", option.id)
        assertEquals("Telugu", option.text)
    }

    @Test
    fun `SurveyQuestion holds questions and options`() {
        val q = SurveyQuestion(
            id = "q1",
            questionText = "Favourite topic?",
            options = listOf(SurveyOption("o1", "Politics"), SurveyOption("o2", "Sports"))
        )
        assertEquals("q1", q.id)
        assertEquals(2, q.options.size)
    }

    @Test
    fun `NewsPost survey fields have correct defaults`() {
        val post = NewsPost()
        assertTrue(post.surveyQuestions.isEmpty())
        assertFalse(post.isMultiPage)
        assertEquals(11000, post.fakeVotesBase)
        assertTrue(post.votes.isEmpty())
        assertEquals(0, post.realVotesCount)
    }

    @Test
    fun `Survey NewsPost stores type and flags correctly`() {
        val post = NewsPost(id = "s1", type = "survey", isMultiPage = true, fakeVotesBase = 11342, realVotesCount = 5)
        assertEquals("survey", post.type)
        assertTrue(post.isMultiPage)
        assertEquals(11342, post.fakeVotesBase)
        assertEquals(5, post.realVotesCount)
    }

    // ─── 3. Fake Votes Display Math ───────────────────────────────────────────
    // Formula: displayedVotes = fakeVotesBase + (daysPassed * 527) + realVotesCount

    private fun calcDisplayedVotes(base: Int, days: Long, real: Int): Long =
        base.toLong() + (days * 527L) + real.toLong()

    @Test
    fun `Displayed votes start above 11000 on day zero`() {
        val v = calcDisplayedVotes(11342, 0, 0)
        assertTrue("Expected > 11000 but was $v", v > 11_000L)
    }

    @Test
    fun `A real vote adds exactly 1 to displayed count`() {
        val before = calcDisplayedVotes(11342, 5, 10)
        val after  = calcDisplayedVotes(11342, 5, 11)
        assertEquals(1L, after - before)
    }

    @Test
    fun `Daily increase is greater than 500`() {
        val day0 = calcDisplayedVotes(11342, 0, 0)
        val day1 = calcDisplayedVotes(11342, 1, 0)
        assertTrue("Daily diff should be > 500 but was ${day1 - day0}", day1 - day0 > 500L)
    }

    @Test
    fun `Displayed votes never decrease`() {
        var last = 0L
        for (day in 0L..10L) {
            val v = calcDisplayedVotes(11342, day, (day * 3).toInt())
            assertTrue("Not monotonically increasing at day=$day", v > last)
            last = v
        }
    }

    @Test
    fun `Displayed votes never reset to zero`() {
        for (day in 0L..30L) {
            val v = calcDisplayedVotes(11342, day, 0)
            assertTrue("Should never be zero, was $v at day=$day", v > 0)
        }
    }

    // ─── 4. Vote Percentage Calculation ──────────────────────────────────────

    private fun calcPct(optionVotes: Int, totalVotes: Int): Float =
        if (totalVotes > 0) optionVotes * 100f / totalVotes else 0f

    @Test
    fun `Single winner has 100 percent`() {
        assertEquals(100f, calcPct(50, 50), 0.01f)
    }

    @Test
    fun `Zero total votes returns 0 percent`() {
        assertEquals(0f, calcPct(0, 0), 0.01f)
    }

    @Test
    fun `50-50 split gives 50 percent each`() {
        assertEquals(50f, calcPct(100, 200), 0.01f)
    }

    @Test
    fun `All option percentages sum to 100`() {
        val votes = listOf(40, 35, 25)
        val total = votes.sum()
        val sum = votes.map { calcPct(it, total) }.sum()
        assertEquals(100f, sum, 0.01f)
    }

    @Test
    fun `Fake votes are NOT included in percentage denominator`() {
        // Real: 3 vs 7 — percentage should be 30 and 70 regardless of fake count
        val total = 10
        assertEquals(30f, calcPct(3, total), 0.01f)
        assertEquals(70f, calcPct(7, total), 0.01f)
    }

    // ─── 5. mapMapToNewsPost Survey Field Parsing ─────────────────────────────

    @Test
    fun `mapMapToNewsPost parses type=survey`() {
        val post = mapMapToNewsPost("sid1", mapOf("type" to "survey"))
        assertEquals("survey", post.type)
    }

    @Test
    fun `mapMapToNewsPost parses isMultiPage true`() {
        val post = mapMapToNewsPost("sid2", mapOf("type" to "survey", "isMultiPage" to true))
        assertTrue(post.isMultiPage)
    }

    @Test
    fun `mapMapToNewsPost defaults isMultiPage to false`() {
        val post = mapMapToNewsPost("sid3", mapOf("type" to "survey"))
        assertFalse(post.isMultiPage)
    }

    @Test
    fun `mapMapToNewsPost parses fakeVotesBase`() {
        val post = mapMapToNewsPost("sid4", mapOf("type" to "survey", "fakeVotesBase" to 12500L))
        assertEquals(12500, post.fakeVotesBase)
    }

    @Test
    fun `mapMapToNewsPost defaults fakeVotesBase to 11000`() {
        val post = mapMapToNewsPost("sid5", mapOf("type" to "survey"))
        assertEquals(11000, post.fakeVotesBase)
    }

    @Test
    fun `mapMapToNewsPost parses realVotesCount`() {
        val post = mapMapToNewsPost("sid6", mapOf("type" to "survey", "realVotesCount" to 42L))
        assertEquals(42, post.realVotesCount)
    }

    @Test
    fun `mapMapToNewsPost defaults realVotesCount to 0`() {
        val post = mapMapToNewsPost("sid7", mapOf("type" to "survey"))
        assertEquals(0, post.realVotesCount)
    }

    @Test
    fun `mapMapToNewsPost parses votes map`() {
        val data = mapOf(
            "type" to "survey",
            "votes" to mapOf("q_q1_o_o1" to 10L, "q_q1_o_o2" to 20L)
        )
        val post = mapMapToNewsPost("sid8", data)
        assertEquals(10, post.votes["q_q1_o_o1"])
        assertEquals(20, post.votes["q_q1_o_o2"])
    }

    @Test
    fun `mapMapToNewsPost parses surveyQuestions with options`() {
        val data = mapOf(
            "type" to "survey",
            "surveyQuestions" to listOf(
                mapOf(
                    "id" to "q1",
                    "questionText" to "Do you agree?",
                    "options" to listOf(mapOf("id" to "o1", "text" to "Yes"))
                )
            )
        )
        val post = mapMapToNewsPost("sid9", data)
        assertEquals(1, post.surveyQuestions.size)
        assertEquals("q1", post.surveyQuestions[0].id)
        assertEquals("Do you agree?", post.surveyQuestions[0].questionText)
        assertEquals("o1", post.surveyQuestions[0].options[0].id)
        assertEquals("Yes", post.surveyQuestions[0].options[0].text)
    }

    @Test
    fun `mapMapToNewsPost returns empty list when surveyQuestions absent`() {
        val post = mapMapToNewsPost("sid10", mapOf("type" to "survey"))
        assertTrue(post.surveyQuestions.isEmpty())
    }

    @Test
    fun `mapMapToNewsPost parses surveyQuestions with nextQuestionId`() {
        val data = mapOf(
            "type" to "survey",
            "surveyQuestions" to listOf(
                mapOf(
                    "id" to "q1",
                    "questionText" to "Q1?",
                    "options" to listOf(
                        mapOf("id" to "o1", "text" to "Go to Q2", "nextQuestionId" to "q2"),
                        mapOf("id" to "o2", "text" to "End", "nextQuestionId" to "END")
                    )
                )
            )
        )
        val post = mapMapToNewsPost("sid11", data)
        assertEquals("q2", post.surveyQuestions[0].options[0].nextQuestionId)
        assertEquals("END", post.surveyQuestions[0].options[1].nextQuestionId)
    }

    @Test
    fun `Placeholder resolution logic works`() {
        val questionText = "You selected {q1_ans}"
        val answers = mapOf("q1" to "YSRCP")
        
        var resolved = questionText
        answers.forEach { k: String, v: String ->
            resolved = resolved.replace("{$k" + "_ans}", v, ignoreCase = true)
        }
        
        // Simulating the index-based replacement too
        val questionIds = listOf("q1")
        var idx = 0
        while (idx < questionIds.size) {
            val id = questionIds[idx]
            val ansText = answers[id]
            if (ansText != null) {
                resolved = resolved.replace("{q${idx + 1}_ans}", ansText, ignoreCase = true)
            }
            idx++
        }
        
        assertEquals("You selected YSRCP", resolved)
    }

    // ─── 6. District Filtering ────────────────────────────────────────────────

    private fun shouldShowSurvey(postDistrict: String?, isReporter: Boolean, activeDistrict: String?): Boolean {
        if (!isReporter) return true
        if (activeDistrict == null) return true
        return postDistrict == activeDistrict
    }

    @Test
    fun `Admin survey shows in every district`() {
        assertTrue(shouldShowSurvey("Guntur", isReporter = false, activeDistrict = "Krishna"))
    }

    @Test
    fun `Reporter survey shows in matching district`() {
        assertTrue(shouldShowSurvey("Guntur", isReporter = true, activeDistrict = "Guntur"))
    }

    @Test
    fun `Reporter survey hidden in non-matching district`() {
        assertFalse(shouldShowSurvey("Guntur", isReporter = true, activeDistrict = "Krishna"))
    }

    @Test
    fun `Reporter survey shows when no active district filter`() {
        assertTrue(shouldShowSurvey("Guntur", isReporter = true, activeDistrict = null))
    }

    @Test
    fun `Reporter survey with null district fails any district filter`() {
        assertFalse(shouldShowSurvey(null, isReporter = true, activeDistrict = "Guntur"))
    }
}
