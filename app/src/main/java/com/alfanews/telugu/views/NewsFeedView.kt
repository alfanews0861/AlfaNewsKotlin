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
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.services.AdState
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
    onEditClick: (NewsPost) -> Unit = {},
    onMenuClick: () -> Unit = {}
) {
    val news by viewModel.news.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val sharedPostId by viewModel.sharedPostId.collectAsStateWithLifecycle()
    val shouldScrollToTop by viewModel.shouldScrollToTop.collectAsStateWithLifecycle()
    val viewModelActiveDistrict by viewModel.userDistrict.collectAsStateWithLifecycle()
    val localAds by viewModel.localAds.collectAsStateWithLifecycle()
    val preloadedAds = remember { mutableStateMapOf<Int, AdState>() }

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

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.refreshIfStale(language, currentUser)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(Unit) {
        if (news.isEmpty()) {
            viewModel.loadNews(language, currentUser, initialPostId)
        } else {
            viewModel.refreshIfStale(language, currentUser)
        }
        
        // ✅ FIX: Always try to get GPS coords if permission is granted.
        // Old code only ran detectLocation when district==null, so existing users
        // never got fresh GPS coords → weather used stale/wrong location.
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            viewModel.detectLocation(context, currentUser, language)
        } else if (viewModelActiveDistrict == null) {
            // Only request permission if we don't know the district at all
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    fun loadAdForPage(page: Int) {
        if (!preloadedAds.containsKey(page)) {
            preloadedAds[page] = AdState.Loading 
            val activity = context as? android.app.Activity
            activity?.let {
                AdMobService.loadNativeAd(it) { ad ->
                    if (ad != null) {
                        preloadedAds[page] = AdState.Success(ad)
                    } else {
                        preloadedAds[page] = AdState.Failed
                    }
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

            // 🚀 IMAGE PRELOADING: next 8 pages ahead (from 5) for smoother scroll
            (1..8).forEach { offset ->
                val nextPageIndex = page + offset
                val nextNewsIndex = nextPageIndex - (nextPageIndex / 6)
                if (nextNewsIndex >= 0 && nextNewsIndex < news.size) {
                    val post = news[nextNewsIndex]
                    if (post.mediaUrl.isNotEmpty()) {
                        val request = ImageRequest.Builder(context)
                            .data(post.mediaUrl)
                            .allowHardware(true)
                            .crossfade(false) // No crossfade for background preloads
                            .build()
                        SingletonImageLoader.get(context).enqueue(request)
                    }
                }
            }

            // 🚀 LOCAL AD PRELOADING: limit to 12 to reduce coroutine overhead
            (1..12).forEach { offset ->
                val futurePage = page + offset
                val isAdPage = (futurePage + 1) % 6 == 0
                if (isAdPage && futurePage < totalCount) {
                    val adIndex = futurePage / 6
                    if (adIndex < localAds.size) {
                        val ad = localAds[adIndex]
                        if (ad.bannerUrl.isNotEmpty()) {
                            val request = ImageRequest.Builder(context)
                                .data(ad.bannerUrl)
                                .allowHardware(true)
                                .crossfade(false)
                                .build()
                            SingletonImageLoader.get(context).enqueue(request)
                        }
                    }
                }
            }

            val keysToRemove = preloadedAds.keys.filter { it < page - 12 || it > page + 24 }
            keysToRemove.forEach { key: Int ->
                val adState = preloadedAds[key]
                if (adState is AdState.Success) {
                    adState.nativeAd.destroy()
                }
                preloadedAds.remove(key)
            }

            // 🚀 ADMOB PRELOADING: limit to 12 slots ahead
            (1..12).forEach { offset ->
                val futurePage = page + offset
                val isAdSlot = (futurePage + 1) % 6 == 0
                if (isAdSlot && futurePage < totalCount) {
                    loadAdForPage(futurePage)
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
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
        } else if (news.isEmpty()) {
            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        CircularProgressIndicator(modifier = Modifier.size(40.dp), color = MaterialTheme.colorScheme.primary)
                        Text(text = stringResource(R.string.news_preparing), color = MaterialTheme.colorScheme.onBackground, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                        Text(text = stringResource(R.string.no_news_available), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground, textAlign = TextAlign.Center)
                        Button(onClick = { viewModel.loadNews(language, currentUser, initialPostId) }) {
                            Text(text = stringResource(R.string.retry))
                        }
                    }
                }
            }
        } else {
            VerticalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                flingBehavior = flingBehavior,
                beyondViewportPageCount = 1, // 🚀 Pre-compose adjacent pages → zero jank on swipe
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
                        val adState = preloadedAds[page]
                        val totalLocalCount = localAds.size
                        // 🚀 derivedStateOf → recompose only when actual active state changes
                        val isCurrentPage by remember { derivedStateOf { pagerState.currentPage == page } }
                        
                        // 🚀 PRIORITY LOGIC:
                        // Slot 1 (Page 6) & Slot 2 (Page 12) -> Prefer Local Ads
                        // Slot 3+ -> Alternate between AdMob and Local Ads
                        
                        val strictlyLocal = adIndex == 0 || adIndex == 1
                        val preferAdMob = if (strictlyLocal) false else adIndex % 2 == 0

                        if (preferAdMob) {
                            if (adState is AdState.Success) {
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = adState.nativeAd)
                            } else if (adState is AdState.Failed) {
                                if (totalLocalCount > 0) {
                                    LocalAdCardView(ad = localAds[adIndex % totalLocalCount], modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                } else {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isFailed = true)
                                }
                            } else {
                                // Loading state: Show preloaded local ad instantly instead of spinner, if available
                                if (totalLocalCount > 0) {
                                    LocalAdCardView(ad = localAds[adIndex % totalLocalCount], modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                } else {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isLoading = true)
                                }
                            }
                        } else {
                            if (totalLocalCount > 0) {
                                LocalAdCardView(ad = localAds[adIndex % totalLocalCount], modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                            } else if (adState is AdState.Success) {
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = adState.nativeAd)
                            } else if (adState is AdState.Failed) {
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isFailed = true)
                            } else {
                                // Loading state (no local ads)
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isLoading = true)
                            }
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
                                // 🚀 derivedStateOf → no unnecessary recomposition during pager drag
                                val isActivePage by remember { derivedStateOf { pagerState.currentPage == page } }
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
                                    isActive = isActivePage
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
