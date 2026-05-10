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
    val preloadedAds = remember { mutableStateMapOf<Int, NativeAd?>() }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

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

    // 🔄 When district is detected/changed, refresh news with personalized content
    // This ensures new users get district-specific + personalized news once location is determined
    LaunchedEffect(userDistrict) {
        if (userDistrict != null && news.isNotEmpty()) {
            // District was just determined for a new user - refresh with personalized content
            viewModel.loadNews(language, currentUser)
        }
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
         // ✅ Only preload first 5 images to reduce memory pressure
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
              val currentNewsIndex = page - (page / 6)
              if (currentNewsIndex >= news.size - 3 && hasMore && !loading) {
                  viewModel.loadMore(language, currentUser)
              }

              // ✅ OPTIMIZED: Preload only 2-3 images ahead instead of 5 to reduce scroll stuttering
              // Only preload forward, not backward
              (1..2).forEach { offset ->
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

              // Load ads with better throttling
              val currentAdSlot = page / 6
              val nextAdPage = (currentAdSlot * 6) + 5
              if (nextAdPage < totalCount && nextAdPage % 12 == 5) {  // Load ads at regular intervals
                  loadAdForPage(nextAdPage)
              }
          }
      }

    Box(
        modifier = Modifier
            .fillMaxSize()
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
                 flingBehavior = PagerDefaults.flingBehavior(
                     state = pagerState,
                     snapPositionalThreshold = 0.25f  // ✅ Increased threshold for smoother fling
                 ),
                 key = { page ->
                    val isAd = (page + 1) % 6 == 0
                    if (isAd) "ad_$page" else {
                        val idx = page - (page / 6)
                        if (idx < news.size) news[idx].id else "empty_$page"
                    }
                }
             ) { page ->
                  // 🎞️ యానిమేషన్ లెక్కలు: స్క్రోల్ చేస్తున్నప్పుడు కార్డు సైజు మరియు ట్రాన్స్పరెన్సీ మారుతుంది
                  // ✅ OPTIMIZED: Use derived state to prevent excessive recalculations during scroll
                  val pageOffset = remember(page) {
                      derivedStateOf {
                          ((pagerState.currentPage - page) + pagerState.currentPageOffsetFraction).absoluteValue
                      }
                  }
                  val scale = remember(page) {
                      derivedStateOf {
                          val offset = pageOffset.value
                          (1f - (offset * 0.08f).coerceIn(0f, 0.08f)).coerceIn(0.92f, 1f)
                      }
                  }
                  val alpha = remember(page) {
                      derivedStateOf {
                          val offset = pageOffset.value
                          (1f - (offset * 0.2f).coerceIn(0f, 0.2f)).coerceIn(0.8f, 1f)
                      }
                  }

                  Box(
                      modifier = Modifier
                          .fillMaxSize()
                          .graphicsLayer(
                              scaleX = scale.value,
                              scaleY = scale.value,
                              alpha = alpha.value
                          )
                  ) {
                    val isAdPage = (page + 1) % 6 == 0
                    if (isAdPage) {
                        val nativeAd = preloadedAds[page]
                        if (nativeAd != null) {
                            AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                if (preloadedAds.containsKey(page)) {
                                    Text(
                                        text = stringResource(R.string.sponsored_content),
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                        fontSize = 12.sp
                                    )
                                } else {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
                                        strokeWidth = 2.dp
                                    )
                                }
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
                                    modifier = Modifier.fillMaxSize()
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
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
