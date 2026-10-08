const socket = io();

const $ = (id) => document.getElementById(id);

const usernameInput = $("username");
const roomInput = $("room");
const joinBtn = $("joinBtn");
const statusText = $("status");
const participantsText = $("participants");
const localVideo = $("localVideo");
const remoteVideo = $("remoteVideo");
const cameraBtn = $("cameraBtn");
const micBtn = $("micBtn");
const shareBtn = $("shareBtn");
const leaveBtn = $("leaveBtn");
const messages = $("messages");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");
const fileInput = $("fileInput");
const uploadBtn = $("uploadBtn");
const fileList = $("fileList");
const whiteboard = $("whiteboard");
const clearBoardBtn = $("clearBoardBtn");
const authUsername = $("authUsername");
const authPassword = $("authPassword");
const registerBtn = $("registerBtn");
const loginBtn = $("loginBtn");
const authStatus = $("authStatus");

let localStream = null;
let screenStream = null;
let peerConnection = null;
let currentRoom = "";
let currentUsername = "";
let joined = false;
let cameraEnabled = false;
let micEnabled = true;
let remoteSocketId = null;

const rtcConfig = {
iceServers: [
{ urls: "stun:stun.l.google.com:19302" }
]
};

function setStatus(message) {
statusText.textContent = message;
}

function addMessage(name, message) {
const item = document.createElement("p");
item.textContent = "${name}: ${message}";
messages.appendChild(item);
messages.scrollTop = messages.scrollHeight;
}

function createPeerConnection(targetId) {
if (peerConnection) {
peerConnection.close();
}

remoteSocketId = targetId;
peerConnection = new RTCPeerConnection(rtcConfig);

if (localStream) {
localStream.getTracks().forEach((track) => {
peerConnection.addTrack(track, localStream);
});
}

peerConnection.ontrack = (event) => {
remoteVideo.srcObject = event.streams[0];
};

peerConnection.onicecandidate = (event) => {
if (event.candidate && remoteSocketId) {
socket.emit("signal", {
target: remoteSocketId,
data: {
type: "candidate",
candidate: event.candidate
}
});
}
};

peerConnection.onconnectionstatechange = () => {
if (peerConnection) {
setStatus("Connection: " + peerConnection.connectionState);
}
};

return peerConnection;
}

async function startCamera() {
try {
if (localStream) {
return;
}

localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

localVideo.srcObject = localStream;
cameraEnabled = true;
micEnabled = true;
cameraBtn.textContent = "Stop Camera";
micBtn.textContent = "Mute Microphone";

if (peerConnection) {
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
}

setStatus("Camera and microphone started.");

} catch (error) {
setStatus("Camera access failed. Allow camera and microphone permissions.");
console.error(error);
}
}

function stopCamera() {
if (localStream) {
localStream.getTracks().forEach((track) => track.stop());
localStream = null;
}

localVideo.srcObject = null;
cameraEnabled = false;
cameraBtn.textContent = "Start Camera";

if (peerConnection) {
peerConnection.getSenders().forEach((sender) => {
if (sender.track && sender.track.kind === "video") {
peerConnection.removeTrack(sender);
}
});
}
}

cameraBtn.addEventListener("click", async () => {
if (cameraEnabled) {
stopCamera();
} else {
await startCamera();
}
});

micBtn.addEventListener("click", async () => {
if (!localStream) {
await startCamera();
}

if (!localStream) return;

micEnabled = !micEnabled;

localStream.getAudioTracks().forEach((track) => {
track.enabled = micEnabled;
});

micBtn.textContent = micEnabled
? "Mute Microphone"
: "Unmute Microphone";
});

joinBtn.addEventListener("click", () => {
const room = roomInput.value.trim();
const username = usernameInput.value.trim();

if (!username || !room) {
setStatus("Enter your name and Meeting Room ID.");
return;
}

if (joined) {
setStatus("You are already in a room. Leave first to join another.");
return;
}

currentRoom = room;
currentUsername = username;
joined = true;

socket.emit("join-room", {
room,
username
});

setStatus("Joining room: " + room);
});

socket.on("connect", () => {
setStatus("Connected to signaling server. Enter a room to begin.");
});

socket.on("connect_error", (error) => {
setStatus("Server connection failed. Check server.js and try again.");
console.error(error);
});

socket.on("user-joined", async (data) => {
const peerId = typeof data === "string" ? data : data.id;

if (!peerId || peerId === socket.id) return;

participantsText.textContent = "Another participant joined.";
addMessage("System", "A participant joined the room.");

if (!localStream) {
setStatus("Participant joined. Start your camera to begin video.");
return;
}

try {
const pc = createPeerConnection(peerId);
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

socket.emit("signal", {
  target: peerId,
  data: {
    type: "offer",
    sdp: pc.localDescription
  }
});

} catch (error) {
console.error("Offer error:", error);
setStatus("Could not start video call.");
}
});

socket.on("signal", async (message) => {
try {
const data = message.data || message;
const senderId = message.sender || message.from;

if (senderId) {
  remoteSocketId = senderId;
}

if (data.type === "offer") {
  if (!localStream) {
    await startCamera();
  }

  if (!localStream) return;

  const pc = createPeerConnection(remoteSocketId);
  await pc.setRemoteDescription(
    new RTCSessionDescription(data.sdp)
  );

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("signal", {
    target: remoteSocketId,
    data: {
      type: "answer",
      sdp: pc.localDescription
    }
  });
} else if (data.type === "answer" && peerConnection) {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.sdp)
  );
} else if (data.type === "candidate" && peerConnection) {
  await peerConnection.addIceCandidate(
    new RTCIceCandidate(data.candidate)
  );
}

} catch (error) {
console.error("Signaling error:", error);
setStatus("Video connection failed. Check server signaling.");
}
});

socket.on("chat-message", (data) => {
if (typeof data === "string") {
addMessage("Participant", data);
} else {
addMessage(data.username || "Participant", data.message || "");
}
});

sendBtn.addEventListener("click", sendChatMessage);

messageInput.addEventListener("keydown", (event) => {
if (event.key === "Enter") {
sendChatMessage();
}
});

function sendChatMessage() {
const message = messageInput.value.trim();

if (!message) return;

if (!joined) {
addMessage("System", "Join a room before sending messages.");
return;
}

socket.emit("chat-message", {
room: currentRoom,
username: currentUsername,
message
});

addMessage("You", message);
messageInput.value = "";
}

leaveBtn.addEventListener("click", () => {
if (joined) {
socket.emit("leave-room", { room: currentRoom });
}

joined = false;
currentRoom = "";
remoteSocketId = null;

if (peerConnection) {
peerConnection.close();
peerConnection = null;
}

stopCamera();

if (screenStream) {
screenStream.getTracks().forEach((track) => track.stop());
screenStream = null;
}

remoteVideo.srcObject = null;
participantsText.textContent = "Participants: 0";
setStatus("You left the room.");
});

shareBtn.addEventListener("click", async () => {
try {
if (!navigator.mediaDevices.getDisplayMedia) {
setStatus("Screen sharing is not supported in this browser.");
return;
}

screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: true
});

const screenTrack = screenStream.getVideoTracks()[0];

if (peerConnection) {
  const sender = peerConnection.getSenders().find(
    (item) => item.track && item.track.kind === "video"
  );

  if (sender) {
    await sender.replaceTrack(screenTrack);
  } else {
    peerConnection.addTrack(screenTrack, screenStream);
  }
}

localVideo.srcObject = screenStream;

screenTrack.onended = async () => {
  if (localStream) {
    const cameraTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection && peerConnection.getSenders().find(
      (item) => item.track && item.track.kind === "video"
    );

    if (sender && cameraTrack) {
      await sender.replaceTrack(cameraTrack);
    }

    localVideo.srcObject = localStream;
  } else {
    localVideo.srcObject = null;
  }

  screenStream = null;
};

setStatus("Screen sharing started.");

} catch (error) {
setStatus("Screen sharing cancelled or unavailable.");
console.error(error);
}
});

// Whiteboard drawing
const boardContext = whiteboard.getContext("2d");
let drawing = false;

function boardPosition(event) {
const rect = whiteboard.getBoundingClientRect();

return {
x: (event.clientX - rect.left) * whiteboard.width / rect.width,
y: (event.clientY - rect.top) * whiteboard.height / rect.height
};
}

whiteboard.addEventListener("pointerdown", (event) => {
drawing = true;
const point = boardPosition(event);
boardContext.beginPath();
boardContext.moveTo(point.x, point.y);
whiteboard.setPointerCapture(event.pointerId);
});

whiteboard.addEventListener("pointermove", (event) => {
if (!drawing) return;

const point = boardPosition(event);
boardContext.lineWidth = 3;
boardContext.lineCap = "round";
boardContext.strokeStyle = "#1769ff";
boardContext.lineTo(point.x, point.y);
boardContext.stroke();
});

whiteboard.addEventListener("pointerup", () => {
drawing = false;
});

whiteboard.addEventListener("pointercancel", () => {
drawing = false;
});

clearBoardBtn.addEventListener("click", () => {
boardContext.clearRect(0, 0, whiteboard.width, whiteboard.height);
});

// File sharing preview (local device only until server upload is implemented)
uploadBtn.addEventListener("click", () => {
const file = fileInput.files[0];

if (!file) {
fileList.textContent = "Choose a file first.";
return;
}

const link = document.createElement("a");
link.href = URL.createObjectURL(file);
link.download = file.name;
link.textContent = "Open or download: " + file.name;
link.style.display = "block";

fileList.replaceChildren(link);
addMessage("System", "Selected file: " + file.name);
});

// Account buttons need matching server-side authentication endpoints.
async function accountAction(action) {
const username = authUsername.value.trim();
const password = authPassword.value;

if (!username || !password) {
authStatus.textContent = "Enter username and password.";
return;
}

try {
const response = await fetch("/api/" + action, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ username, password })
});

const result = await response.json();
authStatus.textContent = result.message ||
  (response.ok ? "Success." : "Request failed.");

} catch (error) {
authStatus.textContent =
"Authentication server endpoint is not configured yet.";
console.error(error);
}
}

registerBtn.addEventListener("click", () => accountAction("register"));
loginBtn.addEventListener("click", () => accountAction("login"));

window.addEventListener("beforeunload", () => {
if (localStream) {
localStream.getTracks().forEach((track) => track.stop());
}

if (screenStream) {
screenStream.getTracks().forEach((track) => track.stop());
}

if (peerConnection) {
peerConnection.close();
}
});
