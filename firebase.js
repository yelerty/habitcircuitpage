// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, doc, updateDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// Firebase project configuration from GoogleService-Info.plist
const firebaseConfig = {
    apiKey: "AIzaSyCb5fr3bFsbDGncTUgLEEyy1yveJmfxkZg",
    authDomain: "routine-sharing.firebaseapp.com",
    projectId: "routine-sharing",
    storageBucket: "routine-sharing.firebasestorage.app",
    messagingSenderId: "74062182191",
    appId: "1:74062182191:web:418fd9bf8849b22fadd3da"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auto sign-in anonymously
let currentUser = null;
let authInitialized = false;
const authReadyPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            authInitialized = true;
            console.log('✅ User signed in anonymously:', user.uid);
            resolve(user);
        } else {
            // Sign in anonymously
            console.log('🔄 Attempting anonymous sign-in...');
            try {
                const result = await signInAnonymously(auth);
                currentUser = result.user;
                authInitialized = true;
                console.log('✅ Anonymous sign-in successful:', result.user.uid);
                resolve(result.user);
            } catch (error) {
                console.error('❌ Error signing in anonymously:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                // Try to resolve anyway to prevent hanging
                resolve(null);
            }
        }
    });
});

// Export Firebase services
export { auth, db, currentUser, authReadyPromise, authInitialized };
export {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    doc,
    updateDoc,
    increment,
    serverTimestamp
};
