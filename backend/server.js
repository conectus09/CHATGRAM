const express = require("express");
const path = require("path");
const admin = require("firebase-admin");
const app = express();
const PORT = process.env.PORT || 3000;
// ── FIREBASE INIT (SAFE) ──
let serviceAccount;
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
  process.exit(1);
}
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT JSON");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
// ── MIDDLEWARE ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Static files (frontend) ✅ FIXED
app.use(express.static(path.join(__dirname, "../public")));
// ── ROUTES ──
// Health check (Render ke liye important)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server running 🚀" });
});
// Home page ✅ FIXED
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});
// ── API: SAVE USER (Google Login ke baad) ──
app.post("/api/user", async (req, res) => {
  try {
    const { uid, name, email, photo } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "UID required" });
    }
    await db.collection("users").doc(uid).set(
      {
        name: name || "",
        email: email || "",
        photo: photo || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.status(200).json({ message: "User saved ✅" });
  } catch (err) {
    console.error("User save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ── GET ALL USERS (optional for testing) ──
app.get("/api/users", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
// ── START SERVER ──
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
