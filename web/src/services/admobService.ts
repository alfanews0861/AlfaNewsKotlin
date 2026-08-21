
// This service is now a placeholder.
// Since the app is running in a Native WebView without Capacitor plugins,
// we disabled the AdMob calls to prevent build/runtime errors.
// Native ads should be handled by the Android Java/Kotlin layer if needed.

export const initialize = async (): Promise<void> => {
    console.log('AdMob: Disabled (Native WebView Mode).');
    return Promise.resolve();
};

export const prepareInterstitialAd = async (): Promise<void> => {
    console.log('AdMob: Interstitial prep skipped.');
    return Promise.resolve();
};

export const showInterstitialAd = async (): Promise<void> => {
    console.log('AdMob: Interstitial show skipped.');
    return Promise.resolve();
};

export const getBannerAdUnitId = () => '';
