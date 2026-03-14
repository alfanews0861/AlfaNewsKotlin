package com.alfanews.telugu.views.policy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DisclaimerPageView() {
    Card(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "నిరాకరణ (Disclaimer)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("News Aggregator Disclaimer", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF92400E))
                    Text(
                        text = "Alfa News Telugu ఒక వార్తా సేకరణ (Aggregator) వేదిక. ఇందులో ప్రచురించబడే వార్తలు మరియు కంటెంట్ వివిధ మూలాల నుండి సేకరించబడినవి మరియు సంక్షిప్తీకరించబడినవి. మూల వనరులలో ఉండే లోపాలకు మేము బాధ్యత వహించము.",
                        fontSize = 14.sp,
                        color = Color(0xFF92400E)
                    )
                }
            }
            
            Text(
                text = "Alfa News Telugu వెబ్‌సైట్/అప్లికేషన్‌లో అందించబడిన సమాచారం కేవలం సాధారణ సమాచార ప్రయోజనాల కోసం మాత్రమే. మేము సమాచారాన్ని వీలైనంత ఖచ్చితంగా మరియు తాజాగా ఉంచడానికి ప్రయత్నిస్తున్నప్పటికీ, వెబ్‌సైట్‌లోని సమాచారం యొక్క సంపూర్ణత, ఖచ్చితత్వం, విశ్వసనీయత గురించి మేము ఎలాంటి హామీలు ఇవ్వము.",
                fontSize = 16.sp
            )
            
            Text("Takedown Policy (కంటెంట్ తొలగింపు)", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("ఎవరికైనా మా యాప్‌లోని ఏదైనా కంటెంట్ లేదా ఇమేజ్ పట్ల అభ్యంతరం ఉంటే మాకు మెయిల్ చేయండి. Email: contact@alfanews.app. మేము 24 గంటల్లో స్పందించి, అభ్యంతరకరమైన కంటెంట్‌ను తొలగిస్తాము.", fontSize = 16.sp)
            
            Text("సమాచారంపై ఆధారపడటం", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("ఈ వెబ్‌సైట్‌లోని సమాచారంపై మీరు ఉంచే ఏదైనా నమ్మకం పూర్తిగా మీ స్వంత పూచీపై ఆధారపడి ఉంటుంది. ఈ వెబ్‌సైట్ వాడకం వలన కలిగే ఏదైనా నష్టం లేదా హానికి మేము బాధ్యత వహించము.", fontSize = 16.sp)
        }
    }
}
