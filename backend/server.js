/* =========================================
   CHATGRAM RANDOM CHAT SERVER
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

let waitingUser = null
let users = {}
let onlineUsers = 0

/* =========================================
   SOCKET CONNECTION
   ========================================= */

io.on("connection", (socket) => {

    console.log("User connected:", socket.id)

    /* =========================================
       ONLINE USER COUNTER
       ========================================= */

    onlineUsers++
    io.emit("online-users", onlineUsers)

    /* =========================================
       JOIN VIDEO CHAT
       ========================================= */

    socket.on("join-video", () => {

        console.log("Searching partner:", socket.id)

        if (waitingUser && waitingUser !== socket.id) {

            users[socket.id] = waitingUser
            users[waitingUser] = socket.id

            io.to(socket.id).emit("matched")
            io.to(waitingUser).emit("matched")

            waitingUser = null

        } else {

            waitingUser = socket.id
            socket.emit("waiting")

        }

    })

    /* =========================================
       TEXT MESSAGE
       ========================================= */

    socket.on("message", (msg) => {

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("message", msg)
        }

    })

    /* =========================================
       TYPING INDICATOR
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
       WEBRTC SIGNALING
       ========================================= */

    socket.on("offer", (offer) => {

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("offer", offer)
        }

    })

    socket.on("answer", (answer) => {

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("answer", answer)
        }

    })

    socket.on("ice", (candidate) => {

        const partner = users[socket.id]

        if (partner) {
            io.to(partner).emit("ice", candidate)
        }

    })

    /* =========================================
       NEXT STRANGER
       ========================================= */

    socket.on("next", () => {

        const partner = users[socket.id]

        if (partner) {

            io.to(partner).emit("stranger-disconnected")

            delete users[partner]
            delete users[socket.id]

        }

        if (waitingUser === socket.id) {
            waitingUser = null
        }

        // Start searching again
        if (waitingUser && waitingUser !== socket.id) {

            users[socket.id] = waitingUser
            users[waitingUser] = socket.id

            io.to(socket.id).emit("matched")
            io.to(waitingUser).emit("matched")

            waitingUser = null

        } else {

            waitingUser = socket.id
            socket.emit("waiting")

        }

    })

    /* =========================================
       DISCONNECT
       ========================================= */

    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id)

        onlineUsers = Math.max(0, onlineUsers - 1)
        io.emit("online-users", onlineUsers)

        const partner = users[socket.id]

        if (partner) {

            io.to(partner).emit("stranger-disconnected")

            delete users[partner]
            delete users[socket.id]

        }

        if (waitingUser === socket.id) {
            waitingUser = null
        }

    })

})

/* =========================================
   START SERVER
   ========================================= */

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {

    console.log("🚀 CHATGRAM server running on port:", PORT)

})
