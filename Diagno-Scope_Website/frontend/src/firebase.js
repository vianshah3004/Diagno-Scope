import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC91SMrUTo1VVLIeHiKM7Tg-pov4nic-xc",
  authDomain: "diagnoscope-1e643.firebaseapp.com",
  projectId: "diagnoscope-1e643",
  storageBucket: "diagnoscope-1e643.firebasestorage.app",
  messagingSenderId: "339809693130",
  appId: "1:339809693130:web:41ddfaa08373166639b333",
  measurementId: "G-J62TGBV3PZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;