const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const roomUsers = new Map();

io.on("connection", (socket) => {
console.log("User connected:", socket.id);

socket.on("join-room", (details) => {
const room =
typeof details === "string" ? details.trim() : details?.room?.trim();
const username =
typeof details === "object" ? details?.username?.trim() : "Guest";

if (!room || room.length > 100) return;

const oldRoom = socket.data.room;

if (oldRoom && oldRoom !== room) {
  socket.leave(oldRoom);
  io.to(oldRoom).emit("user-left", {
    id: socket.id,
    username: socket.data.username
  });
}

const existingUsers = roomUsers.get(room) || new Map();

socket.join(room);
socket.data.room = room;
socket.data.username = username || "Guest";

socket.emit("room-joined", {
  room,
  users: Array.from(existingUsers.entries()).map(([id, name]) => ({
    id,
    username: name
  }))
});

socket.to(room).emit("user-joined", {
  id: socket.id,
  username: socket.data.username
});

existingUsers.set(socket.id, socket.data.username);
roomUsers.set(room, existingUsers);

console.log(socket.data.username, "joined room:", room);

});

socket.on("signal", (message) => {
const room = socket.data.room;

if (!room || !message || !message.target || !message.data) return;

io.to(message.target).emit("signal", {
  sender: socket.id,
  data: message.data
});

});

socket.on("chat-message", (data) => {
const room = socket.data.room;
if (!room || !data) return;

const message =
  typeof data.message === "string" ? data.message.trim().slice(0, 1000) : "";

if (!message) return;

io.to(room).emit("chat-message", {
  username: socket.data.username || "Guest",
  message
});

});

socket.on("leave-room", () => {
leaveCurrentRoom(socket);
});

socket.on("disconnect", () => {
leaveCurrentRoom(socket);
console.log("User disconnected:", socket.id);
});
});

function leaveCurrentRoom(socket) {
const room = socket.data.room;
if (!room) return;

socket.leave(room);

const users = roomUsers.get(room);

if (users) {
users.delete(socket.id);

if (users.size === 0) {
  roomUsers.delete(room);
}

}

socket.to(room).emit("user-left", {
id: socket.id,
username: socket.data.username || "Guest"
});

socket.data.room = null;
}

app.get("/health", (req, res) => {
res.json({ status: "ok", app: "CodeAlpha Real-Time Communication App" });
});

server.listen(PORT, () => {
console.log("Server running on port ${PORT}");
});
