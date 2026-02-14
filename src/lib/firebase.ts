import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Analytics isn't supported in all environments (e.g. some browsers, SSR)
export const analytics = await (async () => {
  try {
    if (await analyticsIsSupported()) return getAnalytics(app);
  } catch {
    // ignore
  }
  return undefined;
})();
