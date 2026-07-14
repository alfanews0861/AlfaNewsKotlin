package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.NewsPost
import com.alfanews.telugu.models.SurveyQuestion
import com.alfanews.telugu.models.SurveyOption
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.launch
import java.util.UUID
import androidx.compose.runtime.snapshots.SnapshotStateList

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostSurveyPageView(
    user: User,
    onActionComplete: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var headlineTe by remember { mutableStateOf("") }
    var headlineEn by remember { mutableStateOf("") }
    var contentTe by remember { mutableStateOf("") }
    var contentEn by remember { mutableStateOf("") }
    
    var isMultiPage by remember { mutableStateOf(false) }
    var isGlobal by remember { mutableStateOf(user.role == com.alfanews.telugu.models.UserRole.ADMIN) }
    var district by remember { mutableStateOf(user.district ?: "") }
    
    val questions = remember { 
        mutableStateListOf<MutableQuestionState>().apply {
            add(
                MutableQuestionState(
                    id = UUID.randomUUID().toString(),
                    questionText = "",
                    options = mutableStateListOf<MutableOptionState>().apply {
                        add(MutableOptionState(id = UUID.randomUUID().toString(), initialText = ""))
                        add(MutableOptionState(id = UUID.randomUUID().toString(), initialText = ""))
                    }
                )
            )
        }
    }

    var isSubmitting by remember { mutableStateOf(false) }
    var districtExpanded by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // General Info Card
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "సర్వే సాధారణ వివరాలు (General Info)",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 16.sp
                    )

                    OutlinedTextField(
                        value = headlineTe,
                        onValueChange = { headlineTe = it },
                        label = { Text("సర్వే శీర్షిక (Telugu Headline) *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = headlineEn,
                        onValueChange = { headlineEn = it },
                        label = { Text("Survey Title (English Headline)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = contentTe,
                        onValueChange = { contentTe = it },
                        label = { Text("సర్వే వివరాలు (Telugu Description) *") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )

                    OutlinedTextField(
                        value = contentEn,
                        onValueChange = { contentEn = it },
                        label = { Text("Survey Details (English Description)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )
                }
            }

            // Configurations Card
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "సర్వే కాన్ఫిగరేషన్ (Settings)",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 16.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "మల్టీ-పేజీ సర్వే (Multi-Page Survey)",
                            fontSize = 14.sp
                        )
                        Switch(
                            checked = isMultiPage,
                            onCheckedChange = { 
                                isMultiPage = it
                                if (!it && questions.size > 1) {
                                    while (questions.size > 1) {
                                        questions.removeAt(questions.size - 1)
                                    }
                                }
                            }
                        )
                    }

                    Divider()

                    if (user.role == com.alfanews.telugu.models.UserRole.ADMIN) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "రాష్ట్ర వ్యాప్తంగా చూపించు (Global / State News)",
                                fontSize = 14.sp
                            )
                            Switch(
                                checked = isGlobal,
                                onCheckedChange = { isGlobal = it }
                            )
                        }
                    } else {
                        Text(
                            text = "ఈ సర్వే మీ జిల్లా (${user.district}) లో మాత్రమే కనిపిస్తుంది.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 13.sp
                        )
                    }

                    if (!isGlobal) {
                        Box(modifier = Modifier.fillMaxWidth()) {
                            OutlinedTextField(
                                value = district,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("జిల్లా (District)") },
                                modifier = Modifier.fillMaxWidth(),
                                trailingIcon = {
                                    IconButton(onClick = { districtExpanded = true }) {
                                        Icon(Icons.Default.ArrowDropDown, contentDescription = "Select District")
                                    }
                                }
                            )
                            DropdownMenu(
                                expanded = districtExpanded,
                                onDismissRequest = { districtExpanded = false },
                                modifier = Modifier.fillMaxWidth(0.9f)
                            ) {
                                Constants.ALL_DISTRICTS.forEach { distName: String ->
                                    DropdownMenuItem(
                                        text = { Text(distName) },
                                        onClick = {
                                            district = distName
                                            districtExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Questions Card
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "సర్వే ప్రశ్నలు & సమాధానాలు",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 16.sp
                        )

                        if (isMultiPage) {
                            Button(
                                onClick = {
                                    questions.add(
                                        MutableQuestionState(
                                            id = UUID.randomUUID().toString(),
                                            questionText = "",
                                            options = mutableStateListOf<MutableOptionState>().apply {
                                                add(MutableOptionState(id = UUID.randomUUID().toString(), initialText = ""))
                                                add(MutableOptionState(id = UUID.randomUUID().toString(), initialText = ""))
                                            }
                                        )
                                    )
                                },
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Add Question", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("ప్రశ్నను జోడించు", fontSize = 12.sp)
                            }
                        }
                    }

                    questions.forEachIndexed { qIndex: Int, qState: MutableQuestionState ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "ప్రశ్న ${qIndex + 1}:",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )

                                if (isMultiPage && questions.size > 1) {
                                    IconButton(
                                        onClick = { questions.removeAt(qIndex) },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete Question", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }

                            OutlinedTextField(
                                value = qState.questionText,
                                onValueChange = { qState.questionText = it },
                                label = { Text("ప్రశ్న టెక్స్ట్ (Question Text) *") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )

                            Text(
                                text = "ఆప్షన్స్ (కనీసం 2):",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 4.dp)
                            )

                            qState.options.forEachIndexed { oIndex: Int, oState: MutableOptionState ->
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedTextField(
                                            value = oState.text,
                                            onValueChange = { oState.text = it },
                                            label = { Text("ఆప్షన్ ${oIndex + 1} *") },
                                            modifier = Modifier.weight(1f),
                                            singleLine = true
                                        )

                                        if (qState.options.size > 2) {
                                            IconButton(
                                                onClick = { qState.options.removeAt(oIndex) },
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.RemoveCircle,
                                                    contentDescription = "Remove Option",
                                                    tint = MaterialTheme.colorScheme.error
                                                )
                                            }
                                        }
                                    }

                                    if (isMultiPage) {
                                        var expandedNext by remember { mutableStateOf(false) }
                                        Box(modifier = Modifier.padding(start = 8.dp)) {
                                            val nextText = when (oState.nextQuestionId) {
                                                null -> "తదుపరి ప్రశ్న (Next Question)"
                                                "END" -> "సర్వే ముగించు (End Survey)"
                                                else -> {
                                                    val targetQ = questions.find { it.id == oState.nextQuestionId }
                                                    val qIdx = questions.indexOf(targetQ)
                                                    if (qIdx != -1) "ప్రశ్న ${qIdx + 1} కు వెళ్ళండి" else "ప్రశ్నను ఎంచుకోండి"
                                                }
                                            }

                                            TextButton(
                                                onClick = { expandedNext = true },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                                                modifier = Modifier.height(32.dp)
                                            ) {
                                                Text("తర్వాత: $nextText", fontSize = 12.sp)
                                                Icon(Icons.Default.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp))
                                            }

                                            DropdownMenu(
                                                expanded = expandedNext,
                                                onDismissRequest = { expandedNext = false }
                                            ) {
                                                DropdownMenuItem(
                                                    text = { Text("తదుపరి ప్రశ్న (Next Question)") },
                                                    onClick = {
                                                        oState.nextQuestionId = null
                                                        expandedNext = false
                                                    }
                                                )
                                                DropdownMenuItem(
                                                    text = { Text("సర్వే ముగించు (End Survey)") },
                                                    onClick = {
                                                        oState.nextQuestionId = "END"
                                                        expandedNext = false
                                                    }
                                                )
                                                questions.forEachIndexed { idx: Int, q: MutableQuestionState ->
                                                    if (q.id != qState.id) {
                                                        DropdownMenuItem(
                                                            text = { Text("ప్రశ్న ${idx + 1} కు వెళ్ళండి (${if (q.questionText.length > 20) q.questionText.take(20) + "..." else q.questionText})") },
                                                            onClick = {
                                                                oState.nextQuestionId = q.id
                                                                expandedNext = false
                                                            }
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if (qState.options.size < 6) {
                                TextButton(
                                    onClick = { 
                                        qState.options.add(MutableOptionState(id = UUID.randomUUID().toString(), initialText = "")) 
                                    },
                                    modifier = Modifier.align(Alignment.Start)
                                ) {
                                    Icon(Icons.Default.AddCircle, contentDescription = "Add Option", modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("ఆప్షన్ జోడించు", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }

            // Submit Button
            Button(
                onClick = {
                    if (headlineTe.isBlank() || contentTe.isBlank()) {
                        Toast.makeText(context, "శీర్షిక మరియు వివరాలు నింపండి.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (questions.any { it.questionText.isBlank() }) {
                        Toast.makeText(context, "అన్ని ప్రశ్నల టెక్స్ట్ నింపండి.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (questions.any { q: MutableQuestionState -> q.options.any { it.text.isBlank() } }) {
                        Toast.makeText(context, "అన్ని సమాధానాల (Options) టెక్స్ట్ నింపండి.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    isSubmitting = true
                    val surveyQuestionsList = questions.map { q: MutableQuestionState ->
                        mapOf(
                            "id" to q.id,
                            "questionText" to q.questionText,
                            "options" to q.options.map { o: MutableOptionState ->
                                mapOf(
                                    "id" to o.id, 
                                    "text" to o.text,
                                    "nextQuestionId" to o.nextQuestionId
                                )
                            }
                        )
                    }

                    val isStaff = listOf(UserRole.ADMIN, UserRole.EDITOR, UserRole.NEWS_DESK).contains(user.role)
                    val randomStartFakeVotes = 11000 + (100..900).random()

                    val surveyData = mapOf(
                        "headline" to mapOf(
                            "telugu" to headlineTe,
                            "english" to headlineEn
                        ),
                        "content" to mapOf(
                            "telugu" to contentTe,
                            "english" to contentEn
                        ),
                        "type" to "survey",
                        "approved" to isStaff,
                        "status" to if (isStaff) "PUBLISHED" else "PENDING",
                        "surveyQuestions" to surveyQuestionsList,
                        "isMultiPage" to isMultiPage,
                        "fakeVotesBase" to randomStartFakeVotes,
                        "surveyCreatedAt" to System.currentTimeMillis(),
                        "votes" to emptyMap<String, Int>(),
                        "realVotesCount" to 0,
                        "isGlobal" to isGlobal,
                        "district" to (if (isGlobal) "State" else district),
                        "location" to (user.assignedMandal ?: district),
                        "isReporter" to (user.role == com.alfanews.telugu.models.UserRole.REPORTER),
                        "reporter" to mapOf(
                            "id" to user.id,
                            "name" to user.name
                        ),
                        "timestamp" to FieldValue.serverTimestamp(),
                        "likes" to 0,
                        "comments" to 0,
                        "shares" to 0,
                        "categories" to listOf("సర్వే", if (isGlobal) "రాష్ట్రం" else district)
                    )

                    FirebaseService.db.collection("news")
                        .add(surveyData)
                        .addOnSuccessListener {
                            Toast.makeText(context, "సర్వే విజయవంతంగా పోస్ట్ చేయబడింది!", Toast.LENGTH_LONG).show()
                            onActionComplete()
                            isSubmitting = false
                        }
                        .addOnFailureListener { e ->
                            Toast.makeText(context, "సర్వే పోస్ట్ చేయడంలో లోపం: ${e.message}", Toast.LENGTH_LONG).show()
                            isSubmitting = false
                        }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                enabled = !isSubmitting
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                } else {
                    Text("పోస్ట్ చేయండి (Publish Survey)", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

// Helpers for mutable state management of questions and options in Compose
class MutableQuestionState(
    val id: String,
    questionText: String,
    val options: SnapshotStateList<MutableOptionState>
) {
    var questionText: String by mutableStateOf(questionText)
}

class MutableOptionState(
    val id: String,
    initialText: String,
    initialNextQuestionId: String? = null
) {
    var text: String by mutableStateOf(initialText)
    var nextQuestionId: String? by mutableStateOf(initialNextQuestionId)
}
