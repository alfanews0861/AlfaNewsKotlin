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
    onNavigateToLogin: () -> Unit = {}
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
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = when (viewMode) {
                    ClassifiedsViewMode.CATEGORIES -> "క్లాసిఫైడ్స్"
                    ClassifiedsViewMode.CATEGORY_ADS -> selectedCategory.split(' ')[0]
                    ClassifiedsViewMode.MY_ADS -> "నా ప్రకటనలు"
                    ClassifiedsViewMode.DETAIL -> "వివరాలు"
                    ClassifiedsViewMode.POST -> "ప్రకటన ఇవ్వండి"
                    else -> "క్లాసిఫైడ్స్"
                },
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                fontFamily = com.alfanews.telugu.ui.theme.Ramabhadra
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
                                        Toast.makeText(context, "ప్రకటన తొలగించబడింది", Toast.LENGTH_SHORT).show()
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
                    ClassifiedsViewMode.CATEGORIES -> "క్లాసిఫైడ్స్"
                    ClassifiedsViewMode.CATEGORY_ADS -> selectedCategory.split(' ')[0]
                    ClassifiedsViewMode.MY_ADS -> "నా ప్రకటనలు"
                    ClassifiedsViewMode.DETAIL -> "వివరాలు"
                    ClassifiedsViewMode.POST -> "ప్రకటన ఇవ్వండి"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = com.alfanews.telugu.ui.theme.Ramabhadra
            )
        },
        navigationIcon = {
            if (viewMode != ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            }
        },
        actions = {
            if (viewMode == ClassifiedsViewMode.CATEGORIES) {
                IconButton(onClick = onMyAdsClick) {
                    Icon(Icons.Default.Person, contentDescription = "My Ads", tint = MaterialTheme.colorScheme.onSurfaceVariant)
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
                    Text("పోస్ట్", fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = com.alfanews.telugu.ui.theme.Mallanna)
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
                            color = Color.White,
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
            .background(Color.White)
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
                    text = if (ad.price > 0) priceFormat.format(ad.price) else "ధర వివరాలు లేవు",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.error
                )
                
                Surface(
                    color = Color(0xFFF3F4F6),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = ad.category.split(' ')[0],
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray
                    )
                }
            }

            Text(
                text = ad.title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 28.sp
            )

            HorizontalDivider(color = Color(0xFFE5E7EB))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = ad.location, fontSize = 16.sp, color = Color.Gray)
                Spacer(modifier = Modifier.weight(1f))
                Icon(Icons.Default.Schedule, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = dateFormat.format(Date(ad.timestamp)),
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            }

            Text(
                text = "వివరాలు",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = ad.description,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                color = Color(0xFF374151)
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
                color = Color(0xFFF9FAFB),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFFE5E7EB),
                        modifier = Modifier.size(48.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Person, contentDescription = null, tint = Color.Gray)
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(text = ad.userName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(text = "విక్రేత", fontSize = 12.sp, color = Color.Gray)
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
                    Text("కాల్ చేయండి", fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = {
                        val number = ad.whatsappNumber ?: ad.contactPhone
                        val cleanNum = number.replace(Regex("\\D"), "")
                        val finalNum = if (cleanNum.length == 10) "91$cleanNum" else cleanNum
                        val message = "నమస్తే, మీ '${ad.title}' ప్రకటన గురించి మరిన్ని వివరాలు తెలుసుకోవాలి."
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
                    Text("చాట్ చేయండి", fontWeight = FontWeight.Bold)
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
                color = MaterialTheme.colorScheme.error
            )
            Text("లోడ్ అవుతున్నాయి...", color = Color.Gray)
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
                tint = Color(0xFFD1D5DB)
            )
            Text(
                text = "ప్రకటనలు ఏవీ లేవు.",
                fontSize = 18.sp,
                color = Color.Gray
            )
            Button(
                onClick = onPostAdClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("ప్రకటన ఇవ్వండి", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun LoginPrompt(onNavigateToLogin: () -> Unit, onCancel: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "ప్రకటన ఇవ్వడానికి దయచేసి లాగిన్ అవ్వండి.",
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(bottom = 16.dp)
        )
        Button(
            onClick = onNavigateToLogin,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Text("లాగిన్ చేయండి", fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onCancel) {
            Text("వెనక్కి వెళ్ళు")
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
