import { initializeApp } from "firebase/app";
import { isSupported as analyticsIsSupported } from "firebase/analytics";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAo635pLShsyf0VbS0ApvfTeLnh6yQnao0",
  authDomain: "hardyhub-7b30d.firebaseapp.com",
  projectId: "hardyhub-7b30d",
  storageBucket: "hardyhub-7b30d.firebasestorage.app",
  messagingSenderId: "1091933059563",
  appId: "1:1091933059563:web:88a262227dcaa9247dc1ae",
  measurementId: "G-J447ZW2Q63",
};

export const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Opt-in only: production and ordinary development keep using live Firebase.
// This makes real browser workflow tests possible without touching live data.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

// Analytics isn't supported in all environments (and requires top-level await if we try
// to auto-detect support at module load). We expose a helper instead.
export async function getAnalyticsIfSupported() {
  try {
    if (!(await analyticsIsSupported())) return undefined;
    const { getAnalytics } = await import("firebase/analytics");
    return getAnalytics(app);
  } catch {
    return undefined;
  }
}

// Messaging is not supported in all environments (e.g. Safari without permission, Node).
// Returns the messaging instance if supported, null otherwise.
export async function getMessagingIfSupported() {
  try {
    const { isSupported, getMessaging } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}
