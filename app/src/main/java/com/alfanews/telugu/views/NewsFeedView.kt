package com.alfanews.telugu.views

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.crossfade
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.graphics.graphicsLayer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import kotlin.math.absoluteValue
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.utils.SafeImageLoader
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.google.android.gms.ads.nativead.NativeAd
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.collect

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
        // If district is not set, try to detect it but DON'T block the news loading
        // When district is detected, the view will refresh automatically through userDistrict flow
        if (userDistrict == null) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                // Fire and forget - location detection happens in viewModel background
                viewModel.detectLocation(context, currentUser, language)
            } else {
                // Fire and forget - permission request happens in background
                permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    // 🔄 When district is detected for the FIRST TIME (new user), refresh news with personalized content
    // Only triggers if news is already loaded (not empty) AND district just changed from null → value
    var previousDistrict by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(userDistrict) {
        if (userDistrict != null && previousDistrict == null && news.isNotEmpty()) {
            // District was just determined for a NEW user — refresh with personalized content
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

     val imageLoader = remember { SafeImageLoader.getImageLoader(context) }
     LaunchedEffect(news) {
         // 🖼️ Memory Optimization: 15 నుండి 5 కి తగ్గించాం
         val postsToPreload = news.take(5)
         postsToPreload.forEach { post: com.alfanews.telugu.models.NewsPost ->
             if (post.mediaUrl.isNotEmpty()) {
                 val request = ImageRequest.Builder(context)
                     .data(post.mediaUrl)
                     .crossfade(false)  // Disable crossfade for preload
                     .allowHardware(false) // Disable hardware for background preload
                     .memoryCachePolicy(coil3.request.CachePolicy.ENABLED)
                     .diskCachePolicy(coil3.request.CachePolicy.ENABLED)
                     .build()
                 imageLoader.enqueue(request)
             }
         }
     }

    // యాడ్ స్లాట్ల కారణంగా టోటల్ పేజీ కౌంట్ కాలిక్యులేట్ చేయండి (5 వార్తల తర్వాత 1 యాడ్)
    val totalCount = remember(news.size) {
        val newsCount = news.size
        if (newsCount == 0) 0 
        else newsCount + (newsCount - 1) / 5
    }
    val pagerState = rememberPagerState(pageCount = { totalCount })

    // 🚀 సెన్సిటివిటీని పెంచడానికి ఫ్లింగ్ బిహేవియర్ (ఇమేజ్ మరియు కంటెంట్ ఏరియాలో ఒకేలా ఉంటుంది)
    val flingBehavior = PagerDefaults.flingBehavior(
        state = pagerState,
        snapPositionalThreshold = 0.15f // 15% దూరం జరిపితే చాలు పేజీ మారిపోతుంది (చాలా స్మూత్ గా ఉంటుంది)
    )

    // Scroll to shared/initial post when available
    LaunchedEffect(sharedPostId, news.size) {
        if (sharedPostId != null && news.isNotEmpty()) {
            val postIndex = news.indexOfFirst { it.id == sharedPostId }
            if (postIndex >= 0) {
                // Calculate page index accounting for ad slots (1 ad per 6 items)
                val pageIndex = postIndex + (postIndex / 5)
                pagerState.animateScrollToPage(pageIndex)
            }
        }
    }

    // 🔄 Auto-scroll to top when fresh news is loaded after a long time
    LaunchedEffect(shouldScrollToTop) {
        if (shouldScrollToTop && news.isNotEmpty()) {
            pagerState.animateScrollToPage(0)
            viewModel.resetScrollSignal()
        }
    }

    // 🔄 ల్యాంబ్డా ఫంక్షన్లను రిమెంబర్ చేయడం వల్ల రీ-కంపోజిషన్లు తగ్గుతాయి
    val onReporterClickRemembered = remember(onReporterClick) { onReporterClick }
    val onProfileClickRemembered = remember(onProfileClick) { onProfileClick }
    val onDistrictClickRemembered = remember(onDistrictClick) { onDistrictClick }
    val onEditClickRemembered = remember(onEditClick) { onEditClick }
    val onAutoShareDoneRemembered = remember { { viewModel.setSharedPostId(null) } }

      LaunchedEffect(pagerState, news.size) {
          snapshotFlow { pagerState.currentPage }.collect { page ->
              // ⏱️ Long View Tracking: ఒక వార్తను 4 సెకన్ల కంటే ఎక్కువ చూస్తే రికార్డ్ చేస్తాం
              val isAdSlot = (page + 1) % 6 == 0
              if (!isAdSlot) {
                  val newsIndex = page - (page / 6)
                  if (newsIndex >= 0 && newsIndex < news.size) {
                      val currentPost = news[newsIndex]
                      scope.launch {
                          kotlinx.coroutines.delay(4000) // 4 సెకన్లు వేచి చూడాలి
                          // యూజర్ ఇంకా అదే పేజీలో ఉన్నారో లేదో చెక్ చేయాలి
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

              // 🖼️ Memory Optimization: Preload only 3 images ahead instead of 15
              // Only preload forward, not backward
              (1..3).forEach { offset ->
                  val nextPageIndex = page + offset
                  val nextNewsIndex = nextPageIndex - (nextPageIndex / 6)
                  if (nextNewsIndex >= 0 && nextNewsIndex < news.size) {
                      val post = news[nextNewsIndex]
                      if (post.mediaUrl.isNotEmpty()) {
                          val request = ImageRequest.Builder(context)
                              .data(post.mediaUrl)
                              .crossfade(false)  // Disable crossfade for preload
                              .allowHardware(false) // Disable hardware for background preload
                              .memoryCachePolicy(coil3.request.CachePolicy.ENABLED)
                              .diskCachePolicy(coil3.request.CachePolicy.ENABLED)
                              .build()
                          imageLoader.enqueue(request)
                      }
                  }
              }

              // Preload AdMob ads up to 24 pages ahead (Ensures at least 4 ads are always ready)
              (1..24).forEach { offset ->
                  val futurePage = page + offset
                  val isAdSlot = (futurePage + 1) % 6 == 0
                  if (isAdSlot && futurePage < totalCount) {
                      loadAdForPage(futurePage)
                  }
              }
          }
      }

    Box(
        modifier = Modifier
            .fillMaxSize()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ✅ FIXED HEADER: Always visible even if news is empty or loading
            LogoHeader(
                district = userDistrict,
                showDistrictSelector = false,
                onDistrictClick = onDistrictClickRemembered
            )

            Box(modifier = Modifier.weight(1f)) {
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
                                color = MaterialTheme.colorScheme.onBackground
                            )
                            Text(
                                text = stringResource(R.string.check_internet),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Button(
                                onClick = { viewModel.loadNews(language, currentUser, initialPostId) }
                            ) {
                                Text(text = stringResource(R.string.retry))
                            }
                        }
                    }
                } else if (loading && news.isEmpty()) {
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
                                text = stringResource(R.string.news_preparing),
                                color = MaterialTheme.colorScheme.onBackground,
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }
                    }
                } else {
                    VerticalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize(),
                        userScrollEnabled = true,
                        flingBehavior = flingBehavior,
                        key = { page ->
                            val isAd = (page + 1) % 6 == 0
                            if (isAd) {
                                "home_ad_slot_$page"
                            } else {
                                val idx = page - (page / 6)
                                if (idx < news.size) news[idx].id else "empty_$page"
                            }
                        }
                    ) { page ->
                        Box(
                            modifier = Modifier.fillMaxSize()
                        ) {
                            val isAdPage = (page + 1) % 6 == 0
                            if (isAdPage) {
                                val adIndex = page / 6
                                val nativeAd = preloadedAds[page]
                                val totalLocalCount = localAds.size

                                // 🔄 Smart Rotation & Priority Logic:
                                // 1. AdMob and Local Ads rotate 1:1 to ensure variety.
                                // 2. We respect the user's "Priority to AdMob" by making AdMob the default fallback.
                                // 3. Local ads are rotated using (adIndex % totalLocalCount).
                                val preferAdMob = adIndex % 2 == 0

                                val isCurrentPage = pagerState.currentPage == page

                                if (preferAdMob) {
                                    // 🚀 AdMob Slot (Priority)
                                    if (nativeAd != null) {
                                        AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                    } else if (totalLocalCount > 0) {
                                        // Fallback to Local Ad if AdMob is still loading or failed
                                        val localAd = localAds[adIndex % totalLocalCount]
                                        LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                    } else {
                                        AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
                                    }
                                } else {
                                    // 🏠 Local Ad Slot (Priority)
                                    if (totalLocalCount > 0) {
                                        val localAd = localAds[adIndex % totalLocalCount]
                                        LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize(), isActive = isCurrentPage)
                                    } else if (nativeAd != null) {
                                        // Fallback to AdMob if no local ads are available
                                        AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                    } else {
                                        AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
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
                                            onLocationRequest = {
                                                viewModel.detectLocation(context, currentUser, language)
                                            },
                                            modifier = Modifier.fillMaxSize(),
                                            showTopHeader = false // ✅ Fix: Double header removed as LogoHeader is already present
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
                                            showTopHeader = false // ✅ Header is already shown at top level
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
