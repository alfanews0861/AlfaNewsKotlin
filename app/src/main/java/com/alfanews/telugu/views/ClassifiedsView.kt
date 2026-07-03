package com.alfanews.telugu.views

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
import com.alfanews.telugu.models.ClassifiedAd
import com.alfanews.telugu.models.ClassifiedCategories
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.AdMobService
import com.alfanews.telugu.viewmodels.ClassifiedsViewModel
import com.google.android.gms.ads.nativead.NativeAd
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

enum class ClassifiedsViewMode {
    CATEGORIES, CATEGORY_ADS, MY_ADS, POST, DETAIL
}

@Composable
fun ClassifiedsView(
    currentUser: User?,
    initialMode: ClassifiedsViewMode = ClassifiedsViewMode.CATEGORIES,
    onNavigateToLogin: () -> Unit = {},
    onMenuClick: (() -> Unit)? = null
) {
    var viewMode by remember { mutableStateOf(initialMode) }
    var selectedAd by remember { mutableStateOf<ClassifiedAd?>(null) }
    val viewModel: ClassifiedsViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
    val ads by viewModel.ads.collectAsState()
    val categoryCounts by viewModel.categoryCounts.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    // Ad Management
    val gridAds = remember { mutableStateMapOf<Int, NativeAd?>() }
    val detailAd = remember { mutableStateOf<NativeAd?>(null) }

    fun loadAdForGrid(index: Int) {
        if (!gridAds.containsKey(index)) {
            gridAds[index] = null
            (context as? android.app.Activity)?.let { activity ->
                AdMobService.loadNativeAd(activity) { ad ->
                    gridAds[index] = ad
                }
            }
        }
    }

    // Sync viewMode with initialMode when it changes externally
    LaunchedEffect(initialMode) {
        viewMode = initialMode
    }

    LaunchedEffect(Unit) {
        viewModel.loadAds(null)
    }
    
    // Load detail ad when switching to detail mode
    LaunchedEffect(viewMode) {
        if (viewMode == ClassifiedsViewMode.DETAIL && detailAd.value == null) {
            (context as? android.app.Activity)?.let { activity ->
                AdMobService.loadNativeAd(activity) { ad ->
                    detailAd.value = ad
                }
            }
        }
    }

    BackHandler(enabled = viewMode != ClassifiedsViewMode.CATEGORIES) {
        when (viewMode) {
            ClassifiedsViewMode.DETAIL -> viewMode = ClassifiedsViewMode.CATEGORY_ADS
            ClassifiedsViewMode.CATEGORY_ADS -> viewMode = ClassifiedsViewMode.CATEGORIES
            ClassifiedsViewMode.MY_ADS -> viewMode = ClassifiedsViewMode.CATEGORIES
            ClassifiedsViewMode.POST -> viewMode = ClassifiedsViewMode.CATEGORIES
            else -> viewMode = ClassifiedsViewMode.CATEGORIES
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onMenuClick != null && viewMode == ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = onMenuClick) {
                    Icon(Icons.Default.Menu, contentDescription = "Menu", tint = MaterialTheme.colorScheme.primary)
                }
                Spacer(modifier = Modifier.width(8.dp))
            } else if (viewMode != ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = {
                    when (viewMode) {
                        ClassifiedsViewMode.DETAIL -> viewMode = ClassifiedsViewMode.CATEGORY_ADS
                        ClassifiedsViewMode.CATEGORY_ADS -> viewMode = ClassifiedsViewMode.CATEGORIES
                        ClassifiedsViewMode.MY_ADS -> viewMode = ClassifiedsViewMode.CATEGORIES
                        ClassifiedsViewMode.POST -> viewMode = ClassifiedsViewMode.CATEGORIES
                        else -> viewMode = ClassifiedsViewMode.CATEGORIES
                    }
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.primary)
                }
                Spacer(modifier = Modifier.width(8.dp))
            }

            Text(
                text = when (viewMode) {
                    ClassifiedsViewMode.CATEGORIES -> stringResource(R.string.title_classifieds)
                    ClassifiedsViewMode.CATEGORY_ADS -> selectedCategory.split(' ')[0]
                    ClassifiedsViewMode.MY_ADS -> stringResource(R.string.my_ads)
                    ClassifiedsViewMode.DETAIL -> stringResource(R.string.ad_details)
                    ClassifiedsViewMode.POST -> stringResource(R.string.post_ad)
                    else -> stringResource(R.string.title_classifieds)
                },
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                fontFamily = com.alfanews.telugu.ui.theme.Ramabhadra,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        Box(modifier = Modifier.fillMaxSize()) {
            when (viewMode) {
                ClassifiedsViewMode.CATEGORIES -> {
                    CategoriesGrid(
                        categoryCounts = categoryCounts,
                        onCategoryClick = { category ->
                            viewModel.setCategory(category)
                            viewMode = ClassifiedsViewMode.CATEGORY_ADS
                        }
                    )
                }
                ClassifiedsViewMode.CATEGORY_ADS -> {
                    if (loading && ads.isEmpty()) {
                        LoadingState()
                    } else if (ads.isEmpty()) {
                        EmptyState(viewMode) { viewMode = ClassifiedsViewMode.POST }
                    } else {
                        AdsGrid(
                            ads = ads,
                            currentUser = currentUser,
                            viewMode = viewMode,
                            gridAds = gridAds,
                            onLoadAd = { loadAdForGrid(it) },
                            onAdClick = { ad ->
                                selectedAd = ad
                                viewMode = ClassifiedsViewMode.DETAIL
                            },
                            onDelete = { adId ->
                                scope.launch {
                                    val result = viewModel.deleteAd(adId)
                                    if (result.isSuccess) {
                                        Toast.makeText(context, context.getString(R.string.ad_deleted), Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        )
                    }
                }
                ClassifiedsViewMode.MY_ADS -> {
                    AdsGrid(
                        ads = ads,
                        currentUser = currentUser,
                        viewMode = viewMode,
                        gridAds = gridAds,
                        onLoadAd = { loadAdForGrid(it) },
                        onAdClick = { ad ->
                            selectedAd = ad
                            viewMode = ClassifiedsViewMode.DETAIL
                        },
                        onDelete = { adId ->
                            scope.launch {
                                val result = viewModel.deleteAd(adId)
                                if (result.isSuccess) {
                                    Toast.makeText(context, "ప్రకటన తొలగించబడింది", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    )
                }
                ClassifiedsViewMode.DETAIL -> {
                    selectedAd?.let { ad ->
                        ClassifiedAdDetailView(
                            ad = ad,
                            nativeAd = detailAd.value,
                            onBack = { viewMode = ClassifiedsViewMode.CATEGORY_ADS }
                        )
                    }
                }
                ClassifiedsViewMode.POST -> {
                    if (currentUser == null) {
                        LoginPrompt(onNavigateToLogin) {
                            viewMode = ClassifiedsViewMode.CATEGORIES
                        }
                    } else {
                        PostClassifiedAdView(
                            currentUser = currentUser,
                            onSuccess = { 
                                viewMode = ClassifiedsViewMode.CATEGORIES
                                viewModel.loadAds(null)
                            },
                            onCancel = { viewMode = ClassifiedsViewMode.CATEGORIES }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClassifiedsHeader(
    viewMode: ClassifiedsViewMode,
    selectedCategory: String,
    onBack: () -> Unit,
    onPostClick: () -> Unit,
    onMyAdsClick: () -> Unit
) {
    CenterAlignedTopAppBar(
        title = {
            Text(
                text = when (viewMode) {
                    ClassifiedsViewMode.CATEGORIES -> stringResource(R.string.title_classifieds)
                    ClassifiedsViewMode.CATEGORY_ADS -> selectedCategory.split(' ')[0]
                    ClassifiedsViewMode.MY_ADS -> stringResource(R.string.my_ads)
                    ClassifiedsViewMode.DETAIL -> stringResource(R.string.ad_details)
                    ClassifiedsViewMode.POST -> stringResource(R.string.post_ad)
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = com.alfanews.telugu.ui.theme.Ramabhadra,
                color = MaterialTheme.colorScheme.onSurface
            )
        },
        navigationIcon = {
            if (viewMode != ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack, 
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        },
        actions = {
            if (viewMode == ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = onMyAdsClick) {
                    Icon(
                        Icons.Default.Person, 
                        contentDescription = "My Ads", 
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            if (viewMode != ClassifiedsViewMode.POST) {
                FilledTonalButton(
                    onClick = onPostClick,
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    modifier = Modifier.padding(end = 8.dp).height(36.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        stringResource(R.string.nav_post), 
                        fontSize = 12.sp, 
                        fontWeight = FontWeight.Bold, 
                        fontFamily = com.alfanews.telugu.ui.theme.Mallanna
                    )
                }
            }
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.primary
        )
    )
}

@Composable
fun CategoriesGrid(
    categoryCounts: Map<String, Int>,
    onCategoryClick: (String) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        items(ClassifiedCategories.categories.size) { index ->
            val category = ClassifiedCategories.categories[index]
            val count = categoryCounts[category] ?: 0
            CategoryCard(
                label = category,
                icon = getCategoryIcon(category),
                count = count,
                onClick = { onCategoryClick(category) }
            )
        }
    }
}

@Composable
fun CategoryCard(
    label: String,
    icon: ImageVector,
    count: Int,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(130.dp),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                    modifier = Modifier.size(56.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            icon,
                            contentDescription = null,
                            modifier = Modifier.size(28.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = label.split(' ')[0],
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = com.alfanews.telugu.ui.theme.Mallanna,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // Badge
            if (count > 0) {
                Surface(
                    color = MaterialTheme.colorScheme.primary,
                    shape = CircleShape,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(20.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = count.toString(),
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ClassifiedAdDetailView(
    ad: ClassifiedAd,
    nativeAd: NativeAd?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val priceFormat = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }
    val dateFormat = remember { SimpleDateFormat("dd MMMM yyyy", Locale.getDefault()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .verticalScroll(rememberScrollState())
    ) {
        // Large Image
        Box(modifier = Modifier.fillMaxWidth().height(300.dp)) {
            AsyncImage(
                model = ad.imageUrl.ifEmpty { "https://via.placeholder.com/600x400?text=No+Image" },
                contentDescription = ad.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = if (ad.price > 0) priceFormat.format(ad.price) else stringResource(R.string.price_not_available),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.error
                )
                
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = ad.category.split(' ')[0],
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Text(
                text = ad.title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 28.sp,
                color = MaterialTheme.colorScheme.onSurface
            )

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.LocationOn, 
                    contentDescription = null, 
                    tint = MaterialTheme.colorScheme.onSurfaceVariant, 
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = ad.location, 
                    fontSize = 16.sp, 
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))
                Icon(
                    Icons.Default.Schedule, 
                    contentDescription = null, 
                    tint = MaterialTheme.colorScheme.onSurfaceVariant, 
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = dateFormat.format(Date(ad.timestamp)),
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = stringResource(R.string.ad_details),
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = ad.description,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            // Native Ad after description
            AdMobCardView(
                modifier = Modifier.fillMaxWidth().height(250.dp),
                nativeAd = nativeAd
            )

            Spacer(modifier = Modifier.height(24.dp))
            
            // Seller Info
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.size(48.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.Person, 
                                contentDescription = null, 
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = ad.userName, 
                            fontWeight = FontWeight.Bold, 
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = stringResource(R.string.seller), 
                            fontSize = 12.sp, 
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Bottom Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = {
                        val intent = Intent(Intent.ACTION_DIAL).apply {
                            data = Uri.parse("tel:${ad.contactPhone}")
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.weight(1f).height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.call_now), fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = {
                        val number = ad.whatsappNumber ?: ad.contactPhone
                        val cleanNum = number.replace(Regex("\\D"), "")
                        val finalNum = if (cleanNum.length == 10) "91$cleanNum" else cleanNum
                        val message = context.getString(R.string.whatsapp_message, ad.title)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            data = Uri.parse("https://wa.me/$finalNum?text=${Uri.encode(message)}")
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.weight(1f).height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Icon(Icons.Default.Chat, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.chat_now), fontWeight = FontWeight.Bold)
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun AdsGrid(
    ads: List<ClassifiedAd>,
    currentUser: User?,
    viewMode: ClassifiedsViewMode,
    gridAds: Map<Int, NativeAd?>,
    onLoadAd: (Int) -> Unit,
    onAdClick: (ClassifiedAd) -> Unit,
    onDelete: (String) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ads.forEachIndexed { index, ad ->
            item(key = ad.id) {
                Box(modifier = Modifier.clickable { onAdClick(ad) }) {
                    ClassifiedAdCardView(
                        ad = ad,
                        isOwner = currentUser?.id == ad.userId,
                        onDelete = if (viewMode == ClassifiedsViewMode.MY_ADS) onDelete else null
                    )
                }
            }
            
            // After every 3 rows (6 items in a 2-column grid)
            if ((index + 1) % 6 == 0) {
                val adIndex = (index + 1) / 6
                onLoadAd(adIndex)
                item(key = "ad_$adIndex", span = { GridItemSpan(2) }) {
                    AdMobCardView(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .padding(vertical = 8.dp),
                        nativeAd = gridAds[adIndex]
                    )
                }
            }
        }
    }
}

@Composable
fun LoadingState() {
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
                stringResource(R.string.loading_ads), 
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun EmptyState(viewMode: ClassifiedsViewMode, onPostAdClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(24.dp)
        ) {
            Icon(
                Icons.Default.Inventory,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.outlineVariant
            )
            Text(
                text = stringResource(R.string.no_ads_found),
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                onClick = onPostAdClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text(stringResource(R.string.post_ad), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun LoginPrompt(onNavigateToLogin: () -> Unit, onCancel: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.login_to_post_ad),
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(bottom = 16.dp)
        )
        Button(
            onClick = {
                onNavigateToLogin()
                onCancel()
            },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            Text(stringResource(R.string.login), fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onCancel) {
            Text(stringResource(R.string.go_back), color = MaterialTheme.colorScheme.primary)
        }
    }
}

fun getCategoryIcon(category: String): ImageVector {
    return when {
        category.contains("స్థిరాస్తి") -> Icons.Default.Home
        category.contains("వాహనాలు") -> Icons.Default.DirectionsCar
        category.contains("ఎలక్ట్రానిక్స్") -> Icons.Default.PhoneAndroid
        category.contains("ఉద్యోగాలు") -> Icons.Default.Work
        category.contains("సేవలు") -> Icons.Default.Build
        category.contains("ఫర్నిచర్") -> Icons.Default.Chair
        else -> Icons.Default.MoreHoriz
    }
}
