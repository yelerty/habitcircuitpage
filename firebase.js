// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, doc, updateDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// TODO: Replace with your Firebase project configuration
// Get this from Firebase Console -> Project Settings -> Your apps
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auto sign-in anonymously
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User signed in anonymously:', user.uid);
    } else {
        // Sign in anonymously
        signInAnonymously(auth).catch((error) => {
            console.error('Error signing in anonymously:', error);
        });
    }
});

// Export Firebase services
export { auth, db, currentUser };
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
