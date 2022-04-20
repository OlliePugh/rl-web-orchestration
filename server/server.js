const express = require("express");
const app = express();
const adminInfo = require("../admin-details");
const { SerialPort, ReadlineParser } = require("serialport");
const { serialHandler, dispatchControlState } = require("./serial-handler");

const resetControlsState = () => {
  controllerState = [
    {
      N: false,
      E: false,
      S: false,
      W: false,
    },
    {
      N: false,
      E: false,
      S: false,
      W: false,
    },
  ];
};

let broadcaster;
const port = 30120;
let serialPort;
let queue = [];

const http = require("http");
const e = require("express");
const server = http.createServer(app);

const io = require("socket.io")(server);

let currentMatch = [];
let controllerState;
resetControlsState();

// setup routing
app.use(express.static(`${__dirname}/../public`));
app.use((req, res, next) => {
  const auth = {
    login: adminInfo.username,
    password: adminInfo.password,
  };
  const [, b64auth = ""] = (req.headers.authorization || "").split(" ");
  const [login, password] = Buffer.from(b64auth, "base64")
    .toString()
    .split(":");
  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="401"');
  res.status(401).send("Authentication required.");
});
app.use(express.static(`${__dirname}/../admin`));

const checkQueueStatus = (socket) => {
  socket.to(broadcaster).emit("queueSize", queue.length);
  if (queue.length >= 2) {
    // TODO make sure that a game is not currently in progress
    startMatch(socket, queue[0], queue[1]);
  }
};

const startMatch = (socket, player1, player2) => {
  socket.to(broadcaster).emit("watcher", player1); // send video to first client
  socket.to(broadcaster).emit("watcher", player2); // send video to second client
  console.log(`Starting game: ${player1}} vs ${player2}`);
  removeFromQueue(socket, queue[0]);
  removeFromQueue(socket, queue[0]);
  currentMatch = [player1, player2];
};

const endMatch = () => {
  currentMatch = [];
  resetControlsState();
  dispatchControlState(serialPort, controllerState); // tell the arena to kill all movement (even though it should of already done it)
};

const removeFromQueue = (socket, clientId) => {
  if (queue.includes(clientId)) {
    console.log(`Removing user from queue ${clientId}`);
    queue = queue.filter((item) => item != clientId);
    socket.to(broadcaster).emit("queueSize", queue.length);
  }
};

io.sockets.on("error", (e) => console.log(e));
io.sockets.on("connection", (socket) => {
  socket.on("broadcaster", () => {
    broadcaster = socket.id;
    socket.broadcast.emit("broadcaster");
  });
  socket.on("offer", (id, message) => {
    socket.to(id).emit("offer", socket.id, message);
  });
  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
  });
  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });
  socket.on("disconnect", () => {
    if (socket.id === broadcaster) {
      broadcaster = null;
    }
    socket.to(broadcaster).emit("disconnectPeer", socket.id);
    removeFromQueue(socket, socket.id);
  });
  socket.on("getQueueSize", () => {
    socket.emit("queueSize", queue.length);
  });
  socket.on("listSerial", async () => {
    console.log(await SerialPort.list())
    if (socket.id === broadcaster || !broadcaster) {
      socket.emit("serialList", await SerialPort.list());
    }
    else {
      console.log("non admin requested serial list")
    }
  });
  socket.on("join_queue", () => {
    if (!queue.includes(socket.id)) {
      console.log(`Adding user to queue ${socket.id}`);
      queue.push(socket.id);
    }
    checkQueueStatus(socket); // check the status of the queue
  });
  socket.on("leave_queue", () => {
    removeFromQueue(socket, socket.id);
  });
  socket.on("controlDownCommand", (message) => {
    const playerNum = currentMatch.indexOf(socket.id);
    controllerState[playerNum][message] = true;
    dispatchControlState(serialPort, controllerState);
  });
  socket.on("controlUpCommand", (message) => {
    const playerNum = currentMatch.indexOf(socket.id);
    controllerState[playerNum][message] = false;
    dispatchControlState(serialPort, controllerState);
  });
  socket.on("serialConnect", (path) => {
    if (socket.id === broadcaster || !broadcaster) {
      console.log(`Trying to connect to Serial device at ${path}`);
      serialPort = new SerialPort({ path, baudRate: 57600, autoOpen: false });
      const parser = serialPort.pipe(new ReadlineParser());
      parser.on("data", serialHandler);
      serialPort.on("error", function (err) {
        console.error(err);
      });
      try {
        serialPort.open(() => {
          console.log("Successfully connected to serial device")
        });
      } catch (error) {
        console.error("Failed to connect to serial device");
      }
    }
  });
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
