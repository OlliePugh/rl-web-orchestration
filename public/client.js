let peerConnection;
const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    // {
    //   "urls": "turn:TURN_IP?transport=tcp",
    //   "username": "TURN_USERNAME",
    //   "credential": "TURN_CREDENTIALS"
    // }
  ],
};

let controlMap = {
  KeyW: "N",
  KeyS: "S",
  KeyD: "E",
  KeyA: "W",
  ArrowUp: "N",
  ArrowDown: "S",
  ArrowLeft: "W",
  ArrowRight: "E",
};

var queryDict = {};
var sessionId;
location.search
  .substring(1)
  .split("&")
  .forEach(function (item) {
    queryDict[item.split("=")[0]] = item.split("=")[1];
  }); // stores get params

const socket = io.connect(window.location.origin);

socket.on("connect", function () {
  sessionId = socket.id;
  console.log(queryDict);
  if (queryDict.team) {
    // is joining lobby
    socket.emit("lobbyJoin", queryDict.team);
    displayFriendLink(false);
  } else {
    // display options to create a lobby
    displayFriendLink(true);
  }
});

const video = document.querySelector("video");
const joinQueueButton = document.querySelector("#join-queue");

joinQueueButton.addEventListener("click", joinQueue);

socket.on("offer", (id, description) => {
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = (event) => {
    video.srcObject = event.streams[0];
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

socket.on("candidate", (id, candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch((e) => console.error(e));
});

socket.on("message", (content) => {
  document.getElementById("message-header").innerText = content;
});

socket.on("lobbyDisband", () => {
  document.getElementById("message-header").innerText = "Lobby leader has quit";
  displayFriendLink(true);
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
  peerConnection.close();
};

function joinQueue() {
  console.log(`joining queue`);
  socket.emit("join_queue");
  inQueue = true;
}

function leaveQueue() {
  console.log(`$leaving queue`);
  socket.emit("leave_queue");
  inQueue = true;
}

const displayFriendLink = (display) => {
  document.getElementById("join-queue").style.display = display
    ? "block "
    : "none";
  document.getElementById("lobby-join").style.display = display
    ? "block "
    : "none";
};

const copyFriendsLink = () => {
  const url =
    "http://" + location.host + location.pathname + "?team=" + sessionId;
  navigator.clipboard.writeText(url);
  alert("Copied link to clipboard");
};

document.addEventListener("keydown", (event) => {
  if (!event.repeat) {
    // only on state change
    if (Object.keys(controlMap).includes(event.code)) {
      socket.emit("controlDownCommand", controlMap[event.code]);
    }
  }
});

document.addEventListener("keyup", (event) => {
  if (Object.keys(controlMap).includes(event.code)) {
    socket.emit("controlUpCommand", controlMap[event.code]);
  }
});
