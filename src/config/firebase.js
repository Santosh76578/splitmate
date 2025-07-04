import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// Get these values from your Firebase Console:
// 1. Go to Project Settings (gear icon)
// 2. Scroll down to "Your apps"
// 3. Click on the web app icon (</>)
// 4. Register your app if you haven't already
// 5. Copy the configuration values below
const firebaseConfig = {
  apiKey: "AIzaSyDZxVOvV6KquJHrF5RqtllbbswntbEpb7s",
  authDomain: "splitmate-app-a304a.firebaseapp.com",
  projectId: "splitmate-app-a304a",
  storageBucket: "splitmate-app-a304a.firebasestorage.app",
  messagingSenderId: "703350531295",
  appId: "1:703350531295:web:da9851e076439b20f6756a"
};

// Initialize Firebase only if it hasn't been initialized
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const auth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

export { auth, db, storage, firebaseApp }; 