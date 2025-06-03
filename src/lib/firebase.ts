
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// Removed unused getAnalytics import

// Your web app's Firebase configuration FOR 'cx-time-log-fresh'
// IMPORTANT: Ensure these values are correct for your 'cx-time-log-fresh' project.
// Obtain them from your Firebase project settings (Project settings > General > Your apps > Web app).
const firebaseConfig = {
  apiKey: "AIzaSyAlwq36m9uk-WLJuWLHX0PBEXdLBKo1pzU",
  authDomain: "cx-time-log-fresh.firebaseapp.com",
  projectId: "cx-time-log-fresh",
  storageBucket: "cx-time-log-fresh.firebasestorage.app",
  messagingSenderId: "798718084250",
  appId: "1:798718084250:web:b5ffcc487ff25a468a8b23",
  measurementId: "G-584SNNKTTP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

// If you were using Analytics and want to keep it:
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

export { db, auth };
