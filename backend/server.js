const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

let waitingUser = null;
let users = {};
let onlineUsers = 0;

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    onlineUsers++;
    io.emit("online-users", onlineUsers);


    // RANDOM MATCHING
    if (waitingUser) {

        users[socket.id] = waitingUser;
        users[waitingUser] = socket.id;

        io.to(socket.id).emit("matched");
        io.to(waitingUser).emit("matched");

        waitingUser = null;

    } else {

        waitingUser = socket.id;
        socket.emit("waiting");

    }


    // MESSAGE
    socket.on("message", (msg) => {

        const partner = users[socket.id];

        if (partner) {
            io.to(partner).emit("message", msg);
        }

    });


    // TYPING INDICATOR
    socket.on("typing", () => {

        const partner = users[socket.id];

        if (partner) {
            io.to(partner).emit("typing");
        }

    });


    socket.on("stop-typing", () => {

        const partner = users[socket.id];

        if (partner) {
            io.to(partner).emit("stop-typing");
        }

    });


    // NEXT STRANGER
    socket.on("next", () => {

        const partner = users[socket.id];

        if (partner) {

            io.to(partner).emit("stranger-disconnected");

            delete users[partner];
            delete users[socket.id];

        }

        if (waitingUser === socket.id) {
            waitingUser = null;
        }


        // FIND NEW MATCH
        if (waitingUser) {

            users[socket.id] = waitingUser;
            users[waitingUser] = socket.id;

            io.to(socket.id).emit("matched");
            io.to(waitingUser).emit("matched");

            waitingUser = null;

        } else {

            waitingUser = socket.id;
            socket.emit("waiting");

        }

    });


    // DISCONNECT
    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id);

        onlineUsers--;
        io.emit("online-users", onlineUsers);

        const partner = users[socket.id];

        if (partner) {

            io.to(partner).emit("stranger-disconnected");

            delete users[partner];
            delete users[socket.id];

        }

        if (waitingUser === socket.id) {
            waitingUser = null;
        }

    });

});

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
