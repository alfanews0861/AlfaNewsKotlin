package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.imageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.google.android.gms.ads.nativead.NativeAd
import androidx.compose.runtime.snapshotFlow

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NewsFeedView(
    language: Language,
    currentUser: User?,
    viewModel: NewsFeedViewModel,
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {},
    onDistrictClick: () -> Unit = {},
    initialPostId: String? = null,
    onEditClick: (NewsPost) -> Unit = {}
) {
    val news by viewModel.news.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val sharedPostId by viewModel.sharedPostId.collectAsStateWithLifecycle()
    val shouldScrollToTop by viewModel.shouldScrollToTop.collectAsStateWithLifecycle()
    val userDistrict by viewModel.userDistrict.collectAsStateWithLifecycle()
    val localAds by viewModel.localAds.collectAsStateWithLifecycle()
    val preloadedAds = remember { mutableStateMapOf<Int, NativeAd?>() }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            viewModel.detectLocation(context, currentUser, language)
        }
    }

    // 🔄 App Resume అయినప్పుడు ఆటోమేటిక్‌గా టాప్‌కి వెళ్లి రిఫ్రెష్ చేస్తుంది
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.onAppResume(language, currentUser)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(Unit) {
        // 🚀 PRIORITY 1: Load news immediately if empty or stale
        if (news.isEmpty()) {
            viewModel.loadNews(language, currentUser, initialPostId)
        } else {
            viewModel.refreshIfStale(language, currentUser)
        }
        
        // 🌍 PRIORITY 2: Detect location in background (non-blocking)
        if (userDistrict == null) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                viewModel.detectLocation(context, currentUser, language)
            } else {
                permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    var previousDistrict by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(userDistrict) {
        if (userDistrict != null && previousDistrict == null && news.isNotEmpty()) {
            viewModel.loadNews(language, currentUser)
        }
        previousDistrict = userDistrict
    }

    fun loadAdForPage(page: Int) {
        if (!preloadedAds.containsKey(page)) {
            preloadedAds[page] = null 
            val activity = context as? android.app.Activity
            activity?.let {
                AdMobService.loadNativeAd(it) { ad ->
                    preloadedAds[page] = ad
                }
            }
        }
    }

    val totalCount = remember(news.size) {
        val newsCount = news.size
        if (newsCount == 0) 0 
        else newsCount + (newsCount - 1) / 5
    }
    val pagerState = rememberPagerState(pageCount = { totalCount })

    val flingBehavior = PagerDefaults.flingBehavior(
        state = pagerState,
        snapPositionalThreshold = 0.10f
    )

    LaunchedEffect(sharedPostId, news.size) {
        if (sharedPostId != null && news.isNotEmpty()) {
            val postIndex = news.indexOfFirst { it.id == sharedPostId }
            if (postIndex >= 0) {
                val pageIndex = postIndex + (postIndex / 5)
                pagerState.animateScrollToPage(pageIndex)
            }
        }
    }

    LaunchedEffect(shouldScrollToTop) {
        if (shouldScrollToTop && news.isNotEmpty()) {
            pagerState.animateScrollToPage(0)
            viewModel.resetScrollSignal()
        }
    }

    val onReporterClickRemembered = remember(onReporterClick) { onReporterClick }
    val onProfileClickRemembered = remember(onProfileClick) { onProfileClick }
    val onDistrictClickRemembered = remember(onDistrictClick) { onDistrictClick }
    val onEditClickRemembered = remember(onEditClick) { onEditClick }
    val onAutoShareDoneRemembered = remember { { viewModel.setSharedPostId(null) } }

    LaunchedEffect(pagerState, news.size) {
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val isAdSlot = (page + 1) % 6 == 0
            if (!isAdSlot) {
                val newsIndex = page - (page / 6)
                if (newsIndex >= 0 && newsIndex < news.size) {
                    val currentPost = news[newsIndex]
                    scope.launch {
                        kotlinx.coroutines.delay(4000)
                        if (pagerState.currentPage == page) {
                            com.alfanews.telugu.services.AnalyticsService.logLongView(currentPost.id)
                        }
                    }
                }
            }

            val currentNewsIndex = page - (page / 6)
            if (currentNewsIndex >= news.size - 7 && hasMore && !loading) {
                viewModel.loadMore(language, currentUser)
            }

            // 🖼️ Memory Optimization: Preload 5 images ahead (Reduced from 10 to save bandwidth)
            (1..5).forEach { offset ->
                val nextPageIndex = page + offset
                val nextNewsIndex = nextPageIndex - (nextPageIndex / 6)
                if (nextNewsIndex >= 0 && nextNewsIndex < news.size) {
                    val post = news[nextNewsIndex]
                    if (post.mediaUrl.isNotEmpty()) {
                        val request = ImageRequest.Builder(context)
                            .data(post.mediaUrl)
                            .crossfade(false)
                            .allowHardware(false)
                            .build()
                        context.imageLoader.enqueue(request)
                    }
                }
            }

            (1..24).forEach { offset ->
                val futurePage = page + offset
                val isAdSlot = (futurePage + 1) % 6 == 0
                if (isAdSlot && futurePage < totalCount) {
                    loadAdForPage(futurePage)
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            LogoHeader(
                district = userDistrict,
                showDistrictSelector = false,
                onDistrictClick = onDistrictClickRemembered
            )

            Box(modifier = Modifier.weight(1f)) {
                if (!isOnline && news.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                            Text(text = stringResource(R.string.no_internet), style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
                            Text(text = stringResource(R.string.check_internet), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                            Button(onClick = { viewModel.loadNews(language, currentUser, initialPostId) }) {
                                Text(text = stringResource(R.string.retry))
                            }
                        }
                    }
                } else if (loading && news.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            CircularProgressIndicator(modifier = Modifier.size(40.dp), color = MaterialTheme.colorScheme.primary)
                            Text(text = stringResource(R.string.news_preparing), color = MaterialTheme.colorScheme.onBackground, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                } else {
                    VerticalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize(),
                        flingBehavior = flingBehavior,
                        key = { page ->
                            val isAd = (page + 1) % 6 == 0
                            if (isAd) "home_ad_slot_$page" else {
                                val idx = page - (page / 6)
                                if (idx < news.size) news[idx].id else "empty_$page"
                            }
                        }
                    ) { page ->
                        Box(modifier = Modifier.fillMaxSize()) {
                            val isAdPage = (page + 1) % 6 == 0
                            if (isAdPage) {
                                val adIndex = page / 6
                                val nativeAd = preloadedAds[page]
                                val totalLocalCount = localAds.size
                                val preferAdMob = adIndex % 2 == 0
                                val isCurrentPage = pagerState.currentPage == page

                                if (preferAdMob) {
                                    if (nativeAd != null) AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                    else if (totalLocalCount > 0) LocalAdCardView(ad = localAds[adIndex % totalLocalCount], modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                    else AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
                                } else {
                                    if (totalLocalCount > 0) LocalAdCardView(ad = localAds[adIndex % totalLocalCount], modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                    else if (nativeAd != null) AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                    else AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
                                }
                            } else {
                                val newsIndex = page - (page / 6)
                                if (newsIndex >= 0 && newsIndex < news.size) {
                                    val post = news[newsIndex]
                                    if (post.type == "weather") {
                                        WeatherCardView(
                                            post = post,
                                            language = language,
                                            onLocationRequest = { viewModel.detectLocation(context, currentUser, language) },
                                            modifier = Modifier.fillMaxSize(),
                                            showTopHeader = false
                                        )
                                    } else {
                                        NewsCardView(
                                            post = post,
                                            language = language,
                                            currentUser = currentUser,
                                            onProfileClick = onProfileClickRemembered,
                                            onReporterClick = onReporterClickRemembered,
                                            onDistrictClick = onDistrictClickRemembered,
                                            autoShare = sharedPostId == post.id,
                                            onAutoShareDone = onAutoShareDoneRemembered,
                                            onEditClick = onEditClickRemembered,
                                            modifier = Modifier.fillMaxSize(),
                                            showTopHeader = false,
                                            isActive = pagerState.currentPage == page
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
