import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Yaha apna Firebase config dalo
const firebaseConfig = {
  apiKey: "AIzaSyAkyuA8xY3LyBdNn9_l9aniAfJ7fjMS__0",
  authDomain: "bumpy-c0feb.firebaseapp.com",
  projectId: "bumpy-c0feb",
  storageBucket: "bumpy-c0feb.firebasestorage.app",
  messagingSenderId: "1007047112567",
  appId: "1:1007047112567:web:a14858e9d4c2d6de579372"
};

// Firebase initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// HTML elements
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusMessage = document.getElementById("statusMessage");
const userCard = document.getElementById("userCard");
const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");

// Google login
googleLoginBtn.addEventListener("click", async () => {
  try {
    statusMessage.textContent = "Signing in...";
    await signInWithPopup(auth, provider);
    statusMessage.textContent = "Login successful";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Login failed: " + error.message;
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    statusMessage.textContent = "Logged out";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Logout failed: " + error.message;
  }
});

// User state check
onAuthStateChanged(auth, (user) => {
  if (user) {
    userCard.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    googleLoginBtn.classList.add("hidden");

    userPhoto.src = user.photoURL || "logo.jpg";
    userName.textContent = user.displayName || "QuickChat User";
    userEmail.textContent = user.email || "No Email";
    statusMessage.textContent = "Signed in successfully";
  } else {
    userCard.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    googleLoginBtn.classList.remove("hidden");

    userPhoto.src = "";
    userName.textContent = "";
    userEmail.textContent = "";
    statusMessage.textContent = "Not signed in";
  }
});
