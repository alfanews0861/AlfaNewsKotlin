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
fun PrivacyPolicyPageView() {
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
                text = "గోప్యతా విధానం (Privacy Policy)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "Alfa News Telugu (\"మేము,\" \"మా,\" \"మాకు\") మీ గోప్యతను గౌరవిస్తుంది. ఈ గోప్యతా విధానం మేము మా వెబ్‌సైట్/అప్లికేషన్ (\"సేవ\") ద్వారా మీ నుండి ఏ సమాచారాన్ని సేకరిస్తాము, దానిని ఎలా ఉపయోగిస్తాము, మరియు ఎలా భద్రపరుస్తాము అనే విషయాలను వివరిస్తుంది.",
                fontSize = 16.sp
            )
            
            Text("మేము సేకరించే సమాచారం", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• వ్యక్తిగత గుర్తింపు సమాచారం: మీరు మా సేవలో రిజిస్టర్ అయినప్పుడు, మేము మీ పేరు, ఇమెయిల్ చిరునామా మరియు ప్రొఫైల్ చిత్రం వంటి సమాచారాన్ని సేకరించవచ్చు.", fontSize = 16.sp)
                Text("• వినియోగ డేటా: మీరు ఏ వార్తలను చదువుతున్నారు, ఎంత సమయం గడుపుతున్నారు, ఏ ఫీచర్లను ఉపయోగిస్తున్నారు వంటి సమాచారాన్ని మేము స్వయంచాలకంగా సేకరించవచ్చు.", fontSize = 16.sp)
                Text("• పరికర సమాచారం: మీ పరికరం రకం, ఆపరేటింగ్ సిస్టమ్, ప్రత్యేక ఐడెంటిఫైయర్‌లు మరియు నెట్‌వర్క్ సమాచారం వంటివి మేము సేకరించవచ్చు.", fontSize = 16.sp)
            }
            
            Text("సమాచారాన్ని ఎలా ఉపయోగిస్తాము", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• మా సేవను అందించడానికి మరియు నిర్వహించడానికి.", fontSize = 16.sp)
                Text("• మీ అనుభవాన్ని వ్యక్తిగతీకరించడానికి.", fontSize = 16.sp)
                Text("• మా సేవను మెరుగుపరచడానికి మరియు కొత్త ఫీచర్లను అభివృద్ధి చేయడానికి.", fontSize = 16.sp)
                Text("• మీతో కమ్యూనికేట్ చేయడానికి, ముఖ్యమైన నవీకరణలు లేదా నోటిఫికేషన్లు పంపడానికి.", fontSize = 16.sp)
                Text("• మోసాలను నివారించడానికి మరియు మా సేవా నిబంధనలను అమలు చేయడానికి.", fontSize = 16.sp)
            }
            
            Text("సమాచార భద్రత", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మేము మీ సమాచారాన్ని రక్షించడానికి తగిన సాంకేతిక మరియు సంస్థాగత చర్యలను తీసుకుంటాము. అయినప్పటికీ, ఇంటర్నెట్‌లో డేటా ప్రసారం 100% సురక్షితం కాదని గమనించండి.", fontSize = 16.sp)
        }
    }
}
