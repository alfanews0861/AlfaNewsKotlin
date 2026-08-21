
import * as _app from "firebase/app";
import * as _auth from "firebase/auth";
import * as _firestore from "firebase/firestore";
import * as _storage from "firebase/storage";
import * as _analytics from "firebase/analytics";
import * as _appCheck from "firebase/app-check";

const { initializeApp } = _app as any;
const { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } = _auth as any;
const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } = _firestore as any;
const { getStorage } = _storage as any;
const { getAnalytics } = _analytics as any;
const { initializeAppCheck, ReCaptchaV3Provider } = _appCheck as any;

const firebaseConfig = {
  apiKey: "AIzaSyA-tbQSwOlQvwJTQz9nKH-Fo8pI0ZLTW8c",
  authDomain: "alfa-news-31bf7.firebaseapp.com",
  projectId: "alfa-news-31bf7",
  storageBucket: "alfa-news-31bf7.firebasestorage.app",
  messagingSenderId: "930598073690",
  appId: "1:930598073690:web:d8e361bf98e422ace92f63",
  measurementId: "G-34LV8XBEBS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

if (typeof window !== 'undefined' && setPersistence && browserLocalPersistence) {
    setPersistence(auth, browserLocalPersistence)
        .catch((error: any) => console.warn("Persistence error:", error));
}

const { getFirestore } = _firestore as any;
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let analytics: any = null;
if (typeof window !== 'undefined') {
    try {
        analytics = getAnalytics(app);
    } catch (e) {}
}

// App Check removed due to ReCAPTCHA errors on preview domains
// if (typeof window !== 'undefined') {
//   const SITE_KEY = '6LfS6S8sAAAAABgwxnrqHRmll_hLi2FSDNt2xVHm'; 
//   try {
//     initializeAppCheck(app, {
//       provider: new ReCaptchaV3Provider(SITE_KEY), 
//       isTokenAutoRefreshEnabled: true
//     });
//     console.log("App Check active.");
//   } catch (e) {
//     console.warn("App Check initialization failed - continuing without enforcement.");
//   }
// }

export { app, auth, db, storage, googleProvider, analytics };
