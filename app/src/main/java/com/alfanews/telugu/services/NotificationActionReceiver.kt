package com.alfanews.telugu.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * నోటిఫికేషన్ బటన్ల (ఉదా: షేర్) చర్యలను నిర్వహించే రిసీవర్.
 */
class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val title = intent.getStringExtra("title") ?: "AlfaNews"
        val body = intent.getStringExtra("body") ?: ""
        val url = intent.getStringExtra("url") ?: "https://play.google.com/store/apps/details?id=com.alfanews.telugu"

        if (action == "com.alfanews.telugu.ACTION_SHARE") {
            // షేర్ చేయడానికి ప్రత్యేకమైన షేర్ ఇంటెంట్
            val shareText = "$title\n\n$body\n\nపూర్తి వివరాల కోసం క్లిక్ చేయండి: $url\n\nAlfaNews యాప్ డౌన్లోడ్ చేసుకోండి: https://play.google.com/store/apps/details?id=com.alfanews.telugu"
            
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareText)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            val chooserIntent = Intent.createChooser(shareIntent, "వార్తను షేర్ చేయండి").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            try {
                context.startActivity(chooserIntent)
            } catch (e: Exception) {
                Log.e("NotificationReceiver", "Error starting share activity", e)
            }
        }
    }
}
