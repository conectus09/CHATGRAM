/* =========================================
   CHATGRAM SOCKET HANDLER
========================================= */

const { Server } = require("socket.io")

let waitingUsers = []
let onlineUsers = 0

const socketHandler = (server) => {

const io = new Server(server,{
    cors:{
        origin:"*",
        methods:["GET","POST"]
    }
})

/* =========================================
   CONNECTION
========================================= */

io.on("connection",(socket)=>{

console.log("User connected:",socket.id)

onlineUsers++

io.emit("onlineUsers",onlineUsers)

/* =========================================
   FIND STRANGER
========================================= */

function findStranger(){

// remove user if already waiting
waitingUsers = waitingUsers.filter(id => id !== socket.id)

if(waitingUsers.length > 0){

const strangerId = waitingUsers.shift()

const stranger = io.sockets.sockets.get(strangerId)

if(!stranger){

findStranger()
return

}

socket.partner = stranger.id
stranger.partner = socket.id

socket.emit("connected")
stranger.emit("connected")

}else{

waitingUsers.push(socket.id)

socket.emit("waiting")

}

}

/* =========================================
   START CHAT
========================================= */

socket.on("startChat",()=>{

findStranger()

})

/* =========================================
   MESSAGE
========================================= */

socket.on("message",(msg)=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("message",msg)
}

}

})

/* =========================================
   TYPING
========================================= */

socket.on("typing",()=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("typing")
}

}

})

socket.on("stopTyping",()=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("stopTyping")
}

}

})

/* =========================================
   WEBRTC SIGNALING
========================================= */

socket.on("offer",(offer)=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("offer",offer)
}

}

})

socket.on("answer",(answer)=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("answer",answer)
}

}

})

socket.on("ice",(candidate)=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){
partner.emit("ice",candidate)
}

}

})

/* =========================================
   NEXT STRANGER
========================================= */

socket.on("next",()=>{

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){

partner.emit("strangerDisconnected")

partner.partner = null

}

socket.partner = null

}

findStranger()

})

/* =========================================
   DISCONNECT
========================================= */

socket.on("disconnect",()=>{

console.log("User disconnected:",socket.id)

onlineUsers = Math.max(0,onlineUsers - 1)

io.emit("onlineUsers",onlineUsers)

if(socket.partner){

const partner = io.sockets.sockets.get(socket.partner)

if(partner){

partner.emit("strangerDisconnected")

partner.partner = null

}

}

waitingUsers = waitingUsers.filter(id => id !== socket.id)

})

})

}

module.exports = socketHandler
