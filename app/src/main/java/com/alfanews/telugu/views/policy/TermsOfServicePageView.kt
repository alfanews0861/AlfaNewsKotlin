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
fun TermsOfServicePageView() {
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
                text = "సేవా నిబంధనలు (Terms of Service)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "Alfa News Telugu (\"సేవ\")కి స్వాగతం. ఈ సేవను యాక్సెస్ చేయడం లేదా ఉపయోగించడం ద్వారా, మీరు ఈ సేవా నిబంధనలకు (\"నిబంధనలు\") కట్టుబడి ఉంటారని అంగీకరిస్తున్నారు.",
                fontSize = 16.sp
            )
            
            Text("1. సేవ యొక్క ఉపయోగం", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మీరు మా సేవను కేవలం చట్టబద్ధమైన ప్రయోజనాల కోసం మరియు ఈ నిబంధనలకు అనుగుణంగా మాత్రమే ఉపయోగించడానికి అంగీకరిస్తున్నారు.", fontSize = 16.sp)
            
            Text("2. వినియోగదారు ఖాతాలు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మా సేవ యొక్క కొన్ని ఫీచర్లను యాక్సెస్ చేయడానికి, మీరు ఒక ఖాతాను సృష్టించాల్సి రావచ్చు. మీ ఖాతా సమాచారం యొక్క గోప్యతను మరియు మీ ఖాతా కింద జరిగే అన్ని కార్యకలాపాలకు మీరే బాధ్యత వహించాలి.", fontSize = 16.sp)
            
            Text("3. మేధో సంపత్తి హక్కులు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("ఈ సేవ మరియు దానిలోని అసలు కంటెంట్, ఫీచర్లు మరియు కార్యాచరణ Alfa News Telugu మరియు దాని లైసెన్సర్‌ల యొక్క ప్రత్యేక ఆస్తి. మా వ్రాతపూర్వక అనుమతి లేకుండా మీరు ఈ కంటెంట్‌ను కాపీ చేయడం, పంపిణీ చేయడం లేదా సవరించడం చేయకూడదు.", fontSize = 16.sp)
            
            Text("4. వినియోగదారు కంటెంట్", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మీరు మా సేవలో కంటెంట్‌ను (ఉదాహరణకు, వ్యాఖ్యలు) పోస్ట్ చేస్తే, ఆ కంటెంట్‌కు మీరే పూర్తి బాధ్యత వహిస్తారు. మీరు పోస్ట్ చేసే కంటెంట్ మా కంటెంట్ విధానానికి అనుగుణంగా ఉండాలి.", fontSize = 16.sp)
            
            Text("5. సేవ రద్దు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మీరు ఈ నిబంధనలను ఉల్లంఘిస్తే, ఎలాంటి ముందస్తు నోటీసు లేకుండా, మీ ఖాతాను మరియు మా సేవకు మీ యాక్సెస్‌ను మేము మా స్వంత అభీష్టానుసారం నిలిపివేయవచ్చు లేదా రద్దు చేయవచ్చు.", fontSize = 16.sp)
            
            Text("6. నిబంధనలలో మార్పులు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మేము ఈ నిబంధనలను ఎప్పుడైనా సవరించే హక్కును కలిగి ఉన్నాము. ఏవైనా మార్పులు చేసిన తర్వాత కూడా మీరు మా సేవను ఉపయోగించడం కొనసాగిస్తే, మీరు సవరించిన నిబంధనలను అంగీకరించినట్లుగా పరిగణించబడుతుంది.", fontSize = 16.sp)
        }
    }
}
