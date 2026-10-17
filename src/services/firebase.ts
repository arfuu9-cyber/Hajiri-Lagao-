import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';
​const firebaseConfig = {
apiKey: "AIzaSyDlUieTHySyPnQLr9e0RKoZOugSkjSTjzM",
authDomain: "hajiri-lagao.firebaseapp.com",
projectId: "hajiri-lagao",
storageBucket: "hajiri-lagao.firebasestorage.app",
messagingSenderId: "671231461511",
appId: "1:671231461511:web:a0116954c50d77d3d01022",
measurementId: "G-3HF2YJSFP8"
};
​let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
​export function getFirebaseAuth(): Auth {
if (!getApps().length) {
firebaseApp = initializeApp(firebaseConfig);
} else {
firebaseApp = getApps()[0];
}
​if (!firebaseAuth) {
firebaseAuth = getAuth(firebaseApp);
setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
// Persistence fallback
});
}
​return firebaseAuth;
}
​export { firebaseConfig };
