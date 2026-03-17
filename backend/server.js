/* =========================================
   CHATGRAM PRO SERVER (FINAL CLEAN VERSION)
========================================= */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

/* =========================================
   APP INIT
========================================= */

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

/* =========================================
   MIDDLEWARE
========================================= */

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* =========================================
   DATA STRUCTURES
========================================= */

// waiting users (queue)
let queue = new Set();

// active pairs
let users = new Map(); // socketId -> partnerId

// user names
let userNames = new Map();

/* =========================================
   MATCHING SYSTEM
========================================= */

function processQueue() {

    while (queue.size >= 2) {

        const ids = Array.from(queue);

        const user1 = ids[0];
        const user2 = ids[1];

        const socket1 = io.sockets.sockets.get(user1);
        const socket2 = io.sockets.sockets.get(user2);

        // ghost fix
        if (!socket1 || !socket2) {
            queue.delete(user1);
            queue.delete(user2);
            continue;
        }

        // remove from queue
        queue.delete(user1);
        queue.delete(user2);

        // pair them
        users.set(user1, user2);
        users.set(user2, user1);

        console.log("🔥 MATCHED:", user1, "<->", user2);

        // send matched event
        socket1.emit("matched", {
            name: userNames.get(user2) || "Stranger"
        });

        socket2.emit("matched", {
            name: userNames.get(user1) || "Stranger"
        });
    }
}

/* =========================================
   CLEAN USER (DISCONNECT / NEXT)
========================================= */

function cleanUser(socket) {

    const partnerId = users.get(socket.id);

    if (partnerId) {

        const partnerSocket = io.sockets.sockets.get(partnerId);

        if (partnerSocket) {

            console.log("⚠️ Notifying partner disconnect:", partnerId);

            partnerSocket.emit("stranger-disconnected");

            // remove partner mapping
            users.delete(partnerId);

            // put partner back in queue
            queue.add(partnerId);

            partnerSocket.emit("waiting");
        }

        users.delete(socket.id);
    }

    // remove from queue
    queue.delete(socket.id);

    // remove name
    userNames.delete(socket.id);
}

/* =========================================
   SOCKET CONNECTION
========================================= */

io.on("connection", (socket) => {

    console.log("🟢 Connected:", socket.id);

    io.emit("onlineUsers", io.engine.clientsCount);

    /* =========================================
       START CHAT
    ========================================= */

    socket.on("start", ({ name }) => {

        if (queue.has(socket.id)) return;

        const safeName = name || "Stranger";

        userNames.set(socket.id, safeName);

        console.log("🔍 Searching:", safeName);

        queue.add(socket.id);

        socket.emit("waiting");

        processQueue();
    });

    /* =========================================
       MESSAGE (FIXED)
    ========================================= */

    socket.on("message", (msg) => {

        const partnerId = users.get(socket.id);

        if (!partnerId) return;

        const partnerSocket = io.sockets.sockets.get(partnerId);

        if (!partnerSocket) return;

        partnerSocket.emit("message", {
            text: msg.text,
            time: msg.time || Date.now()
        });
    });

    /* =========================================
       TYPING
    ========================================= */

    socket.on("typing", () => {

        const partnerId = users.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("typing");
        }
    });

    socket.on("stop-typing", () => {

        const partnerId = users.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("stop-typing");
        }
    });

    /* =========================================
       NEXT / SKIP
    ========================================= */

    socket.on("next", () => {

        console.log("⏭️ Next:", socket.id);

        cleanUser(socket);

        // re-add to queue instantly
        queue.add(socket.id);

        socket.emit("waiting");

        processQueue();
    });

    /* =========================================
       WEBRTC SIGNALING
    ========================================= */

    socket.on("offer", (offer) => {

        const partnerId = users.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("offer", offer);
        }
    });

    socket.on("answer", (answer) => {

        const partnerId = users.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("answer", answer);
        }
    });

    socket.on("ice", (candidate) => {

        const partnerId = users.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("ice", candidate);
        }
    });

    /* =========================================
       DISCONNECT
    ========================================= */

    socket.on("disconnect", () => {

        console.log("🔴 Disconnected:", socket.id);

        cleanUser(socket);

        io.emit("onlineUsers", io.engine.clientsCount);
    });

    /* =========================================
       PING CHECK
    ========================================= */

    socket.on("ping-check", () => {
        socket.emit("pong-check");
    });

    /* =========================================
       ERROR HANDLING
    ========================================= */

    socket.on("error", (err) => {
        console.log("⚠️ Socket error:", err);
    });

});

/* =========================================
   START SERVER
========================================= */

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log("🚀 CHATGRAM PRO running on port:", PORT);
});
