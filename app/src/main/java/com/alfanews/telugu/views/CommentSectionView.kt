package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.services.FirebaseService
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Query
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.alfanews.telugu.utils.DateTimeUtils
import java.util.*
import java.util.*

data class Comment(
    val id: String,
    val userId: String,
    val userName: String,
    val userPhoto: String?,
    val text: String,
    val timestamp: Long
)

@Composable
fun CommentSectionView(
    postId: String,
    initialCommentCount: Int,
    currentUser: User?,
    onClose: () -> Unit,
    onCommentPosted: () -> Unit,
    onLoginRequest: () -> Unit
) {
    val viewModel: CommentViewModel = remember { CommentViewModel(postId) }
    val comments by viewModel.comments.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var newComment by remember { mutableStateOf("") }
    var isPosting by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()

    LaunchedEffect(comments.size) {
        if (comments.isNotEmpty()) {
            kotlinx.coroutines.delay(100)
            listState.animateScrollToItem(comments.size - 1)
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.8f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = LocalIndication.current
                ) { onClose() }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.8f)
                    .align(Alignment.BottomCenter)
                    .background(Color(0xFF1A1A1A))
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        enabled = false
                    ) {}
            ) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "వ్యాఖ్యలు",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    IconButton(onClick = onClose) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.Gray
                        )
                    }
                }

                Divider(color = Color.Gray.copy(alpha = 0.3f))

                // Comments List
                if (isLoading && comments.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                } else if (comments.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "ఇంకా వ్యాఖ్యలు లేవు. మీరే మొదట స్పందించండి!",
                            color = Color.Gray,
                            fontSize = 16.sp
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(comments) { comment ->
                            CommentItem(comment = comment)
                        }
                    }
                }

                Divider(color = Color.Gray.copy(alpha = 0.3f))

                // Input Form
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AsyncImage(
                        model = currentUser?.photoUrl ?: "https://ui-avatars.com/api/?name=${if (currentUser != null) currentUser.name else "Guest"}&background=random",
                        contentDescription = "User",
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )

                    OutlinedTextField(
                        value = newComment,
                        onValueChange = {
                            if (currentUser != null) {
                                newComment = it
                            } else {
                                onLoginRequest()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(
                                text = if (currentUser != null) "మీ అభిప్రాయాన్ని రాయండి..." else "వ్యాఖ్యానించడానికి లాగిన్ అవ్వండి...",
                                color = Color.Gray
                            )
                        },
                        readOnly = currentUser == null,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = MaterialTheme.colorScheme.error,
                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(24.dp),
                        singleLine = true
                    )

                    IconButton(
                        onClick = {
                            if (newComment.trim().isNotEmpty() && currentUser != null && !isPosting) {
                                isPosting = true
                                viewModel.postComment(
                                    text = newComment.trim(),
                                    userId = currentUser.id,
                                    userName = currentUser.name,
                                    userPhoto = currentUser.photoUrl
                                ) {
                                    newComment = ""
                                    isPosting = false
                                    onCommentPosted()
                                }
                            }
                        },
                        enabled = newComment.trim().isNotEmpty() && currentUser != null && !isPosting
                    ) {
                        if (isPosting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.error,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Send",
                                tint = if (newComment.trim().isNotEmpty() && currentUser != null)
                                    MaterialTheme.colorScheme.error else Color.Gray
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CommentItem(comment: Comment) {
    val formattedTime = DateTimeUtils.formatTimestamp(comment.timestamp, "hh:mm a • dd MMM", Locale("en", "IN"))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        AsyncImage(
            model = comment.userPhoto ?: "https://ui-avatars.com/api/?name=${comment.userName}&background=random",
            contentDescription = comment.userName,
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape),
            contentScale = ContentScale.Crop
        )

        Column(modifier = Modifier.weight(1f)) {
            Box(
                modifier = Modifier
                    .background(Color(0xFF2A2A2A), RoundedCornerShape(16.dp))
                    .padding(12.dp)
            ) {
                Column {
                    Text(
                        text = comment.userName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = comment.text,
                        fontSize = 15.sp,
                        color = Color.White
                    )
                }
            }
            Text(
                text = formattedTime,
                fontSize = 10.sp,
                color = Color.Gray,
                modifier = Modifier.padding(start = 8.dp, top = 4.dp)
            )
        }
    }
}

class CommentViewModel(private val postId: String) : ViewModel() {
    private val _comments = MutableStateFlow<List<Comment>>(emptyList())
    val comments: StateFlow<List<Comment>> = _comments.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var listenerRegistration: com.google.firebase.firestore.ListenerRegistration? = null

    init {
        loadComments(postId)
    }

    private fun loadComments(postId: String) {
        _isLoading.value = true
        val commentsRef = FirebaseService.db
            .collection("news")
            .document(postId)
            .collection("comments")
            .orderBy("timestamp", Query.Direction.ASCENDING)

        listenerRegistration = commentsRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                _isLoading.value = false
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val loadedComments = snapshot.documents.mapNotNull { doc ->
                    try {
                        val data = doc.data ?: return@mapNotNull null
                        Comment(
                            id = doc.id,
                            userId = data["userId"] as? String ?: "",
                            userName = data["userName"] as? String ?: "",
                            userPhoto = data["userPhoto"] as? String,
                            text = data["text"] as? String ?: "",
                            timestamp = (data["timestamp"] as? com.google.firebase.Timestamp)?.toDate()?.time
                                ?: (data["timestamp"] as? Long) ?: System.currentTimeMillis()
                        )
                    } catch (e: Exception) {
                        null
                    }
                }
                _comments.value = loadedComments
                _isLoading.value = false
            }
        }
    }

    fun postComment(
        text: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        onComplete: () -> Unit
    ) {
        viewModelScope.launch {
            try {
                FirebaseService.db
                    .collection("news")
                    .document(postId)
                    .collection("comments")
                    .add(
                        hashMapOf(
                            "text" to text,
                            "userId" to userId,
                            "userName" to userName,
                            "userPhoto" to (userPhoto ?: ""),
                            "timestamp" to FieldValue.serverTimestamp()
                        )
                    )
                    .await()

                FirebaseService.db
                    .collection("news")
                    .document(postId)
                    .update("comments", FieldValue.increment(1))
                    .await()

                onComplete()
            } catch (e: Exception) {
                onComplete()
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        listenerRegistration?.remove()
    }
}
