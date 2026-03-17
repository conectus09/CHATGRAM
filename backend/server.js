/* =========================================
   CHATGRAM PRO SERVER (FIXED VERSION)
========================================= */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

/* ========================================= */

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

/* ========================================= */

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* =========================================
   DATA STRUCTURES
========================================= */

let queue = new Set();           // waiting users
let users = new Map();           // socketId -> partnerId
let userNames = new Map();       // socketId -> name

/* =========================================
   MATCHING SYSTEM (FIXED)
========================================= */

function processQueue() {

    while (queue.size >= 2) {

        const ids = Array.from(queue);

        const user1 = ids[0];
        const user2 = ids[1];

        // check if sockets still exist (ghost fix)
        if (!io.sockets.sockets.get(user1) || !io.sockets.sockets.get(user2)) {
            queue.delete(user1);
            queue.delete(user2);
            continue;
        }

        queue.delete(user1);
        queue.delete(user2);

        users.set(user1, user2);
        users.set(user2, user1);

        io.to(user1).emit("matched", {
            name: userNames.get(user2) || "Stranger"
        });

        io.to(user2).emit("matched", {
            name: userNames.get(user1) || "Stranger"
        });

        console.log("✅ Matched:", user1, "<->", user2);
    }
}

/* =========================================
   CLEAN USER
========================================= */

function cleanUser(socket) {

    const partner = users.get(socket.id);

    if (partner) {
        io.to(partner).emit("stranger-disconnected");

        users.delete(partner);
        users.delete(socket.id);

        // partner ko queue me daal do (optional but useful)
        queue.add(partner);
        io.to(partner).emit("waiting");
    }

    queue.delete(socket.id);
    userNames.delete(socket.id);
}

/* =========================================
   SOCKET CONNECTION
========================================= */

io.on("connection", (socket) => {

    console.log("🟢 Connected:", socket.id);

    io.emit("online-users", io.engine.clientsCount);

    /* =========================================
       START CHAT
    ========================================= */

    socket.on("start", ({ name }) => {

        const safeName = name || "Stranger";
        userNames.set(socket.id, safeName);

        console.log("🔍 Searching:", safeName);

        queue.add(socket.id);
        socket.emit("waiting");

        processQueue(); // 🔥 match instantly
    });

    /* =========================================
       MESSAGE
    ========================================= */

    socket.on("message", (msg) => {

        const partner = users.get(socket.id);

        if (partner) {
            io.to(partner).emit("message", {
                text: msg,
                time: new Date().toLocaleTimeString(),
                sender: userNames.get(socket.id)
            });
        }
    });

    /* =========================================
       TYPING
    ========================================= */

    socket.on("typing", () => {
        const partner = users.get(socket.id);
        if (partner) io.to(partner).emit("typing");
    });

    socket.on("stop-typing", () => {
        const partner = users.get(socket.id);
        if (partner) io.to(partner).emit("stop-typing");
    });

    /* =========================================
       NEXT / SKIP
    ========================================= */

    socket.on("next", () => {

        cleanUser(socket);

        setTimeout(() => {
            queue.add(socket.id);
            socket.emit("waiting");
            processQueue();
        }, 300);
    });

    /* =========================================
       WEBRTC SIGNALING
    ========================================= */

    socket.on("offer", (offer) => {
        const partner = users.get(socket.id);
        if (partner) io.to(partner).emit("offer", offer);
    });

    socket.on("answer", (answer) => {
        const partner = users.get(socket.id);
        if (partner) io.to(partner).emit("answer", answer);
    });

    socket.on("ice", (candidate) => {
        const partner = users.get(socket.id);
        if (partner) io.to(partner).emit("ice", candidate);
    });

    /* =========================================
       DISCONNECT
    ========================================= */

    socket.on("disconnect", () => {

        console.log("🔴 Disconnected:", socket.id);

        cleanUser(socket);

        io.emit("online-users", io.engine.clientsCount);
    });

});

/* =========================================
   START SERVER
========================================= */

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log("🚀 CHATGRAM PRO running on port:", PORT);
});
