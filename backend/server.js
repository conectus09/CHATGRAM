const express = require("express");
const path = require("path");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// ── FIREBASE INIT ──
// Render pe Environment Variable mein paste karna: FIREBASE_SERVICE_ACCOUNT
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Agar Realtime Database use kar rahe ho to:
  // databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore(); // Firestore use ho raha hai

// ── MIDDLEWARE ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files serve karo (index.html, bumpy.html, etc.)
app.use(express.static(path.join(__dirname, "public")));

// ── ROUTES ──

// Health check — Render ke liye zaroori
app.get("/health", (req, res) => {
  res.status(200).json({ status: "BUMPY server is running 🚀" });
});

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── API: USER SAVE (Google login ke baad) ──
app.post("/api/user", async (req, res) => {
  try {
    const { uid, name, email, photo } = req.body;
    if (!uid) return res.status(400).json({ error: "UID required" });

    await db.collection("users").doc(uid).set({
      name,
      email,
      photo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({ message: "User saved ✅" });
  } catch (err) {
    console.error("User save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── API: MESSAGE SEND ──
app.post("/api/message", async (req, res) => {
  try {
    const { senderId, receiverId, text } = req.body;
    if (!senderId || !receiverId || !text) {
      return res.status(400).json({ error: "senderId, receiverId, text required" });
    }

    const msgRef = await db.collection("messages").add({
      senderId,
      receiverId,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Message sent ✅", id: msgRef.id });
  } catch (err) {
    console.error("Message send error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── API: GET MESSAGES between 2 users ──
app.get("/api/messages/:userId1/:userId2", async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    const snapshot = await db.collection("messages")
      .where("senderId", "in", [userId1, userId2])
      .orderBy("timestamp", "asc")
      .limit(100)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only messages between these 2 users
      if (
        (data.senderId === userId1 && data.receiverId === userId2) ||
        (data.senderId === userId2 && data.receiverId === userId1)
      ) {
        messages.push({ id: doc.id, ...data });
      }
    });

    res.status(200).json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── API: GET ALL USERS (contacts list ke liye) ──
app.get("/api/users", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── 404 fallback ──
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── START SERVER ──
app.listen(PORT, () => {
  console.log(`✅ BUMPY server running on port ${PORT}`);
});
