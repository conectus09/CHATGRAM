const { Server } = require("socket.io");

let waitingUsers = [];
let onlineUsers = 0;

const socketHandler = (server) => {

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    onlineUsers++;

    io.emit("onlineUsers", onlineUsers);


    // Find stranger
    function findStranger() {

        if (waitingUsers.length > 0) {

            const stranger = waitingUsers.shift();

            socket.partner = stranger;
            stranger.partner = socket;

            socket.emit("connected");
            stranger.emit("connected");

        } else {

            waitingUsers.push(socket);

            socket.emit("waiting");

        }

    }


    // Start random chat
    socket.on("startChat", () => {

        findStranger();

    });


    // Send message
    socket.on("message", (msg) => {

        if (socket.partner) {

            socket.partner.emit("message", msg);

        }

    });


    // Typing indicator
    socket.on("typing", () => {

        if (socket.partner) {

            socket.partner.emit("typing");

        }

    });


    // Stop typing
    socket.on("stopTyping", () => {

        if (socket.partner) {

            socket.partner.emit("stopTyping");

        }

    });


    // Next stranger
    socket.on("next", () => {

        if (socket.partner) {

            socket.partner.emit("strangerDisconnected");

            socket.partner.partner = null;

        }

        socket.partner = null;

        findStranger();

    });


    // Disconnect
    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id);

        onlineUsers--;

        io.emit("onlineUsers", onlineUsers);


        if (socket.partner) {

            socket.partner.emit("strangerDisconnected");

            socket.partner.partner = null;

        }


        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);

    });

});

};

module.exports = socketHandler;
