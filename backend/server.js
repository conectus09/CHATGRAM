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

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

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

    socket.on("message", (msg) => {

        const partner = users[socket.id];

        if (partner) {
            io.to(partner).emit("message", msg);
        }

    });

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

    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id);

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
