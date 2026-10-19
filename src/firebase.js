import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  runTransaction
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
 * Uses the dynamic authenticated secret from admin decryption
 */
export async function saveTournamentToFirestore(data, customSecret) {
  try {
    const docRef = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    const codeToSend = customSecret || '';
    await setDoc(docRef, {
      ...data,
      secretCode: codeToSend,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.warn("Firestore save error (using local storage fallback):", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atomic Transaction for Multi-Admin Concurrency
 * Ensures simultaneous modifications by different admins never overwrite or intersect each other.
 */
export async function atomicUpdateTournamentInFirestore(patchOrUpdateFn, customSecret) {
  try {
    const docRef = doc(db, "tournaments", TOURNAMENT_DOC_ID);
    const codeToSend = customSecret || '';

    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      let currentData = {};
      if (sfDoc.exists()) {
        currentData = sfDoc.data() || {};
      }

      const patch = typeof patchOrUpdateFn === 'function' ? patchOrUpdateFn(currentData) : patchOrUpdateFn;

      transaction.set(docRef, {
        ...currentData,
        ...patch,
        secretCode: codeToSend,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    return { success: true };
  } catch (error) {
    console.warn("Firestore atomic transaction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atomically update specific matches in Firestore
 * Merges updated matches into the latest cloud array so other admins' changes are preserved.
 */
export async function atomicUpdateMatchesInFirestore(updatedMatchesList, customSecret) {
  return atomicUpdateTournamentInFirestore((latest) => {
    const cloudMatches = latest.matches || [];
    const lookup = {};
    updatedMatchesList.forEach(m => { lookup[m.id] = m; });

    let mergedMatches = [];
    if (cloudMatches.length > 0) {
      mergedMatches = cloudMatches.map(cm => lookup[cm.id] ? { ...cm, ...lookup[cm.id] } : cm);
      // Append any new matches not previously in cloud
      const cloudIds = new Set(cloudMatches.map(m => m.id));
      updatedMatchesList.forEach(m => {
        if (!cloudIds.has(m.id)) mergedMatches.push(m);
      });
    } else {
      mergedMatches = updatedMatchesList;
    }

    return { matches: mergedMatches };
  }, customSecret);
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
