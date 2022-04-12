let peerConnection;
const config = {
  iceServers: [
    {
      "urls": "stun:stun.l.google.com:19302",
    },
    // { 
    //   "urls": "turn:TURN_IP?transport=tcp",
    //   "username": "TURN_USERNAME",
    //   "credential": "TURN_CREDENTIALS"
    // }
  ]
};

let controlMap = {
  "KeyW": "N",
  "KeyS": "S",
  "KeyD": "E",
  "KeyA": "W",
  "ArrowUp": "N",
  "ArrowDown": "S",
  "ArrowLeft": "W",
  "ArrowRight": "E"
}

const socket = io.connect(window.location.origin);
const video = document.querySelector("video");
const joinQueueButton = document.querySelector("#join-queue");

joinQueueButton.addEventListener("click", joinQueue)

socket.on("offer", (id, description) => {
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});


socket.on("candidate", (id, candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
  peerConnection.close();
};

function joinQueue() {
  console.log(`joining queue`)
  socket.emit("join_queue");
  inQueue = true;
}

function leaveQueue() {
  console.log(`$leaving queue`)
  socket.emit("leave_queue");
  inQueue = true;
}

document.addEventListener('keydown', (event) => {
  if (Object.keys(controlMap).includes(event.code)) {
    socket.emit("control_command", controlMap[event.code])
  }
});
