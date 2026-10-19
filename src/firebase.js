import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from "firebase/firestore";

// Firebase credentials for fc27cup
export const defaultFirebaseConfig = {
  apiKey: "AIzaSyDNOXkaBg5AzsluC2gAIbq41K1jMB-h_Ps",
  authDomain: "fc27cup.firebaseapp.com",
  projectId: "fc27cup",
  storageBucket: "fc27cup.firebasestorage.app",
  messagingSenderId: "257438986331",
  appId: "1:257438986331:web:6a88ba03e087ce757ccf7e"
};

// Initialize App
const app = getApps().length === 0 ? initializeApp(defaultFirebaseConfig) : getApp();
export const db = getFirestore(app);

// Tournament Document ID
export const TOURNAMENT_DOC_ID = "ksu_housing_fc27_main";

/**
 * Save full tournament state to Firestore
 */
export async function saveTournamentToFirestore(data) {
  try {
    const docRef = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.warn("Firestore save error (using local storage fallback):", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load tournament state from Firestore
 */
export async function loadTournamentFromFirestore() {
  try {
    const docRef = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    console.warn("Firestore load error:", error);
    return null;
  }
}

/**
 * Subscribe to realtime tournament updates from Firestore
 */
export function subscribeToTournament(onUpdate, onError) {
  try {
    const docRef = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    }, (err) => {
      console.warn("Firestore realtime error:", err);
      if (onError) onError(err);
    });
  } catch (error) {
    console.warn("Firestore subscribe exception:", error);
    if (onError) onError(error);
    return () => {};
  }
}
