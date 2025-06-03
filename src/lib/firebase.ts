
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// Removed unused getAnalytics import

// Replace with your actual Firebase configuration for 'cx-time-log-fresh'
const firebaseConfig = {
  // !!! IMPORTANT: YOU MUST REPLACE THE apiKey BELOW !!!
  // !!! Get this from your 'cx-time-log-fresh' project settings in the Firebase Console !!!
  apiKey: "AIzaSyCsFa7KggnpF86Jr11d35bmehbvmyLogu0", // <<< REPLACE THIS
  authDomain: "cx-time-log-fresh.firebaseapp.com", // Updated based on new projectId
  projectId: "cx-time-log-fresh", // <<< Updated to new project ID
  storageBucket: "cx-time-log-fresh.appspot.com", // Updated based on new projectId

  // !!! IMPORTANT: YOU MUST REPLACE THE messagingSenderId, appId, and measurementId BELOW !!!
  // !!! Get these from your 'cx-time-log-fresh' project settings in the Firebase Console !!!
  messagingSenderId: "524802105643", // <<< REPLACE THIS
  appId: "1:524802105643:web:8987ee74ea52488317656e", // <<< REPLACE THIS
  measurementId: "G-L9B5HQJ6DW" // <<< REPLACE THIS (if used)
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
