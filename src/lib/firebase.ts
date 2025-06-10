import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Helper to read environment variables with a clear error message if missing
const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
};

// Firebase configuration pulled from environment variables
const firebaseConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// If you were using Analytics and want to keep it:
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

export { db, auth, storage };
