import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// These values now come from a .env file (see .env.example for the
// format), not hardcoded here. This keeps your real project keys out of
// GitHub entirely — .env is listed in .gitignore, so it never gets
// uploaded. Expo automatically loads any variable prefixed with
// EXPO_PUBLIC_ from .env at build time.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

// Billing and Firestore are already working on the real cloud project,
// so the emulator is switched off. Leave this as false.
const USE_EMULATOR = false;

if (USE_EMULATOR) {
  const HOST = "192.168.1.5";
  connectAuthEmulator(auth, `http://${HOST}:9099`);
  connectFirestoreEmulator(db, HOST, 8080);
}
