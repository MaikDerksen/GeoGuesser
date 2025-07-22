
import { initializeApp, getApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDLm1o7egrh_Z8J_rXiLyOz_OBIIG-6OI4",
  authDomain: "geocompass-l29mm.firebaseapp.com",
  projectId: "geocompass-l29mm",
  storageBucket: "geocompass-l29mm.appspot.com",
  messagingSenderId: "135978667752",
  appId: "1:135978667752:web:7c7b74d3e4f6a1d769835d"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };
