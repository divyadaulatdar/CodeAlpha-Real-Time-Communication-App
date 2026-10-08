const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("joinBtn");
const statusText = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream = null;

joinBtn.addEventListener("click", async () => {
const roomId = roomInput.value.trim();

if (!roomId) {
statusText.textContent = "Please enter a Meeting Room ID.";
return;
}

try {
localStream = await navigator.mediaDevices.getUserMedia({
video: true,
audio: true
});

localVideo.srcObject = localStream;
statusText.textContent =
  "Camera ready. Room ID: " + roomId +
  ". Signaling server integration is required to connect remote participants.";

} catch (error) {
statusText.textContent =
"Camera or microphone access failed. Please allow permissions.";
console.error(error);
}
});

window.addEventListener("beforeunload", () => {
if (localStream) {
localStream.getTracks().forEach(track => track.stop());
}
});
