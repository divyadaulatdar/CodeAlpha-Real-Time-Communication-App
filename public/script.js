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
let currentRoom = "";
let currentUsername = "";
let peerConnection = null;
let remoteSocketId = null;
let participantCount = 1;
let isDrawing = false;
let loggedIn = false;

const peers = new Map();

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

function addMessage(sender, message) {
  if (!messages) return;

  const item = document.createElement("p");
  item.textContent = `${sender}: ${message}`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function updateParticipants(count) {
  participantCount = Math.max(1, count || 1);

  if (participantsText) {
    participantsText.textContent =
      `Participants: ${participantCount}`;
  }
}

async function startCamera() {
  try {
    if (localStream) return localStream;

    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideo.srcObject = localStream;
    cameraBtn.textContent = "Camera On";
    setStatus("Camera and microphone are ready.");

    return localStream;
  } catch (error) {
    console.error(error);
    setStatus("Camera access failed. Allow camera and microphone permissions.");
    return null;
  }
}

function createPeerConnection(peerId) {
  if (peers.has(peerId)) {
    return peers.get(peerId);
  }

  const pc = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  pc.ontrack = (event) => {
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && currentRoom) {
      socket.emit("signal", {
        room: currentRoom,
        target: peerId,
        data: {
          type: "candidate",
          candidate: event.candidate
        }
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      setStatus("Video connection established.");
    } else if (
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected"
    ) {
      setStatus("Video connection interrupted.");
    }
  };

  peers.set(peerId, pc);
  return pc;
}

async function callPeer(peerId) {
  try {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socket.emit("signal", {
      room: currentRoom,
      target: peerId,
      data: {
        type: "offer",
        description: pc.localDescription
      }
    });
  } catch (error) {
    console.error("Could not start call:", error);
    setStatus("Could not start the video call.");
  }
}

async function handleSignal(payload) {
  if (!payload || !payload.from || !payload.data) return;

  const peerId = payload.from;
  const data = payload.data;

  try {
    const pc = createPeerConnection(peerId);

    if (data.type === "offer") {
      await pc.setRemoteDescription(data.description);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("signal", {
        room: currentRoom,
        target: peerId,
        data: {
          type: "answer",
          description: pc.localDescription
        }
      });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(data.description);
    } else if (data.type === "candidate" && data.candidate) {
      await pc.addIceCandidate(data.candidate);
    }
  } catch (error) {
    console.error("Signaling error:", error);
  }
}

joinBtn?.addEventListener("click", async () => {
  const room = roomInput.value.trim();
  const username = usernameInput.value.trim();

  if (!room || !username) {
    setStatus("Enter your name and a meeting room ID.");
    return;
  }

  if (currentRoom) {
    setStatus("Leave the current room before joining another.");
    return;
  }

  currentRoom = room;
  currentUsername = username;

  socket.emit("join-room", {
    room: currentRoom,
    username: currentUsername
  });

  setStatus("Joining room...");
  await startCamera();
});

socket.on("connect", () => {
  if (!currentRoom) setStatus("Connected to signaling server.");
});

socket.on("connect_error", () => {
  setStatus("Cannot connect to server. Start the Node.js server first.");
});

socket.on("user-joined", async (payload) => {
  const peerId =
    typeof payload === "string" ? payload : payload?.id;

  if (!peerId || peerId === socket.id) return;

  remoteSocketId = peerId;
  updateParticipants(participantCount + 1);

  if (localStream) {
    await callPeer(peerId);
  } else {
    setStatus("Another participant joined. Start your camera.");
  }
});

socket.on("signal", handleSignal);

socket.on("user-left", (payload) => {
  const peerId =
    typeof payload === "string" ? payload : payload?.id;

  if (peerId && peers.has(peerId)) {
    peers.get(peerId).close();
    peers.delete(peerId);
  }

  if (remoteVideo) remoteVideo.srcObject = null;

  remoteSocketId = null;
  updateParticipants(participantCount - 1);
  setStatus("A participant left the room.");
});

socket.on("chat-message", (data) => {
  if (!data) return;

  addMessage(
    data.username || data.sender || "Participant",
    data.message || ""
  );
});

cameraBtn?.addEventListener("click", async () => {
  if (!localStream) {
    await startCamera();
    return;
  }

  const videoTrack = localStream.getVideoTracks()[0];

  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    cameraBtn.textContent = videoTrack.enabled
      ? "Turn Camera Off"
      : "Turn Camera On";
  }
});

micBtn?.addEventListener("click", async () => {
  if (!localStream) {
    await startCamera();
    return;
  }

  const audioTrack = localStream.getAudioTracks()[0];

  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    micBtn.textContent = audioTrack.enabled
      ? "Mute Microphone"
      : "Unmute Microphone";
  }
});

shareBtn?.addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices.getDisplayMedia) {
      setStatus("Screen sharing is not supported in this browser.");
      return;
    }

    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    if (remoteSocketId && peers.has(remoteSocketId)) {
      const pc = peers.get(remoteSocketId);
      const sender = pc.getSenders().find(
        (item) => item.track && item.track.kind === "video"
      );

      if (sender) await sender.replaceTrack(screenTrack);
    }

    localVideo.srcObject = screenStream;

    screenTrack.onended = async () => {
      if (localStream) {
        localVideo.srcObject = localStream;

        if (remoteSocketId && peers.has(remoteSocketId)) {
          const pc = peers.get(remoteSocketId);
          const sender = pc.getSenders().find(
            (item) => item.track && item.track.kind === "video"
          );

          const cameraTrack = localStream.getVideoTracks()[0];
          if (sender && cameraTrack) {
            await sender.replaceTrack(cameraTrack);
          }
        }
      }
    };

    setStatus("Screen sharing started.");
  } catch (error) {
    console.error(error);
    setStatus("Screen sharing cancelled or unavailable.");
  }
});

sendBtn?.addEventListener("click", () => {
  const message = messageInput.value.trim();

  if (!message || !currentRoom) {
    setStatus("Join a room and enter a message first.");
    return;
  }

  socket.emit("chat-message", {
    room: currentRoom,
    username: currentUsername,
    message
  });

  messageInput.value = "";
});

messageInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendBtn?.click();
});

uploadBtn?.addEventListener("click", () => {
  const file = fileInput.files[0];

  if (!file) {
    setStatus("Choose a file first.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setStatus("File must be smaller than 5 MB.");
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = file.name;
  link.textContent = `Download ${file.name}`;
  link.style.display = "block";

  fileList.appendChild(link);
  setStatus("File link created on this device. It is not shared with other participants.");
});

const boardContext = whiteboard?.getContext("2d");

if (boardContext && whiteboard) {
  boardContext.lineWidth = 3;
  boardContext.lineCap = "round";
  boardContext.strokeStyle = "#2563eb";

  function getBoardPosition(event) {
    const rect = whiteboard.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) *
        (whiteboard.width / rect.width),
      y: (event.clientY - rect.top) *
        (whiteboard.height / rect.height)
    };
  }

  whiteboard.addEventListener("pointerdown", (event) => {
    isDrawing = true;
    const position = getBoardPosition(event);
    boardContext.beginPath();
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
