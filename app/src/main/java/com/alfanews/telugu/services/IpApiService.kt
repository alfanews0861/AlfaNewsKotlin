package com.alfanews.telugu.services

import com.google.gson.annotations.SerializedName
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET

data class IpInfo(
    @SerializedName("regionName") val regionName: String?,
    @SerializedName("city") val city: String?,
    @SerializedName("countryCode") val countryCode: String?
)

interface IpApiService {
    @GET("/json")
    suspend fun getIpInfo(): IpInfo
}

object IpApi {
    private const val BASE_URL = "http://ip-api.com/"

    val retrofitService: IpApiService by lazy {
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        retrofit.create(IpApiService::class.java)
    }
}
