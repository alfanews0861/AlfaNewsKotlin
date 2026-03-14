package com.alfanews.telugu.views

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.alfanews.telugu.ViewModelFactory
import com.alfanews.telugu.models.*
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.viewmodels.LocalNewsFeedViewModel
import com.google.android.gms.ads.nativead.NativeAd

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun LocalNewsFeedView(
    language: Language,
    currentUser: User?,
    onProfileClick: () -> Unit = {},
    onReporterClick: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val viewModel: LocalNewsFeedViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = ViewModelFactory(context.applicationContext as Application)
    )
    val news by viewModel.news.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val hasMore by viewModel.hasMore.collectAsState()
    val activeDistrict by viewModel.activeDistrict.collectAsState()
    val isDetecting by viewModel.isDetecting.collectAsState()
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
        if (activeDistrict != null && news.isEmpty() && !loading) {
            viewModel.loadNews(language, currentUser)
        }
    }

    val totalCount = if (news.isEmpty()) 0 else news.size + (news.size / 5)
    val pagerState = rememberPagerState(pageCount = { totalCount })

    LaunchedEffect(pagerState, news.size) { 
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val newsIndex = page - (page / 6)
            if (newsIndex >= news.size - 3 && hasMore && !loading) {
                viewModel.loadMore(language, currentUser)
            }

            val currentAdSlot = page / 6
            val nextAdPage = (currentAdSlot * 6) + 5
            if (nextAdPage < totalCount) {
                loadAdForPage(nextAdPage)
            }

            val afterNextAdPage = ((currentAdSlot + 1) * 6) + 5
            if (afterNextAdPage < totalCount) {
                loadAdForPage(afterNextAdPage)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if ((loading || isDetecting) && news.isEmpty()) {
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
                        text = if (isDetecting) "మీ ప్రాంతాన్ని గుర్తిస్తున్నాము..." else "ప్రాంతీయ వార్తలు సిద్ధమవుతున్నాయి...",
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.bodyLarge,
                        fontFamily = Ramabhadra
                    )
                }
            }
        } else if (news.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                 Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = if (activeDistrict == null) "దయచేసి మీ జిల్లాను ఎంచుకోండి" else "ఈ జిల్లాలో వార్తలు అందుబాటులో లేవు",
                        color = MaterialTheme.colorScheme.onBackground,
                        style = MaterialTheme.typography.bodyLarge,
                        fontFamily = Ramabhadra
                    )
                     Button(
                        onClick = { showDistrictPicker = true },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text(if (activeDistrict == null) "జిల్లాను ఎంచుకోండి" else "వేరే జిల్లాను ఎంచుకోండి", fontFamily = Ramabhadra)
                    }
                }
            }
        } else {
            VerticalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                userScrollEnabled = true,
                key = { page ->
                    val isAd = (page + 1) % 6 == 0
                    if (isAd) "local_ad_$page" else {
                        val idx = page - (page / 6)
                        if (idx < news.size) news[idx].id else "local_empty_$page"
                    }
                }
            ) { page ->
                val isAdPagePager = (page + 1) % 6 == 0
                if (isAdPagePager) {
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
                                    text = "Sponsored Content",
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
                    if (newsIndex < news.size) {
                        val post = news[newsIndex]

                        NewsCardView(
                            post = post,
                            language = language,
                            currentUser = currentUser,
                            onProfileClick = onProfileClick,
                            onReporterClick = onReporterClick,
                            onDistrictClick = { showDistrictPicker = true },
                            modifier = Modifier.fillMaxSize(),
                            district = if (isDetecting) "గుర్తిస్తున్నాము..." else activeDistrict
                        )
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
