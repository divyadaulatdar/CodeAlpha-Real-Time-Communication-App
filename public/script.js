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
const shareBtn = $("shareBtn");

const messages = $("messages");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");

let localStream = null;
let screenStream = null;
let roomJoined = false;
let peerConnection = null;
let currentRoom = "";
let currentUser = "";
let micEnabled = true;

const peers = new Map();

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function showStatus(message) {
  statusText.textContent = message;
}

function addMessage(name, message) {
  const item = document.createElement("p");
  item.textContent = `${name}: ${message}`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

joinBtn.addEventListener("click", async () => {
  currentUser = usernameInput.value.trim();
  currentRoom = roomInput.value.trim();

  if (!currentUser || !currentRoom) {
    showStatus("Enter your name and room ID.");
    return;
  }

  if (roomJoined) return;

  socket.emit("join-room", {
    room: currentRoom,
    username: currentUser
  });

  roomJoined = true;
  joinBtn.disabled = true;
  showStatus("Joined room: " + currentRoom);
});

cameraBtn.addEventListener("click", async () => {
  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localVideo.srcObject = localStream;
      cameraBtn.textContent = "Stop Camera";
      showStatus("Camera and microphone started.");
    } else {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      localVideo.srcObject = null;
      cameraBtn.textContent = "Start Camera";
      showStatus("Camera stopped.");
    }
  } catch (error) {
    showStatus("Camera access failed. Allow camera and microphone permission.");
  }
});

const micBtn = $("micBtn");

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!localStream) {
      showStatus("Start the camera first.");
      return;
    }

    micEnabled = !micEnabled;

    localStream.getAudioTracks().forEach(track => {
      track.enabled = micEnabled;
    });

    micBtn.textContent = micEnabled ? "Mute Microphone" : "Unmute Microphone";
  });
}

shareBtn.addEventListener("click", async () => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    localVideo.srcObject = screenStream;

    screenStream.getVideoTracks()[0].addEventListener("ended", () => {
      localVideo.srcObject = localStream;
      screenStream = null;
    });

    showStatus("Screen sharing started.");
  } catch (error) {
    showStatus("Screen sharing cancelled or unavailable.");
  }
});

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();

  if (!roomJoined || !message) {
    showStatus("Join a room and enter a message first.");
    return;
  }

  socket.emit("chat-message", {
    room: currentRoom,
    username: currentUser,
    message
  });

  messageInput.value = "";
}

socket.on("chat-message", data => {
  addMessage(data.username || "Participant", data.message || "");
});

socket.on("room-users", users => {
  participantsText.textContent =
    "Participants: " + (Array.isArray(users) ? users.length : 0);
});

socket.on("user-joined", data => {
  addMessage("System", (data.username || "A participant") + " joined the room.");
});

socket.on("user-left", data => {
  addMessage("System", (data.username || "A participant") + " left the room.");
});

const leaveBtn = $("leaveBtn");

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    if (roomJoined) {
      socket.emit("leave-room", { room: currentRoom });
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      localVideo.srcObject = null;
    }

    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }

    peers.forEach(connection => connection.close());
    peers.clear();

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    roomJoined = false;
    joinBtn.disabled = false;
    participantsText.textContent = "Participants: 0";
    showStatus("You left the room.");
  });
}

socket.on("connect", () => {
  console.log("Connected to communication server.");
});

socket.on("connect_error", () => {
  showStatus("Cannot connect. Start the Node.js server first.");
});nPath();
    boardContext.moveTo(position.x, position.y);
    whiteboard.setPointerCapture(event.pointerId);
  });

  whiteboard.addEventListener("pointermove", (event) => {
    if (!isDrawing) return;

    const position = getBoardPosition(event);
    boardContext.lineTo(position.x, position.y);
    boardContext.stroke();
  });

  whiteboard.addEventListener("pointerup", () => {
    isDrawing = false;
    boardContext.closePath();
  });

  whiteboard.addEventListener("pointercancel", () => {
    isDrawing = false;
  });
}

clearBoardBtn?.addEventListener("click", () => {
  if (boardContext && whiteboard) {
    boardContext.clearRect(0, 0, whiteboard.width, whiteboard.height);
  }
});

async function authenticate(action) {
  const username = authUsername.value.trim();
  const password = authPassword.value;

  if (!username || !password) {
    authStatus.textContent = "Enter a username and password.";
    return;
  }

  try {
    const response = await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    authStatus.textContent = result.message ||
      (response.ok ? "Success." : "Authentication failed.");

    if (response.ok && action === "login") loggedIn = true;
  } catch (error) {
    console.error(error);
    authStatus.textContent =
      "Authentication API is not configured on the server yet.";
  }
}

registerBtn?.addEventListener("click", () => authenticate("register"));
loginBtn?.addEventListener("click", () => authenticate("login"));

leaveBtn?.addEventListener("click", () => {
  peers.forEach((pc) => pc.close());
  peers.clear();

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
    screenStream = null;
  }

  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;

  if (currentRoom) {
    socket.emit("leave-room", currentRoom);
  }

  currentRoom = "";
  remoteSocketId = null;
  updateParticipants(1);
  setStatus("You left the room.");
  cameraBtn.textContent = "Start Camera";
  micBtn.textContent = "Mute Microphone";
  shareBtn.textContent = "Share Screen";
});

window.addEventListener("beforeunload", () => {
  peers.forEach((pc) => pc.close());

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
  }
});k);
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
