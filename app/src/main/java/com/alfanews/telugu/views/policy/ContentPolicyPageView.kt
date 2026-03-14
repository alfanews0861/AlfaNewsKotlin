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
fun ContentPolicyPageView() {
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
                text = "కంటెంట్ విధానం (Content Policy)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "Alfa News Telugu ప్లాట్‌ఫారమ్‌పై సురక్షితమైన మరియు గౌరవప్రదమైన వాతావరణాన్ని సృష్టించడానికి మేము కట్టుబడి ఉన్నాము. మా సేవలను ఉపయోగించే ప్రతి ఒక్కరూ ఈ కంటెంట్ విధానాన్ని తప్పనిసరిగా పాటించాలి.",
                fontSize = 16.sp
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("కాపీరైట్ ఉల్లంఘన ఫిర్యాదులు:", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF991B1B))
                    Text("ఎవరికైనా మా యాప్‌లోని ఏదైనా కంటెంట్ లేదా ఇమేజ్ పట్ల అభ్యంతరం ఉంటే, దయచేసి మాకు మెయిల్ చేయండి. మేము కాపీరైట్ చట్టాలను గౌరవిస్తాము.", fontSize = 14.sp)
                    Text("Email: contact@alfanews.app", fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    Text("మేము 24 గంటల్లో స్పందించి, అభ్యంతరకరమైన కంటెంట్‌ను తొలగిస్తాము.", fontSize = 12.sp, color = Color.Gray)
                }
            }
            
            Text("నిషిద్ధ కంటెంట్", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• ద్వేషపూరిత ప్రసంగం: జాతి, మతం, కులం, లింగం ఆధారంగా వ్యక్తులు లేదా సమూహాలపై హింసను ప్రేరేపించే కంటెంట్.", fontSize = 16.sp)
                Text("• వేధింపులు మరియు బెదిరింపులు: ఇతరులను లక్ష్యంగా చేసుకుని వేధించడం, బెదిరించడం లేదా భయపెట్టడం.", fontSize = 16.sp)
                Text("• అశ్లీలత మరియు లైంగిక కంటెంట్: అశ్లీల చిత్రాలు, వీడియోలు లేదా లైంగికంగా అసభ్యకరమైన కంటెంట్.", fontSize = 16.sp)
                Text("• హింసాత్మక మరియు గ్రాఫిక్ కంటెంట్: అనవసరమైన హింసను, రక్తపాతాన్ని లేదా భయానక చిత్రాలను ప్రదర్శించడం.", fontSize = 16.sp)
            }
        }
    }
}
