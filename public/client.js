const GAME_LENGTH = 120_000;

let gameTimer;
let video;
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

const socket = io.connect(window.location.origin, { secure: true });

socket.on("connect", function () {
  sessionId = socket.id;
  if (queryDict.team) {
    // is joining lobby
    socket.emit("lobbyJoin", queryDict.team);
    displayFriendLink(false);
  } else {
    // display options to create a lobby
    displayFriendLink(true);
  }

  socket.emit("getQueueSize");
});

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

socket.on("startMatch", () => {
  startTimer();
  displayVideoStream(true);
  document.getElementById("queue-position").textContent = "";
});

socket.on("endMatch", () => {
  finishTimer();
  displayVideoStream(false);
  document.getElementById("join-queue").disabled = false; // renable the join queue button
});

socket.on("queueSize", (amountInQueue) => {
  document.getElementById("queue-counter").textContent = amountInQueue;
});

socket.on("posInQueue", (position) => {
  document.getElementById(
    "queue-position"
  ).textContent = `You are position ${position} out of `;
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
  peerConnection.close();
};

function joinQueue() {
  socket.emit("join_queue");
  inQueue = true;
  document.getElementById("join-queue").disabled = true;
}

function leaveQueue() {
  socket.emit("leave_queue");
  inQueue = true;
}

const startTimer = () => {
  gameEndTime = new Date(Date.now() + GAME_LENGTH);
  gameTimer = setInterval(function () {
    // Get today's date and time
    let now = new Date().getTime();

    // Find the distance between now and the count down date
    let distance = gameEndTime - now;

    // Time calculations for days, hours, minutes and seconds
    let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    let seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Display the result in the element with id="demo"
    document.getElementById("clock").textContent = minutes + ":" + seconds;

    // If the count down is finished, write some text
    if (distance < 0) {
      finishTimer();
    }
  }, 1000);
};

const finishTimer = () => {
  clearInterval(gameTimer);
  document.getElementById("clock").textContent = "";
};

const displayFriendLink = (display) => {
  document.getElementById("join-queue").style.display = display
    ? "block "
    : "none";
  document.getElementById("lobby-join").style.display = display
    ? "block "
    : "none";
};

const displayVideoStream = (display) => {
  document.getElementById("video-stream").style.visibility = display
    ? "visible"
    : "hidden";
};

const copyFriendsLink = () => {
  const url =
    "https://" + location.host + location.pathname + "?team=" + sessionId;
  navigator.clipboard.writeText(url);
  alert("Copied link to clipboard");
};

const setupMobileControls = () => {
  ["N", "E", "S", "W"].forEach((direction) => {
    const el = document.getElementById(`${direction}-canvas`);
    el.addEventListener("touchstart", () => {
      socket.emit("controlDownCommand", direction);
    });
    el.addEventListener("touchend", () => {
      socket.emit("controlUpCommand", direction);
    });
  });
};

document.addEventListener("keydown", (event) => {
  if (!event.repeat) {
    // only on state change
    if (Object.keys(controlMap).includes(event.code)) {
      event.preventDefault();
      socket.emit("controlDownCommand", controlMap[event.code]);
    }
  }
});

document.addEventListener("keyup", (event) => {
  if (Object.keys(controlMap).includes(event.code)) {
    event.preventDefault();
    socket.emit("controlUpCommand", controlMap[event.code]);
  }
});

document.addEventListener("DOMContentLoaded", function (event) {
  video = document.querySelector("video");
  const joinQueueButton = document.getElementById("join-queue");

  joinQueueButton.addEventListener("click", joinQueue);
  setupMobileControls();
});
