const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
console.log("A user connected:", socket.id);

socket.on("join-room", (room) => {
if (typeof room !== "string" || !room.trim()) return;
socket.join(room.trim());
socket.to(room.trim()).emit("user-joined", socket.id);
});

socket.on("signal", ({ room, data }) => {
if (typeof room !== "string" || !room.trim()) return;
socket.to(room.trim()).emit("signal", {
from: socket.id,
data
});
});

socket.on("chat-message", ({ room, message }) => {
if (typeof room !== "string" || !room.trim()) return;
if (typeof message !== "string" || !message.trim()) return;

io.to(room.trim()).emit("chat-message", {
  sender: socket.id,
  message: message.trim().slice(0, 1000)
});

});

socket.on("disconnect", () => {
console.log("A user disconnected:", socket.id);
});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
console.log("Server running on port ${PORT}");
});
