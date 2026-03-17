/* =========================================
   CHATGRAM SOCKET HANDLER (FINAL CLEAN)
========================================= */

const { Server } = require("socket.io")

/* =========================================
   GLOBAL STATE
========================================= */

let waitingUsers = []
let onlineUsers = 0

/* =========================================
   MAIN SOCKET HANDLER
========================================= */

const socketHandler = (server) => {

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

/* =========================================
   CONNECTION EVENT
========================================= */

io.on("connection", (socket) => {

    console.log("✅ User connected:", socket.id)

    onlineUsers++
    io.emit("onlineUsers", onlineUsers)

    socket.partner = null
    socket.name = "Stranger"

/* =========================================
   FIND STRANGER FUNCTION
========================================= */

    function findStranger() {

        console.log("🔍 Finding stranger for:", socket.id)

        // Remove from waiting if already exists
        waitingUsers = waitingUsers.filter(id => id !== socket.id)

        if (waitingUsers.length > 0) {

            const strangerId = waitingUsers.shift()
            const stranger = io.sockets.sockets.get(strangerId)

            if (!stranger) {
                console.log("⚠️ Stranger not found, retrying...")
                findStranger()
                return
            }

            // Connect both users
            socket.partner = stranger.id
            stranger.partner = socket.id

            console.log("🔥 MATCHED:", socket.id, "↔", stranger.id)

            socket.emit("matched", {
                name: stranger.name || "Stranger"
            })

            stranger.emit("matched", {
                name: socket.name || "Stranger"
            })

        } else {

            console.log("⏳ No users available, adding to waiting list")

            waitingUsers.push(socket.id)

            socket.emit("waiting")
        }
    }

/* =========================================
   START MATCHING
========================================= */

    socket.on("start", (data) => {

        socket.name = data?.name || "Stranger"

        console.log("🚀 Start chat:", socket.name)

        findStranger()
    })

/* =========================================
   MESSAGE HANDLING
========================================= */

    socket.on("message", (msg) => {

        console.log("📩 Message from", socket.id, ":", msg)

        if (!socket.partner) {
            console.log("❌ No partner, message ignored")
            return
        }

        const partner = io.sockets.sockets.get(socket.partner)

        if (partner) {
            console.log("➡️ Sending to partner:", partner.id)

            partner.emit("message", msg)
        } else {
            console.log("❌ Partner not found")
        }
    })

/* =========================================
   TYPING EVENTS
========================================= */

    socket.on("typing", () => {

        if (!socket.partner) return

        const partner = io.sockets.sockets.get(socket.partner)

        if (partner) {
            partner.emit("typing")
        }
    })

    socket.on("stop-typing", () => {

        if (!socket.partner) return

        const partner = io.sockets.sockets.get(socket.partner)

        if (partner) {
            partner.emit("stop-typing")
        }
    })

/* =========================================
   NEXT USER (SKIP)
========================================= */

    socket.on("next", () => {

        console.log("⏭️ Next requested by:", socket.id)

        if (socket.partner) {

            const partner = io.sockets.sockets.get(socket.partner)

            if (partner) {

                partner.emit("stranger-disconnected")

                partner.partner = null
            }

            socket.partner = null
        }

        findStranger()
    })

/* =========================================
   DISCONNECT EVENT
========================================= */

    socket.on("disconnect", () => {

        console.log("❌ User disconnected:", socket.id)

        onlineUsers = Math.max(0, onlineUsers - 1)
        io.emit("onlineUsers", onlineUsers)

        // Notify partner
        if (socket.partner) {

            const partner = io.sockets.sockets.get(socket.partner)

            if (partner) {

                console.log("⚠️ Notifying partner disconnect")

                partner.emit("stranger-disconnected")
                partner.partner = null
            }
        }

        // Remove from waiting list
        waitingUsers = waitingUsers.filter(id => id !== socket.id)
    })

/* =========================================
   PING / PONG (NETWORK CHECK)
========================================= */

    socket.on("ping-check", () => {
        socket.emit("pong-check")
    })

/* =========================================
   ERROR HANDLING
========================================= */

    socket.on("error", (err) => {
        console.log("⚠️ Socket error:", err)
    })

})

}

/* =========================================
   EXPORT MODULE
========================================= */

module.exports = socketHandler
