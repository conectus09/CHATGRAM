/* =========================================
   CHATGRAM RANDOM CHAT SERVER (FINAL)
   ========================================= */

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const path = require("path")

/* =========================================
   EXPRESS APP
   ========================================= */

const app = express()
const server = http.createServer(app)

/* =========================================
   SOCKET.IO
   ========================================= */

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

/* =========================================
   MIDDLEWARE
   ========================================= */

app.use(cors())
app.use(express.json())

/* =========================================
   SERVE FRONTEND
   ========================================= */

app.use(express.static(path.join(__dirname, "../public")))

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"))
})

/* =========================================
   GLOBAL VARIABLES
   ========================================= */

let queue = []              // waiting users
let users = {}              // active pairs
let userList = []           // sidebar users
let onlineUsers = 0

/* =========================================
   SOCKET CONNECTION
   ========================================= */

io.on("connection", (socket) => {

    console.log("🟢 User connected:", socket.id)

    /* =========================================
       ONLINE USERS
       ========================================= */

    onlineUsers++

    const randomName = "User" + Math.floor(Math.random() * 1000)

    userList.push({
        id: socket.id,
        name: randomName
    })

    io.emit("online-users", onlineUsers)
    io.emit("update-users", userList)

    /* =========================================
       START / MATCH
       ========================================= */

    socket.on("start", () => {

        console.log("🔍 Searching:", socket.id)

        // remove if already in queue
        queue = queue.filter(id => id !== socket.id)

        if (queue.length > 0) {

            const partnerId = queue.shift()

            users[socket.id] = partnerId
            users[partnerId] = socket.id

            io.to(socket.id).emit("matched")
            io.to(partnerId).emit("matched")

            console.log("✅ Matched:", socket.id, "<->", partnerId)

        } else {

            queue.push(socket.id)
            socket.emit("waiting")

            console.log("⏳ Waiting:", socket.id)
        }

    })

    /* =========================================
       MESSAGE
       ========================================= */

    socket.on("message", (msg) => {
        const partner = users[socket.id]
        if (partner) {
            io.to(partner).emit("message", msg)
        }
    })

    /* =========================================
       TYPING
       ========================================= */

    socket.on("typing", () => {
        const partner = users[socket.id]
        if (partner) {
            io.to(partner).emit("typing")
        }
    })

    socket.on("stop-typing", () => {
        const partner = users[socket.id]
        if (partner) {
            io.to(partner).emit("stop-typing")
        }
    })

    /* =========================================
       NEXT (SKIP)
       ========================================= */

    socket.on("next", () => {

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("stranger-disconnected")

            delete users[partner]
            delete users[socket.id]
        }

        // remove from queue
        queue = queue.filter(id => id !== socket.id)

        // restart matching
        setTimeout(() => {
            socket.emit("start")
        }, 100)

    })

    /* =========================================
       WEBRTC SIGNALING
       ========================================= */

    socket.on("offer", (offer) => {
        const partner = users[socket.id]
        if (partner) io.to(partner).emit("offer", offer)
    })

    socket.on("answer", (answer) => {
        const partner = users[socket.id]
        if (partner) io.to(partner).emit("answer", answer)
    })

    socket.on("ice", (candidate) => {
        const partner = users[socket.id]
        if (partner) io.to(partner).emit("ice", candidate)
    })

    /* =========================================
       DISCONNECT
       ========================================= */

    socket.on("disconnect", () => {

        console.log("🔴 User disconnected:", socket.id)

        onlineUsers = Math.max(0, onlineUsers - 1)

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("stranger-disconnected")

            delete users[partner]
            delete users[socket.id]
        }

        // remove from queue
        queue = queue.filter(id => id !== socket.id)

        // remove from user list
        userList = userList.filter(u => u.id !== socket.id)

        io.emit("online-users", onlineUsers)
        io.emit("update-users", userList)

    })

})

/* =========================================
   START SERVER
   ========================================= */

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {
    console.log("🚀 CHATGRAM running on port:", PORT)
})
