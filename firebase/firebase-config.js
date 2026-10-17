import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBoSgIK37V9GLwf7mnBXH29OrFKXKbP7v8",
    authDomain: "lazy-mochi.firebaseapp.com",
    projectId: "lazy-mochi",
    storageBucket: "lazy-mochi.firebasestorage.app",
    messagingSenderId: "344762257045",
    appId: "1:344762257045:web:09a426d617690405db959c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);