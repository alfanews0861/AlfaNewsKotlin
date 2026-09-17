package com.alfanews.telugu.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * ఇంటర్నెట్ కనెక్టివిటీని తనిఖీ చేయడానికి ఉపయోగించే యుటిలిటీ.
 */
object NetworkUtils {
    /**
     * ఇంటర్నెట్ అందుబాటులో ఉందో లేదో తనిఖీ చేస్తుంది.
     */
    fun isOnline(context: Context): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        val hasTransport = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        return hasTransport && hasInternet
    }
}
