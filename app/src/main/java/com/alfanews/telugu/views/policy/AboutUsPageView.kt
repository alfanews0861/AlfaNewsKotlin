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
fun AboutUsPageView() {
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
                text = "మా గురించి (About Us)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDBEAFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("News Aggregator", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF1E3A8A))
                    Text(
                        text = "Alfa News Telugu అనేది ఒక News Aggregator అప్లికేషన్. మేము వివిధ విశ్వసనీయ వార్తా వనరులు, వెబ్‌సైట్‌లు మరియు సోషల్ మీడియా నుండి సమాచారాన్ని సేకరించి, మా పాఠకులకు క్లుప్తంగా, \"సూటిగా, సుత్తి లేకుండా\" అందిస్తాము. మా లక్ష్యం కేవలం సమాచారాన్ని సంక్షిప్తీకరించి (Summarized), తక్కువ సమయంలో ఎక్కువ విషయాలు తెలుసుకునేలా చేయడం.",
                        fontSize = 16.sp
                    )
                }
            }
            
            Text(
                text = "ఈ రోజుల్లో సమయం చాలా విలువైందని మేము అర్థం చేసుకున్నాము, అందుకే మేము వార్తలను 60-70 పదాలలో అందిస్తున్నాము.",
                fontSize = 16.sp
            )
            
            Text(
                text = "మా దృష్టి",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFDC2626)
            )
            Text(
                text = "వార్తా ప్రపంచంలో ఒక నమ్మకమైన మరియు ముఖ్యమైన వేదికగా నిలవడమే మా దృష్టి. మేము కేవలం వార్తలను నివేదించడమే కాకుండా, వాటి వెనుక ఉన్న వాస్తవాలను లోతుగా విశ్లేషించి, మా పాఠకులకు పూర్తి అవగాహన కల్పించాలనుకుంటున్నాము.",
                fontSize = 16.sp
            )
            
            Text(
                text = "మా విలువలు",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFDC2626)
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• నిజాయితీ: మేము అందించే ప్రతి వార్తలో వాస్తవికత మరియు పారదర్శకతను పాటిస్తాము.", fontSize = 16.sp)
                Text("• వేగం: సంఘటన జరిగిన వెంటనే, మేము దానిని మీ ముందుకు తీసుకువస్తాము.", fontSize = 16.sp)
                Text("• క్లుప్తత: అనవసరమైన వివరాలు లేకుండా, వార్త యొక్క సారాంశాన్ని మాత్రమే అందిస్తాము.", fontSize = 16.sp)
                Text("• ప్రజా పక్షం: మేము ఎల్లప్పుడూ ప్రజల పక్షాన నిలబడి, వారి గొంతును వినిపిస్తాము.", fontSize = 16.sp)
            }
            
            Divider()
            
            Text(
                text = "DMCA / Takedown Policy",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3F4F6)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "మేము ఇతరుల కాపీరైట్ మరియు మేధో సంపత్తి హక్కులను గౌరవిస్తాము. మా యాప్‌లో ఉన్న ఏదైనా కంటెంట్, ఇమేజ్ లేదా వీడియో పట్ల మీకు అభ్యంతరం ఉంటే, లేదా అది మీ కాపీరైట్‌ను ఉల్లంఘిస్తుందని మీరు భావిస్తే, దయచేసి మాకు తెలియజేయండి.",
                        fontSize = 14.sp
                    )
                    Text("Email: contact@alfanews.app", fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    Text("మీ అభ్యర్థనను స్వీకరించిన 24 గంటల్లో మేము సంబంధిత కంటెంట్‌ను సమీక్షించి, తొలగిస్తాము.", fontSize = 12.sp, color = Color.Gray)
                }
            }
            
            Text(
                text = "మా ప్రయాణంలో మాతో చేరినందుకు ధన్యవాదాలు. మీ సూచనలు మరియు అభిప్రాయాలు మాకు ఎంతో విలువైనవి.",
                fontSize = 16.sp
            )
        }
    }
}
