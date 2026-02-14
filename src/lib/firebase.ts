import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

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
export const analytics = getAnalytics(app);
