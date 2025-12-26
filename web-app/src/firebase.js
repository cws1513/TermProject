import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCSP00TRTD7LropAr18KVQzBqwCqDv69lo",
    authDomain: "todo-calendar-app-dc2d8.firebaseapp.com",
    projectId: "todo-calendar-app-dc2d8",
    storageBucket: "todo-calendar-app-dc2d8.firebasestorage.app",
    messagingSenderId: "377490408598",
    appId: "1:377490408598:web:82376d0eeae5ce25f12eb7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();