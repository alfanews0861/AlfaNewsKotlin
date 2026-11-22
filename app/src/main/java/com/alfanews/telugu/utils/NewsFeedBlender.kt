package com.alfanews.telugu.utils

import com.alfanews.telugu.models.NewsPost
import kotlin.math.exp
import kotlin.math.ln

/**
 * 🎯 Unified Home NewsFeed Blending Engine (Android)
 *
 * Solves scraper-burst clustering (e.g., 5-6 Sports + 4-5 National pushed consecutively)
 * while preserving:
 * - Fast Path 3 anchor posts at indices [0, 1, 2] with zero UI jump
 * - True disjoint 40% User Interest / 30% Local District / 30% Diverse Fresh & Discovery cadence
 * - Sliding-window anti-clustering & anti-ping-pong category diversity (< 1ms CPU)
 */
object NewsFeedBlender {

    data class InterestProfile(
        val canonicalCategoryScores: Map<String, Double> = emptyMap(),
        val preferredCanonicalKeys: List<String> = emptyList(),
        val totalPositiveSignal: Double = 0.0
    ) {
        val hasEstablishedInterests: Boolean
            get() = totalPositiveSignal >= 5.0 && preferredCanonicalKeys.isNotEmpty()
    }

    /**
     * Canonical Telugu + English aliases used to expand Firestore `whereArrayContainsAny` queries
     * (capped to Firestore's 10-item limit).
     */
    private val CANONICAL_FIRESTORE_ALIASES: Map<String, List<String>> = mapOf(
        "politics" to listOf("రాజకీయం", "Politics", "రాజకీయాలు", "राजनीति", "ਰਾਜਨੀਤੀ", "રાજકારણ"),
        "cinema" to listOf("సినిమా", "Cinema", "వినోదం", "मनोरंजन", "ਮਨੋਰੰਜਨ", "મનોરંજન"),
        "sports" to listOf("క్రీడలు", "Sports", "స్పోర్ట్స్", "खेल", "ਖੇਡਾਂ", "રમતગમત"),
        "crime" to listOf("క్రైమ్", "Crime", "నేరాలు", "अपराध", "ਅਪਰਾਧ", "ગુનાખોરી"),
        "business" to listOf("వ్యాపారం", "Business", "व्यापार", "ਕਾਰੋਬਾਰ", "વ્યાપાર"),
        "technology" to listOf("టెక్నాలజీ", "Technology", "तकनीक", "ਤਕਨਾਲੋਜੀ", "ટેકનોલોજી"),
        "health" to listOf("ఆరోగ్యం", "Health", "स्वास्थ्य", "ਸਿਹਤ", "આરોગ્ય"),
        "education" to listOf("విద్య/ఉద్యోగాలు", "Education", "విద్య", "शिक्षा", "ਸਿੱਖਿਆ", "શિક્ષણ"),
        "devotional" to listOf("భక్తి", "Devotional", "धर्म", "ਧਰਮ", "ભક્તિ"),
        "agriculture" to listOf("వ్యవసాయం", "Agriculture", "कृषि", "ਖੇਤੀਬਾੜੀ", "ખેતી"),
        "national" to listOf("జాతీయం", "National", "देश", "ਦੇਸ਼", "રાષ્ટ્રીય"),
        "international" to listOf("అంతర్జాతీయం", "International", "विदेश", "ਵਿਦੇਸ਼", "આંતરરાષ્ટ્રીય"),
        "lifestyle" to listOf("లైఫ్ స్టైల్", "Lifestyle", "జీవనశైలి", "लाइफस्टाइल", "ਜੀਵਨਸ਼ੈਲੀ", "લાઇફસ્ટાઇલ")
    )

    private val NON_TOPICAL_CANONICAL = setOf("general", "local_district", "special", "greeting", "history", "cartoon", "survey", "weather")

    // Exact 10-slot 40/30/30 cadence: 4 Interest (40%), 3 Local (30%), 3 Discovery/Fresh (30%)
    private enum class PoolType { INTEREST, LOCAL, DISCOVERY }

    private val CADENCE_40_30_30 = listOf(
        PoolType.INTEREST,
        PoolType.LOCAL,
        PoolType.INTEREST,
        PoolType.DISCOVERY,
        PoolType.LOCAL,
        PoolType.INTEREST,
        PoolType.DISCOVERY,
        PoolType.INTEREST,
        PoolType.LOCAL,
        PoolType.DISCOVERY
    )

    /**
     * Maps diverse raw Telugu, Hindi, Punjabi, Gujarati & English category strings into standardized canonical keys.
     */
    fun normalizeCategoryKey(raw: String?): String {
        if (raw.isNullOrBlank()) return "general"
        val s = raw.trim().lowercase()
        return when {
            s.contains("క్రీడలు") || s.contains("స్పోర్ట్స్") || s.contains("sports") || s.contains("cricket") || s.contains("క్రికెట్") || s.contains("ipl") || s.contains("खेल") || s.contains("ਖੇਡਾਂ") || s.contains("રમત") -> "sports"
            s.contains("సినిమా") || s.contains("వినోదం") || s.contains("cinema") || s.contains("entertainment") || s.contains("movies") || s.contains("ఓటీటీ") || s.contains("ott") || s.contains("చిత్రసీమ") || s.contains("టాలీవుడ్") || s.contains("tollywood") || s.contains("मनोरंजन") || s.contains("बॉलीवुड") || s.contains("ਮਨੋਰੰਜਨ") || s.contains("મનોરંજન") -> "cinema"
            s.contains("రాజకీయం") || s.contains("రాజకీయాలు") || s.contains("రాజకీయ") || s.contains("politics") || s.contains("political") || s.contains("राजनीति") || s.contains("ਰਾਜਨੀਤੀ") || s.contains("રાજકારણ") -> "politics"
            s.contains("క్రైమ్") || s.contains("నేరాలు") || s.contains("crime") || s.contains("పోలీస్") || s.contains("police") || s.contains("अपराध") || s.contains("ਅਪਰਾਧ") || s.contains("ગુના") -> "crime"
            s.contains("వ్యాపారం") || s.contains("బిజినెస్") || s.contains("business") || s.contains("మార్కెట్") || s.contains("బంగారం") || s.contains("व्यापार") || s.contains("बिजनेस") || s.contains("ਕਾਰੋਬਾਰ") || s.contains("વ્યાપાર") -> "business"
            s.contains("టెక్నాలజీ") || s.contains("technology") || s.contains("tech") || s.contains("तकनीक") || s.contains("ਤਕਨਾਲੋਜੀ") || s.contains("ટેકનોલોજી") -> "technology"
            s.contains("ఆరోగ్యం") || s.contains("health") || s.contains("स्वास्थ्य") || s.contains("ਸਿਹਤ") || s.contains("આરોગ્ય") -> "health"
            s.contains("విద్య") || s.contains("education") || s.contains("ఉద్యోగాలు") || s.contains("jobs") || s.contains("शिक्षा") || s.contains("रोजगार") || s.contains("ਸਿੱਖਿਆ") || s.contains("શિક્ષણ") -> "education"
            s.contains("భక్తి") || s.contains("ఆధ్యాత్మికం") || s.contains("devotional") || s.contains("धर्म") || s.contains("ਧਰਮ") || s.contains("ભક્તિ") -> "devotional"
            s.contains("వ్యవసాయం") || s.contains("agriculture") || s.contains("कृषि") || s.contains("ਖੇਤੀਬਾੜੀ") || s.contains("ખેતી") -> "agriculture"
            s.contains("అంతర్జాతీయం") || s.contains("international") || s.contains("ప్రపంచం") || s.contains("world") || s.contains("विदेश") || s.contains("ਵਿਦੇਸ਼") || s.contains("આંતરરાષ્ટ્રીય") -> "international"
            s.contains("జాతీయం") || s.contains("national") || s.contains("భారతదేశం") || s.contains("देश") || s.contains("ਦੇਸ਼") || s.contains("રાષ્ટ્રીય") -> "national"
            s.contains("జీవనశైలి") || s.contains("లైఫ్‌స్టైల్") || s.contains("లైఫ్ స్టైల్") || s.contains("lifestyle") || s.contains("लाइफस्टाइल") || s.contains("ਜੀਵਨਸ਼ੈਲੀ") || s.contains("લાઇફસ્ટાઇલ") -> "lifestyle"
            s.contains("జిల్లా") || s.contains("స్థానిక") || s.contains("local") || s.contains("स्थानीय") || s.contains("ਸਥਾਨਕ") || s.contains("સ્થાનિક") -> "local_district"
            s == "general" || s == "general news" || s == "జనరల్" || s == "state" || s == "రాష్ట్రం" || s == "తాజా వార్తలు" || s == "బ్రేకింగ్" || s == "ముఖ్యాంశాలు" || s == "news" || s == "राज्य" || s == "ताजा खबर" || s == "ताज़ा समाचार" || s == "ਰਾਜ" || s == "રાજ્ય" -> "general"
            else -> s
        }
    }

    /**
     * Expands user's top preferred category keys via breadth-first round-robin so every preferred
     * category gets its primary native + English aliases inside Firestore's 10-item `whereArrayContainsAny` limit.
     */
    fun expandCategoriesForFirestoreQuery(rawPreferred: List<String>, maxLimit: Int = 10): List<String> {
        if (rawPreferred.isEmpty()) return emptyList()
        val aliasLists = mutableListOf<List<String>>()
        val seenCanonical = HashSet<String>()
        for (raw in rawPreferred) {
            val canonical = normalizeCategoryKey(raw)
            if (canonical in NON_TOPICAL_CANONICAL || !seenCanonical.add(canonical)) continue
            val aliases = CANONICAL_FIRESTORE_ALIASES[canonical]
            if (aliases != null) {
                aliasLists.add(aliases)
            } else if (raw.isNotBlank()) {
                aliasLists.add(listOf(raw.trim()))
            }
        }
        val result = LinkedHashSet<String>()
        val maxDepth = aliasLists.maxOfOrNull { it.size } ?: 0
        for (depth in 0 until maxDepth) {
            if (result.size >= maxLimit) break
            for (aliases in aliasLists) {
                if (result.size >= maxLimit) break
                if (depth < aliases.size) {
                    result.add(aliases[depth])
                }
            }
        }
        return result.toList().take(maxLimit)
    }

    /**
     * Aggregates raw category score maps (mixing Telugu & English strings) into a canonical profile.
     */
    fun buildInterestProfile(rawCategoryScores: Map<String, Int>): InterestProfile {
        if (rawCategoryScores.isEmpty()) return InterestProfile()
        val canonical = HashMap<String, Double>()
        for ((rawKey, score) in rawCategoryScores) {
            val key = normalizeCategoryKey(rawKey)
            if (key in NON_TOPICAL_CANONICAL) continue
            canonical[key] = (canonical[key] ?: 0.0) + score.toDouble()
        }
        val preferred = canonical.entries
            .filter { it.value > 0.0 }
            .sortedByDescending { it.value }
            .map { it.key }
        val totalPositive = canonical.values.filter { it > 0.0 }.sum()
        return InterestProfile(
            canonicalCategoryScores = canonical,
            preferredCanonicalKeys = preferred,
            totalPositiveSignal = totalPositive
        )
    }

    /**
     * Checks whether a post belongs to the user's local district bucket (fixing the bug where
     * district posts lacking the literal "జిల్లా వార్త" tag missed the 30% Local pool).
     */
    fun isLocalDistrictPost(post: NewsPost, userDistrict: String?): Boolean {
        val postDist = post.district?.trim()
        val hasLocalCategory = post.category?.trim() == "జిల్లా వార్త" ||
            post.category?.trim() == "స్థానిక" ||
            post.categories.any {
                val c = it.trim()
                c == "జిల్లా వార్త" || c.equals("Local", ignoreCase = true) || c == "స్థానిక"
            }
        if (hasLocalCategory) return true

        if (!postDist.isNullOrBlank() && Constants.isSpecificDistrict(postDist)) {
            if (userDistrict.isNullOrBlank()) return true
            if (postDist.equals(userDistrict, ignoreCase = true)) return true
            val aliases = Constants.getDistrictAliases(userDistrict)
            if (aliases.any { a ->
                    a.equals(postDist, ignoreCase = true) ||
                        postDist.contains(a, ignoreCase = true) ||
                        a.contains(postDist, ignoreCase = true)
                }
            ) {
                return true
            }
        }

        if (!userDistrict.isNullOrBlank()) {
            val aliases = Constants.getDistrictAliases(userDistrict)
            if (post.categories.any { cat ->
                    cat.equals(userDistrict, ignoreCase = true) ||
                        aliases.any { a -> a.equals(cat, ignoreCase = true) }
                }
            ) {
                return true
            }
        }
        return false
    }

    /**
     * Extracts all canonical topical keys associated with a post (from categories, category, tags).
     */
    fun extractCanonicalTopics(post: NewsPost): List<String> {
        val topics = LinkedHashSet<String>()
        for (cat in post.categories) {
            val key = normalizeCategoryKey(cat)
            if (key !in NON_TOPICAL_CANONICAL) topics.add(key)
        }
        post.category?.let {
            val key = normalizeCategoryKey(it)
            if (key !in NON_TOPICAL_CANONICAL) topics.add(key)
        }
        for (tag in post.tags) {
            val key = normalizeCategoryKey(tag)
            if (key !in NON_TOPICAL_CANONICAL && CANONICAL_FIRESTORE_ALIASES.containsKey(key)) {
                topics.add(key)
            }
        }
        return topics.toList()
    }

    /**
     * Primary canonical category tag for anti-clustering & pool round-robin.
     */
    fun getPostCategoryTag(post: NewsPost, userDistrict: String? = null): String {
        if (post.type == "greeting" || post.type == "history" || post.type == "cartoon" || post.type == "survey" || post.type == "weather") {
            return post.type ?: "special"
        }
        if (isLocalDistrictPost(post, userDistrict)) {
            return "local_district"
        }
        val topics = extractCanonicalTopics(post)
        if (topics.isNotEmpty()) {
            return topics.first()
        }
        val fallback = post.categories.firstOrNull { it.isNotBlank() } ?: post.category
        return normalizeCategoryKey(fallback)
    }

    /**
     * Picks up to [count] (default 3) ultra-fresh Fast Path posts without allowing
     * all 3 slots to be flooded by a single scraped category when other categories exist.
     */
    fun pickFastPathTop3(
        candidates: List<NewsPost>,
        userDistrict: String? = null,
        relevanceScorer: (NewsPost) -> Double = { it.qualityScore },
        count: Int = 3
    ): List<NewsPost> {
        if (candidates.size <= 1) return candidates.take(count)

        val now = System.currentTimeMillis()
        // Rank fast-path candidates with freshness + relevance so top 3 feel instant & relevant
        val ranked = candidates.sortedWith(
            compareByDescending<NewsPost> { post ->
                val hoursOld = maxOf(0.0, (now - post.timestamp) / (1000.0 * 60.0 * 60.0))
                val freshnessBoost = 15.0 * exp(-hoursOld / 12.0)
                relevanceScorer(post) + freshnessBoost
            }.thenByDescending { it.timestamp }
        )

        val picked = ArrayList<NewsPost>(count)
        val usedCats = HashSet<String>()
        val remaining = ranked.toMutableList()

        // Pass 1: pick distinct categories first (prevents 3 Sports in Fast Path if other cats exist)
        val iter = remaining.iterator()
        while (iter.hasNext() && picked.size < count) {
            val post = iter.next()
            val cat = getPostCategoryTag(post, userDistrict)
            if (cat !in usedCats) {
                picked.add(post)
                usedCats.add(cat)
                iter.remove()
            }
        }

        // Pass 2: if fewer than [count] distinct categories exist in the fast snapshot, fill respecting no back-to-back
        while (picked.size < count && remaining.isNotEmpty()) {
            val lastCat = picked.lastOrNull()?.let { getPostCategoryTag(it, userDistrict) }
            val idx = remaining.indexOfFirst { getPostCategoryTag(it, userDistrict) != lastCat }
                .takeIf { it >= 0 } ?: 0
            picked.add(remaining.removeAt(idx))
        }

        return picked
    }

    /**
     * Round-robin interleaves a list of posts across their canonical categories
     * (preserving relative priority order inside each category).
     * This ensures that even if a scraper dumps 6 Sports + 5 National at identical timestamps,
     * only the #1 best Sports and #1 best National appear before other categories get a turn!
     */
    fun roundRobinByCategory(
        posts: List<NewsPost>,
        categoryOrder: List<String> = emptyList(),
        userDistrict: String? = null
    ): List<NewsPost> {
        if (posts.size <= 2) return posts

        val buckets = LinkedHashMap<String, ArrayDeque<NewsPost>>()
        // Seed preferred category order first if provided
        for (cat in categoryOrder) {
            buckets[cat] = ArrayDeque()
        }
        for (post in posts) {
            val cat = getPostCategoryTag(post, userDistrict)
            val queue = buckets.getOrPut(cat) { ArrayDeque() }
            queue.addLast(post)
        }

        val activeQueues = buckets.values.filter { it.isNotEmpty() }.toMutableList()
        val result = ArrayList<NewsPost>(posts.size)
        while (activeQueues.isNotEmpty()) {
            val iter = activeQueues.iterator()
            while (iter.hasNext()) {
                val q = iter.next()
                if (q.isNotEmpty()) {
                    result.add(q.removeFirst())
                }
                if (q.isEmpty()) {
                    iter.remove()
                }
            }
        }
        return result
    }

    /**
     * 🛡️ SLIDING-WINDOW ANTI-CLUSTERING & ANTI-PING-PONG DIVERSITY (< 1ms):
     * Prevents BOTH:
     * 1. Back-to-back identical categories (Sports, Sports)
     * 2. Two-category scraper ping-pong (Sports, National, Sports, National, Sports, National)
     *
     * Rules (with graceful fallback when pool variety is limited):
     * - Pass 1 (Strict): Category NOT in last 2 placed posts AND count in last 6 placed posts < cap
     *   (cap = 2 for user's top-2 preferred categories or local_district, cap = 1 for all others).
     * - Pass 2 (Medium): Category NOT in last 2 placed posts.
     * - Pass 3 (Basic): Category != immediately preceding post.
     * - Pass 4 (Fallback): Take earliest remaining post.
     */
    fun applySlidingWindowDiversity(
        posts: List<NewsPost>,
        seedPrefix: List<NewsPost> = emptyList(),
        preferredTopKeys: Set<String> = emptySet(),
        userDistrict: String? = null
    ): List<NewsPost> {
        if (posts.size <= 1) return posts

        // ⚡ Precompute category tag ONCE per post for pure O(1) inner-loop lookups
        val tagById = HashMap<String, String>(posts.size * 2)
        for (p in posts) {
            tagById[p.id] = getPostCategoryTag(p, userDistrict)
        }

        val remaining = posts.toMutableList()
        val result = ArrayList<NewsPost>(posts.size)
        val recentCats = ArrayDeque<String>()

        // Seed sliding window with already-placed prefix (e.g. Fast Path 3 anchors or previous page tail)
        for (p in seedPrefix.takeLast(6)) {
            recentCats.addLast(tagById[p.id] ?: getPostCategoryTag(p, userDistrict))
        }

        while (remaining.isNotEmpty()) {
            val last1 = recentCats.lastOrNull()
            val last2 = if (recentCats.size >= 2) recentCats.elementAt(recentCats.size - 2) else null

            // Pass 1: Strict anti-ping-pong + window frequency cap
            var chosenIdx = -1
            for (i in 0 until remaining.size) {
                val cat = tagById[remaining[i].id] ?: "general"
                if (cat == last1 || cat == last2) continue
                val countInWindow = recentCats.count { it == cat }
                val maxInWindow = if (cat in preferredTopKeys || cat == "local_district") 2 else 1
                if (countInWindow < maxInWindow) {
                    chosenIdx = i
                    break
                }
            }

            // Pass 2: At least avoid 2-category ping-pong (not in last 2)
            if (chosenIdx == -1) {
                for (i in 0 until remaining.size) {
                    val cat = tagById[remaining[i].id] ?: "general"
                    if (cat != last1 && cat != last2) {
                        chosenIdx = i
                        break
                    }
                }
            }

            // Pass 3: At least avoid immediate back-to-back duplicate
            if (chosenIdx == -1) {
                for (i in 0 until remaining.size) {
                    val cat = tagById[remaining[i].id] ?: "general"
                    if (cat != last1) {
                        chosenIdx = i
                        break
                    }
                }
            }

            // Pass 4: Fallback
            if (chosenIdx == -1) {
                chosenIdx = 0
            }

            val chosen = remaining.removeAt(chosenIdx)
            val chosenCat = tagById[chosen.id] ?: "general"
            result.add(chosen)

            recentCats.addLast(chosenCat)
            if (recentCats.size > 6) {
                recentCats.removeFirst()
            }
        }

        return result
    }

    /**
     * 🚀 CORE 40 / 30 / 30 USER-INTEREST BLENDING ALGORITHM:
     *
     * 1. Keeps [fastPathAnchors] (up to 3 posts) untouched at the front (on first page).
     * 2. Partitions all remaining normal posts into 3 strictly DISJOINT pools:
     *    - Pool A (40%): User Interest / Personalized posts (round-robin across user's preferred categories)
     *      * Cold-start fallback: Curated high-quality Editorial Top Picks (diverse categories)
     *    - Pool B (30%): User's Local District posts (quality + freshness)
     *    - Pool C (30%): Fresh General & Discovery posts (round-robin by category to kill scraper bursts!)
     * 3. Interleaves strictly along the 10-slot 40/30/30 cadence.
     * 4. Applies sliding-window anti-clustering & anti-ping-pong seeded by [fastPathAnchors] / [tailPrefix].
     */
    fun blendNormalNews(
        normalNews: List<NewsPost>,
        fastPathAnchors: List<NewsPost> = emptyList(),
        tailPrefix: List<NewsPost> = emptyList(),
        userDistrict: String? = null,
        interestProfile: InterestProfile = InterestProfile(),
        relevanceScorer: (NewsPost) -> Double,
        userInterestScorer: (NewsPost) -> Double,
        nowMs: Long = System.currentTimeMillis()
    ): List<NewsPost> {
        val anchorIds = fastPathAnchors.map { it.id }.toSet()
        val remaining = normalNews.distinctBy { it.id }.filter { it.id !in anchorIds }
        if (remaining.isEmpty()) return fastPathAnchors.distinctBy { it.id }

        // 1. Disjoint Pool B: Local District News (30%)
        val localPosts = ArrayList<NewsPost>()
        val nonLocalPosts = ArrayList<NewsPost>()
        for (post in remaining) {
            if (isLocalDistrictPost(post, userDistrict)) {
                localPosts.add(post)
            } else {
                nonLocalPosts.add(post)
            }
        }
        val localSorted = localPosts.sortedWith(
            compareByDescending<NewsPost> { post ->
                val hoursOld = maxOf(0.0, (nowMs - post.timestamp) / (1000.0 * 60.0 * 60.0))
                val quality = post.qualityScore.coerceIn(0.0, 10.0) * 3.0
                val freshness = 20.0 * exp(-hoursOld / 24.0)
                quality + freshness + (userInterestScorer(post) * 0.25)
            }.thenByDescending { it.timestamp }
        )

        // 2. Disjoint Pool A (User Interest 40%) vs Pool C (Fresh General & Discovery 30%)
        val preferredSet = interestProfile.preferredCanonicalKeys.take(6).toSet()
        val interestCandidates = ArrayList<NewsPost>()
        val discoveryCandidates = ArrayList<NewsPost>()

        if (interestProfile.hasEstablishedInterests) {
            for (post in nonLocalPosts) {
                val topics = extractCanonicalTopics(post)
                val matchesPreferredCat = topics.any { it in preferredSet }
                val personalScore = userInterestScorer(post)
                // Only put into Interest pool if user has positive affinity (not skipped/negative!)
                if ((matchesPreferredCat && personalScore >= 0.0) || personalScore >= 6.0) {
                    interestCandidates.add(post)
                } else {
                    discoveryCandidates.add(post)
                }
            }
        } else {
            // Cold-start user (no interest history yet):
            // Curate Pool A with high-editorial-priority & top-quality diverse articles
            // so even brand-new users NEVER see a raw 10-article scraper dump!
            val rankedCold = nonLocalPosts.sortedWith(
                compareByDescending<NewsPost> { relevanceScorer(it) }
                    .thenByDescending { it.timestamp }
            )
            val diversifiedCold = roundRobinByCategory(rankedCold, listOf("politics", "cinema", "crime", "business", "technology"), userDistrict)
            val interestTarget = maxOf(1, (diversifiedCold.size * 0.55).toInt())
            interestCandidates.addAll(diversifiedCold.take(interestTarget))
            discoveryCandidates.addAll(diversifiedCold.drop(interestTarget))
        }

        // Sort Pool A by relevance + interest, then round-robin across user's preferred categories
        // so one preferred category doesn't monopolize all 40% slots!
        val interestSorted = interestCandidates.sortedWith(
            compareByDescending<NewsPost> { post ->
                val hoursOld = maxOf(0.0, (nowMs - post.timestamp) / (1000.0 * 60.0 * 60.0))
                val freshnessFactor = exp(-hoursOld / 30.0)
                val baseScore = (userInterestScorer(post) * 2.0) + relevanceScorer(post)
                if (baseScore >= 0) baseScore * (0.45 + 0.55 * freshnessFactor) else baseScore
            }.thenByDescending { it.timestamp }
        )
        val interestPool = roundRobinByCategory(
            posts = interestSorted,
            categoryOrder = interestProfile.preferredCanonicalKeys,
            userDistrict = userDistrict
        ).toMutableList()

        // Sort Pool C by quality + freshness (penalizing negative-interest categories) and
        // round-robin by category so 6 scraped Sports + 5 National NEVER bunch together!
        val discoverySorted = discoveryCandidates.sortedWith(
            compareByDescending<NewsPost> { post ->
                val hoursOld = maxOf(0.0, (nowMs - post.timestamp) / (1000.0 * 60.0 * 60.0))
                val quality = (post.qualityScore.coerceIn(0.0, 10.0) - 5.0) * 3.0
                val freshness = 25.0 * exp(-hoursOld / 18.0)
                val negativePenalty = minOf(0.0, userInterestScorer(post) * 2.0)
                val engagement = ln(1.0 + maxOf(0, post.likes + post.shares * 2 + post.comments)) * 3.0
                freshness + quality + engagement + negativePenalty
            }.thenByDescending { it.timestamp }
        )
        val discoveryPool = roundRobinByCategory(
            posts = discoverySorted,
            userDistrict = userDistrict
        ).toMutableList()

        val localPool = localSorted.toMutableList()

        // 3. Exact 40 / 30 / 30 Interleaving (strictly disjoint, zero duplicate waste!)
        val interleaved = ArrayList<NewsPost>(remaining.size)
        val totalRemaining = interestPool.size + localPool.size + discoveryPool.size
        var slotIdx = 0

        fun takeFrom(primary: PoolType): NewsPost? {
            val order = when (primary) {
                PoolType.INTEREST -> listOf(interestPool, discoveryPool, localPool)
                PoolType.LOCAL -> listOf(localPool, interestPool, discoveryPool)
                PoolType.DISCOVERY -> listOf(discoveryPool, interestPool, localPool)
            }
            for (pool in order) {
                if (pool.isNotEmpty()) return pool.removeAt(0)
            }
            return null
        }

        while (interleaved.size < totalRemaining) {
            val desiredPool = CADENCE_40_30_30[slotIdx % CADENCE_40_30_30.size]
            val next = takeFrom(desiredPool) ?: break
            interleaved.add(next)
            slotIdx++
        }

        // 4. Sliding-Window Anti-Clustering & Anti-Ping-Pong (seeded with Fast Path 3 or previous page tail!)
        val seedPrefix = if (fastPathAnchors.isNotEmpty()) fastPathAnchors else tailPrefix
        val topPreferredSet = interestProfile.preferredCanonicalKeys.take(2).toSet()
        val diversifiedTail = applySlidingWindowDiversity(
            posts = interleaved,
            seedPrefix = seedPrefix,
            preferredTopKeys = topPreferredSet,
            userDistrict = userDistrict
        )

        return (fastPathAnchors + diversifiedTail).distinctBy { it.id }
    }
}
