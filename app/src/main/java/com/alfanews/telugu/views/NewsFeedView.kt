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
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.utils.SafeImageLoader
import com.alfanews.telugu.viewmodels.NewsFeedViewModel
import com.google.android.gms.ads.nativead.NativeAd

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NewsFeedView(
    language: Language,
    currentUser: User?,
    viewModel: NewsFeedViewModel,
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {},
    onDistrictClick: () -> Unit = {},
    initialPostId: String? = null
) {
    val news by viewModel.news.collectAsStateWithLifecycle()
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val sharedPostId by viewModel.sharedPostId.collectAsStateWithLifecycle()
    val userDistrict by viewModel.userDistrict.collectAsStateWithLifecycle()
    val preloadedAds = remember { mutableStateMapOf<Int, NativeAd?>() }

    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            viewModel.detectLocation(context, currentUser, language)
        }
    }

    LaunchedEffect(Unit) {
        if (news.isEmpty()) {
            viewModel.loadNews(language, currentUser, initialPostId)
        }
        
        if (userDistrict == null) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                viewModel.detectLocation(context, currentUser, language)
            } else {
                permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
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
        val postsToPreload = news.take(5)
        postsToPreload.forEach { post: com.alfanews.telugu.models.NewsPost ->
            if (post.mediaUrl.isNotEmpty()) {
                val request = ImageRequest.Builder(context)
                    .data(post.mediaUrl)
                    .build()
                imageLoader.enqueue(request)
            }
        }
    }

    val totalCount = remember(news.size) { if (news.isEmpty()) 0 else news.size + (news.size / 5) }
    val pagerState = rememberPagerState(pageCount = { totalCount })

    LaunchedEffect(pagerState, news.size) { 
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val currentNewsIndex = page - (page / 6)
            if (currentNewsIndex >= news.size - 3 && hasMore && !loading) {
                viewModel.loadMore(language, currentUser)
            }

            (1..4).forEach { offset ->
                val nextPageIndex = page + offset
                val nextNewsIndex = nextPageIndex - (nextPageIndex / 6)
                if (nextNewsIndex >= 0 && nextNewsIndex < news.size) {
                    val post = news[nextNewsIndex]
                    if (post.mediaUrl.isNotEmpty()) {
                        val request = ImageRequest.Builder(context)
                            .data(post.mediaUrl)
                            .build()
                        imageLoader.enqueue(request)
                    }
                }
            }

            val currentAdSlot = page / 6
            val nextAdPage = (currentAdSlot * 6) + 5
            if (nextAdPage < totalCount) {
                loadAdForPage(nextAdPage)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
    ) {
        if (loading && news.isEmpty()) {
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
        } else if (!loading && news.isEmpty()) {
             Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stringResource(R.string.no_news_available),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(32.dp),
                    textAlign = TextAlign.Center
                )
            }
        } else {
            VerticalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                userScrollEnabled = true,
                flingBehavior = PagerDefaults.flingBehavior(
                    state = pagerState,
                    snapPositionalThreshold = 0.2f
                ),
                key = { page ->
                    val isAd = (page + 1) % 6 == 0
                    if (isAd) "ad_$page" else {
                        val idx = page - (page / 6)
                        if (idx < news.size) news[idx].id else "empty_$page"
                    }
                }
            ) { page ->
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
                        NewsCardView(
                            post = post,
                            language = language,
                            currentUser = currentUser,
                            onProfileClick = onProfileClick,
                            onReporterClick = onReporterClick,
                            onDistrictClick = onDistrictClick,
                            autoShare = sharedPostId == post.id,
                            onAutoShareDone = { viewModel.setSharedPostId(null) },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }
    }
}
