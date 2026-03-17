/* =========================================
   CHATGRAM PRO SERVER (UPGRADED)
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
   HELPER FUNCTIONS
========================================= */

// MATCH USERS
function matchUsers(socket) {

    // remove self if exists
    queue.delete(socket.id);

    if (queue.size > 0) {

        const partnerId = queue.values().next().value;
        queue.delete(partnerId);

        users.set(socket.id, partnerId);
        users.set(partnerId, socket.id);

        io.to(socket.id).emit("matched", {
            name: userNames.get(partnerId)
        });

        io.to(partnerId).emit("matched", {
            name: userNames.get(socket.id)
        });

        console.log("✅ Matched:", socket.id, "<->", partnerId);

    } else {

        queue.add(socket.id);
        socket.emit("waiting");

        console.log("⏳ Waiting:", socket.id);
    }
}

// CLEAN DISCONNECT
function cleanUser(socket) {

    const partner = users.get(socket.id);

    if (partner) {
        io.to(partner).emit("stranger-disconnected");

        users.delete(partner);
        users.delete(socket.id);
    }

    queue.delete(socket.id);
    userNames.delete(socket.id);
}

/* =========================================
   SOCKET CONNECTION
========================================= */

io.on("connection", (socket) => {

    console.log("🟢 Connected:", socket.id);

    // SEND ONLINE COUNT
    io.emit("online-users", io.engine.clientsCount);

    /* =========================================
       START CHAT
    ========================================= */

    socket.on("start", ({ name }) => {

        const safeName = name || "Stranger";
        userNames.set(socket.id, safeName);

        console.log("🔍 Searching:", safeName);

        matchUsers(socket);
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
            matchUsers(socket);
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
