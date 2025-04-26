import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsFa7KggnpF86Jr11d35bmehbvmyLogu0",
  authDomain: "cx-time-log-v5.firebaseapp.com",
  projectId: "cx-time-log-v5",
  storageBucket: "cx-time-log-v5.firebasestorage.app",
  messagingSenderId: "524802105643",
  appId: "1:524802105643:web:8987ee74ea52488317656e",
  measurementId: "G-L9B5HQJ6DW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };