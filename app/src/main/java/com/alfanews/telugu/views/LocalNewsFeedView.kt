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
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {},
    onEditClick: (NewsPost) -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val viewModel: LocalNewsFeedViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val news by viewModel.news.collectAsStateWithLifecycle()
    // ... (rest of the code)

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
    val loading by viewModel.loading.collectAsStateWithLifecycle()
    val isOnline by viewModel.isOnline.collectAsStateWithLifecycle()
    val hasMore by viewModel.hasMore.collectAsStateWithLifecycle()
    val activeDistrict by viewModel.activeDistrict.collectAsStateWithLifecycle()
    val isDetecting by viewModel.isDetecting.collectAsStateWithLifecycle()
    val shouldScrollToTop by viewModel.shouldScrollToTop.collectAsStateWithLifecycle()
    val localAds by viewModel.localAds.collectAsStateWithLifecycle()
    val preloadedAds = remember { mutableStateMapOf<Int, NativeAd?>() }

    var showDistrictPicker by remember { mutableStateOf(false) }
    var selectedState by remember { mutableStateOf("TS") }

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
            preloadedAds[page] = null // Placeholder
            val activity = context as? android.app.Activity
            activity?.let {
                AdMobService.loadNativeAd(it) { ad ->
                    preloadedAds[page] = ad
                }
            }
        }
    }

    LaunchedEffect(currentUser) {
        // ఇక్కడ activeDistrict ఇప్పటికే ఉంటే (Profile లేదా Manual Selection) మళ్ళీ డిటెక్ట్ చేయకూడదు
        if (activeDistrict == null) {
            if (hasLocationPermission) {
                viewModel.detectLocation(context, currentUser)
            } else {
                locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    LaunchedEffect(activeDistrict) {
        if (activeDistrict != null) {
            if (news.isEmpty() && !loading) {
                viewModel.loadNews(language, currentUser)
            } else {
                viewModel.refreshIfStale(language, currentUser)
            }
        }
    }

    // 🔄 పర్ఫార్మెన్స్ ఆప్టిమైజేషన్స్
    val onReporterClickRemembered = remember(onReporterClick) { onReporterClick }
    val onProfileClickRemembered = remember(onProfileClick) { onProfileClick }
    val onEditClickRemembered = remember(onEditClick) { onEditClick }

    val totalCount = remember(news.size) {
        val newsCount = news.size
        if (newsCount == 0) 0 
        else newsCount + (newsCount - 1) / 5
    }
    val pagerState = rememberPagerState(pageCount = { totalCount })

    // 🚀 సెన్సిటివిటీని పెంచడానికి ఫ్లింగ్ బిహేవియర్ (ఇమేజ్ మరియు కంటెంట్ ఏరియాలో ఒకేలా ఉంటుంది)
    val flingBehavior = PagerDefaults.flingBehavior(
        state = pagerState,
        snapPositionalThreshold = 0.15f // 15% దూరం జరిపితే చాలు పేజీ మారిపోతుంది
    )

    // 🔄 Auto-scroll to top when fresh news is loaded after a long time
    LaunchedEffect(shouldScrollToTop) {
        if (shouldScrollToTop && news.isNotEmpty()) {
            pagerState.animateScrollToPage(0)
            viewModel.resetScrollSignal()
        }
    }

    val imageLoader = remember { com.alfanews.telugu.utils.SafeImageLoader.getImageLoader(context) }
    
    LaunchedEffect(news) {
        // ✅ Aggressive Preloading: Load first 15 images to ensure smooth scroll for fast users
        val postsToPreload = news.take(15)
        postsToPreload.forEach { post: NewsPost ->
            if (post.mediaUrl.isNotEmpty()) {
                val request = ImageRequest.Builder(context)
                    .data(post.mediaUrl)
                    .crossfade(false)
                    .allowHardware(false)
                    .memoryCachePolicy(coil3.request.CachePolicy.ENABLED)
                    .diskCachePolicy(coil3.request.CachePolicy.ENABLED)
                    .build()
                imageLoader.enqueue(request)
            }
        }
    }
    
    LaunchedEffect(pagerState, news.size) { 
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val newsIndex = page - (page / 6)
            if (newsIndex >= news.size - 7 && hasMore && !loading) {
                viewModel.loadMore(language, currentUser)
            }

            // ✅ Aggressive Preloading: Preload 15 images ahead for ultra-fast scrolling
            (1..15).forEach { offset ->
                val nextPageIndex = page + offset
                val nextNewsIndex = nextPageIndex - (nextPageIndex / 6)
                if (nextNewsIndex >= 0 && nextNewsIndex < news.size) {
                    val post = news[nextNewsIndex]
                    if (post.mediaUrl.isNotEmpty()) {
                        val request = ImageRequest.Builder(context)
                            .data(post.mediaUrl)
                            .crossfade(false)
                            .allowHardware(false)
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
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ✅ FIXED HEADER: Always visible even if news is empty or loading
            LogoHeader(
                district = if (isDetecting) "గుర్తిస్తున్నాము..." else (activeDistrict ?: "జిల్లాను ఎంచుకోండి"),
                showDistrictSelector = true,
                onDistrictClick = { showDistrictPicker = true }
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
                } else if (news.isEmpty() && activeDistrict == null) {
                    LaunchedEffect(Unit) {
                        showDistrictPicker = true
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
                                onClick = { showDistrictPicker = true },
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
                            val nativeAd = preloadedAds[page]
                            val totalLocalCount = localAds.size

                            // 🔄 Smart Rotation & Priority Logic:
                            // 1. AdMob and Local Ads rotate 1:1 to ensure variety.
                            // 2. Priority is given to AdMob in even slots, Local in odd slots.
                            // 3. Fallbacks ensure an ad is always shown if either source fails.
                            val preferAdMob = adIndex % 2 == 0

                            if (preferAdMob) {
                                // 🚀 AdMob Slot (Priority)
                                if (nativeAd != null) {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                } else if (totalLocalCount > 0) {
                                    val localAd = localAds[adIndex % totalLocalCount]
                                    LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize())
                                } else {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
                                }
                            } else {
                                // 🏠 Local Ad Slot (Priority)
                                if (totalLocalCount > 0) {
                                    val localAd = localAds[adIndex % totalLocalCount]
                                    LocalAdCardView(ad = localAd, modifier = Modifier.fillMaxSize())
                                } else if (nativeAd != null) {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = nativeAd)
                                } else {
                                    AdMobCardView(modifier = Modifier.fillMaxSize(), nativeAd = null)
                                }
                            }
                        } else {
                            val newsIndex = page - (page / 6)
                            if (newsIndex < news.size) {
                                val post = news[newsIndex]

                                if (post.type == "weather") {
                                    WeatherCardView(
                                        post = post,
                                        language = language,
                                        onLocationRequest = {
                                            viewModel.detectLocation(context, currentUser)
                                        },
                                        modifier = Modifier.fillMaxSize(),
                                        showTopHeader = false // ✅ Header already shown at top level
                                    )
                                } else {
                                    NewsCardView(
                                        post = post,
                                        language = language,
                                        currentUser = currentUser,
                                        onProfileClick = onProfileClickRemembered,
                                        onReporterClick = onReporterClickRemembered,
                                        onDistrictClick = { showDistrictPicker = true },
                                        onEditClick = onEditClickRemembered,
                                        modifier = Modifier.fillMaxSize(),
                                        district = activeDistrict,
                                        showDistrictSelector = false,
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

    if (showDistrictPicker) {
        AlertDialog(
            onDismissRequest = { if (activeDistrict != null) showDistrictPicker = false },
            title = { Text("నివాస ప్రాంతాన్ని ఎంచుకోండి", fontFamily = Ramabhadra) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = selectedState == "TS",
                            onClick = { selectedState = "TS" },
                            label = { Text("తెలంగాణ") },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = selectedState == "AP",
                            onClick = { selectedState = "AP" },
                            label = { Text("ఆంధ్రప్రదేశ్") },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    var expanded by remember { mutableStateOf(false) }
                    val districts = if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
                    
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = activeDistrict ?: "జిల్లాను ఎంచుకోండి",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("జిల్లా") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                            modifier = Modifier.menuAnchor().fillMaxWidth()
                        )

                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            districts.forEach { district ->
                                DropdownMenuItem(
                                    text = { Text(district) },
                                    onClick = {
                                        viewModel.setDistrict(district)
                                        expanded = false
                                        showDistrictPicker = false
                                    }
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                if (activeDistrict != null) {
                    TextButton(onClick = { showDistrictPicker = false }) {
                        Text("రద్దు", color = Color.Gray)
                    }
                }
            }
        )
    }
}
