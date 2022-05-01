const peerConnections = {};
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

// on start

let serialDevices = [];

const socket = io.connect(window.location.origin, { secure: true });
socket.emit("getQueueSize");
getSerial();

socket.on("answer", (id, description) => {
  peerConnections[id].setRemoteDescription(description);
});

socket.on("watcher", (id) => {
  const peerConnection = new RTCPeerConnection(config);
  peerConnections[id] = peerConnection;

  let stream = videoElement.srcObject;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };

  peerConnection
    .createOffer()
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("offer", id, peerConnection.localDescription);
    });
});

socket.on("candidate", (id, candidate) => {
  peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("disconnectPeer", (id) => {
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
  }
});

socket.on("queueSize", (amountInQueue) => {
  document.getElementById("queue-counter").textContent = amountInQueue;
});

socket.on("serialList", (result) => {
  // BUG Does not work if user refreshes page because its a new socket id
  serialDevices = result;
  const friendlySerial = result.map((item) => {
    return {
      friendlyName: item.friendlyName || item.path,
      value: item.path,
    };
  });
  const serialInput = document.getElementById("serial-input");
  friendlySerial.forEach((friendlySerial) =>
    serialInput.add(
      new Option(friendlySerial.friendlyName, friendlySerial.value)
    )
  );
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};

// Get camera and microphone
const videoElement = document.querySelector("video");
const videoSelect = document.querySelector("select#videoSource");

videoSelect.onchange = getStream;

getStream().then(getDevices).then(gotDevices);

function getDevices() {
  return navigator.mediaDevices.enumerateDevices();
}

function gotDevices(deviceInfos) {
  window.deviceInfos = deviceInfos;
  for (const deviceInfo of deviceInfos) {
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === "videoinput") {
      option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    }
  }
}

function getStream() {
  if (window.stream) {
    window.stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  const videoSource = videoSelect.value;
  const constraints = {
    video: { deviceId: videoSource ? { exact: videoSource } : undefined },
  };
  return navigator.mediaDevices
    .getUserMedia(constraints)
    .then(gotStream)
    .catch(handleError);
}

function gotStream(stream) {
  window.stream = stream;
  videoSelect.selectedIndex = [...videoSelect.options].findIndex(
    (option) => option.text === stream.getVideoTracks()[0].label
  );
  videoElement.srcObject = stream;
  socket.emit("broadcaster");
}

function handleError(error) {
  console.error("Error: ", error);
}

function serialConnect() {
  const serialInput = document.getElementById("serial-input");
  const optionChosen = serialInput.options[serialInput.selectedIndex].value;
  console.log(`Attempting to connect to ${optionChosen}`);
  socket.emit("serialConnect", optionChosen);
}

function broadcastMessage() {
  const broadcastMessageInput = document.getElementById("message-dispatch");
  socket.emit("broadcastMessage", broadcastMessageInput.value);
}

function getSerial() {
  console.log("getting serial");
  socket.emit("listSerial");
}

function lowerLift() {
  console.log("lowering lift");
  socket.emit("lowerLift");
}

function raiseLift() {
  console.log("raising lift");
  socket.emit("raiseLift");
}

function endMatch() {
  console.log("ending match");
  socket.emit("endMatch");
}
