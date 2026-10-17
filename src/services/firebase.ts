import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSy...", // Yahan apni Firebase Console wali exact API key daal de
  authDomain: "hajiri-lagao.firebaseapp.com",
  projectId: "hajiri-lagao",
  storageBucket: "hajiri-lagao.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;

export function getFirebaseAuth(): Auth {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }

  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp);
    setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
      // Persistence fallback
    });
  }

  return firebaseAuth;
}

export { firebaseConfig };
