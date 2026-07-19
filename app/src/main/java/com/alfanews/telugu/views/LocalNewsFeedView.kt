package com.alfanews.telugu.views

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.collect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade
import com.alfanews.telugu.ViewModelFactory
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.services.AdState
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.google.android.gms.ads.nativead.NativeAd
import com.alfanews.telugu.views.LocalAdCardView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun LocalNewsFeedView(
    language: Language,
    currentUser: User?,
    onDistrictClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {},
    onEditClick: (NewsPost) -> Unit = {},
    onMenuClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val viewModel: LocalNewsFeedViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val news by viewModel.news.collectAsStateWithLifecycle()

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
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val viewModelActiveDistrict by viewModel.activeDistrict.collectAsStateWithLifecycle()
    val isDetecting by viewModel.isDetecting.collectAsStateWithLifecycle()
    val shouldScrollToTop by viewModel.shouldScrollToTop.collectAsStateWithLifecycle()
    val localAds by viewModel.localAds.collectAsStateWithLifecycle()
    val preloadedAds = remember { mutableStateMapOf<Int, AdState>() }

    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasLocationPermission = isGranted
        if (isGranted) {
            viewModel.detectLocation(context, currentUser)
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

    LaunchedEffect(currentUser) {
        if (viewModelActiveDistrict == null) {
            if (hasLocationPermission) {
                viewModel.detectLocation(context, currentUser)
            } else {
                locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    LaunchedEffect(viewModelActiveDistrict) {
        if (viewModelActiveDistrict != null) {
            if (news.isEmpty() && !loading) {
                viewModel.loadNews(language, currentUser)
            } else {
                viewModel.refreshIfStale(language, currentUser)
            }
        }
    }

    val onReporterClickRemembered = remember(onReporterClick) { onReporterClick }
    val onProfileClickRemembered = remember(onProfileClick) { onProfileClick }
    val onEditClickRemembered = remember(onEditClick) { onEditClick }

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

    LaunchedEffect(shouldScrollToTop) {
        if (shouldScrollToTop && news.isNotEmpty()) {
            pagerState.animateScrollToPage(0)
            viewModel.resetScrollSignal()
        }
    }

    LaunchedEffect(news) {
        val postsToPreload = news.take(10)
        postsToPreload.forEach { post: NewsPost ->
            if (post.mediaUrl.isNotEmpty()) {
                val request = ImageRequest.Builder(context)
                    .data(post.mediaUrl)
                    .allowHardware(true)
                    .memoryCachePolicy(coil3.request.CachePolicy.ENABLED)
                    .diskCachePolicy(coil3.request.CachePolicy.ENABLED)
                    .build()
                SingletonImageLoader.get(context).enqueue(request)
            }
        }
    }
    
    LaunchedEffect(pagerState, news.size) { 
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val newsIndex = page - (page / 6)
            if (newsIndex >= news.size - 5 && hasMore && !loading) {
                viewModel.loadMore(language, currentUser)
            }

            // 🚀 IMAGE PRELOADING: 8 pages ahead for smoother scroll
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
                            .memoryCachePolicy(coil3.request.CachePolicy.ENABLED)
                            .diskCachePolicy(coil3.request.CachePolicy.ENABLED)
                            .build()
                        SingletonImageLoader.get(context).enqueue(request)
                    }
                }
            }

            // 🚀 LOCAL AD PRELOADING: limit to 12 slots
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
                    
                    // Cache cleanup for out-of-viewport ads
                    val keysToRemove = preloadedAds.keys.filter { it < page - 12 || it > page + 24 }
                    keysToRemove.forEach { key: Int ->
                        val adState = preloadedAds[key]
                        if (adState is AdState.Success) {
                            adState.nativeAd.destroy()
                        }
                        preloadedAds.remove(key)
                    }

                    // AdMob preloading
                    loadAdForPage(futurePage)
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (!isOnline && news.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                    )
                    Text(
                        text = stringResource(R.string.no_internet),
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontFamily = Ramabhadra
                    )
                    Text(
                        text = stringResource(R.string.check_internet),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        fontFamily = Ramabhadra
                    )
                    Button(
                        onClick = { viewModel.loadNews(language, currentUser) }
                    ) {
                        Text(text = stringResource(R.string.retry), fontFamily = Ramabhadra)
                    }
                }
            }
        } else if ((loading || isDetecting) && news.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(40.dp),
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = if (isDetecting) stringResource(R.string.detecting_location) else stringResource(R.string.news_preparing),
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.bodyLarge,
                        fontFamily = Ramabhadra
                    )
                }
            }
        } else if (news.isEmpty() && viewModelActiveDistrict == null) {
            LaunchedEffect(Unit) {
                onDistrictClick()
            }
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = stringResource(R.string.select_district_prompt),
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.bodyLarge,
                        fontFamily = Ramabhadra
                    )
                    Button(
                        onClick = onDistrictClick,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text(stringResource(R.string.select_district), fontFamily = Ramabhadra)
                    }
                }
            }
        } else {
            VerticalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                userScrollEnabled = true,
                flingBehavior = flingBehavior,
                beyondViewportPageCount = 1, // 🚀 Pre-compose adjacent pages → zero jank on swipe
                key = { page ->
                    val isAd = (page + 1) % 6 == 0
                    if (isAd) {
                        "local_ad_slot_$page"
                    } else {
                        val idx = page - (page / 6)
                        if (idx < news.size) news[idx].id else "local_empty_$page"
                    }
                }
            ) { page ->
                val isAdPagePager = (page + 1) % 6 == 0
                if (isAdPagePager) {
                    val adIndex = page / 6
                    val adState = preloadedAds[page]
                    val totalLocalCount = localAds.size
                    // 🚀 derivedStateOf → recompose only when active state actually changes
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
                                val localAd = localAds[adIndex % totalLocalCount]
                                LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                            } else {
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isFailed = true)
                            }
                        } else {
                            // Loading state: Show preloaded local ad instantly instead of spinner, if available
                            if (totalLocalCount > 0) {
                                val localAd = localAds[adIndex % totalLocalCount]
                                LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                            } else {
                                AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null, isLoading = true)
                            }
                        }
                    } else {
                        if (totalLocalCount > 0) {
                            val localAd = localAds[adIndex % totalLocalCount]
                            LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
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
                    if (newsIndex < news.size) {
                        val post = news[newsIndex]
                        // 🚀 derivedStateOf → no unnecessary recomposition during pager drag
                        val isActivePage by remember { derivedStateOf { pagerState.currentPage == page } }
                        NewsCardView(
                            post = post,
                            language = language,
                            currentUser = currentUser,
                            onProfileClick = onProfileClickRemembered,
                            onReporterClick = onReporterClickRemembered,
                            onDistrictClick = onDistrictClick,
                            onEditClick = onEditClickRemembered,
                            modifier = Modifier.fillMaxSize(),
                            district = viewModelActiveDistrict,
                            showDistrictSelector = false,
                            showTopHeader = false,
                            isActive = isActivePage
                        )
                    }
                }
            }
        }
    }

    // Shared DistrictPicker moved to MainScreen
}
