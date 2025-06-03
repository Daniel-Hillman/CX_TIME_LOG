
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// Removed unused getAnalytics import

// Your web app's Firebase configuration FOR 'cx-time-log-fresh'
// IMPORTANT: Ensure these values are correct for your 'cx-time-log-fresh' project.
// Obtain them from your Firebase project settings (Project settings > General > Your apps > Web app).
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY_FOR_FRESH", // REPLACE THIS
  authDomain: "cx-time-log-fresh.firebaseapp.com",
  projectId: "cx-time-log-fresh",
  storageBucket: "cx-time-log-fresh.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID_FOR_FRESH", // REPLACE THIS
  appId: "YOUR_ACTUAL_APP_ID_FOR_FRESH", // REPLACE THIS
  measurementId: "YOUR_ACTUAL_MEASUREMENT_ID_FOR_FRESH" // REPLACE THIS (Optional)
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
