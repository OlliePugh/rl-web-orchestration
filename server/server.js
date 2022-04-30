const express = require("express");
const app = express();
const adminInfo = require("../admin-details");
const { SerialPort, ReadlineParser } = require("serialport");
const {
  serialHandler,
  dispatchControlState,
  raiseLift,
  lowerLift,
} = require("./serial-handler");

class GameController {
  constructor() {
    this.broadcaster;
    this.queue = [];
    this.premades = new Map();
    this.currentMatch = [];
    this.controllerState;
    this.resetControlsState();
  }

  isGameLive = () => {
    return this.currentMatch.length == 2;
  };

  resetControlsState = () => {
    this.controllerState = [
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

  checkQueueStatus = () => {
    io.sockets.to(this.broadcaster).emit("queueSize", this.queue.length);
    // TODO make sure that a game is not currently in progress

    if (this.isInPremade(this.queue[0])) {
      this.startMatch(this.queue[0], this.premades.get(this.queue[0]));
      return;
    }

    if (this.queue.length >= 2) {
      for (let i = 0; i < this.queue.slice(1).length; i++) {
        // first player is not in premade, therefore look for next non premade player
        const player = this.queue.slice(1)[i];
        if (!this.isInPremade(player)) {
          this.startMatch(this.queue[0], player);
          return;
        }
      }
    }
  };

  startMatch = (player1, player2) => {
    io.sockets.to(this.broadcaster).emit("watcher", player1); // send video to first client
    io.sockets.to(this.broadcaster).emit("watcher", player2); // send video to second client
    io.sockets
      .to(player1)
      .emit("message", "You are the blue car! Score in the left goal!");
    io.sockets
      .to(player2)
      .emit("message", "You are the red car! Score in the right goal!");
    console.log(`Starting game: ${player1} vs ${player2}`);
    this.removeFromQueue(player1);
    this.removeFromQueue(player2);
    this.currentMatch = [player1, player2];
  };

  declareWinner = async (winner, extraMessage = "") => {
    if (this.currentMatch.length != 0) {
      // make sure a game is currently underway
      console.log(`${this.currentMatch[winner - 1]} wins the game!`);
      io.sockets
        .to(this.broadcaster)
        .emit("disconnectPeer", this.currentMatch[0]);
      io.sockets
        .to(this.currentMatch[0])
        .emit(
          "message",
          (winner == 1 ? "You Win!" : "You lost...") + " " + extraMessage
        );
      io.sockets
        .to(this.currentMatch[1])
        .emit(
          "message",
          (winner == 2 ? "You Win!" : "You lost...") + " " + extraMessage
        );
      io.sockets
        .to(this.broadcaster)
        .emit("disconnectPeer", this.currentMatch[1]);
      this.currentMatch = [];
      this.resetControlsState();
      dispatchControlState(serialPort, this.controllerState); // tell the arena to kill all movement (even though it should of already done it)
      this.checkQueueStatus();
    }
  };

  addToQueue = (clientId) => {
    this.queue.push(clientId);
  };

  removeFromQueue = (clientId) => {
    if (this.queue.includes(clientId)) {
      console.log(`Removing user from queue ${clientId}`);
      this.queue = this.queue.filter((item) => item != clientId);
      io.sockets.to(this.broadcaster).emit("queueSize", this.queue.length);
    }
  };

  addToPremades = (lobbyLeader, player) => {
    gameController.premades.set(lobbyLeader, player);
  };

  removePremades = (lobbyLeader) => {
    gameController.premades.delete(lobbyLeader);
  };

  isInPremade = (player) => {
    return (
      this.premades.has(player) ||
      Array.from(this.premades.values()).includes(player)
    );
  };
}

const port = 30120;
let serialPort;

const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);

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

io.sockets.on("error", (e) => console.log(e));
io.sockets.on("connection", (socket) => {
  socket.on("broadcaster", () => {
    gameController.broadcaster = socket.id;
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
    if (socket.id === gameController.broadcaster) {
      broadcaster = null;
    }
    socket.to(gameController.broadcaster).emit("disconnectPeer", socket.id);
    gameController.removeFromQueue(socket.id);
    if (gameController.isInPremade(socket.id)) {
      for (let [lobbyLeader, player] of gameController.premades.entries()) {
        if (lobbyLeader === socket.id) {
          socket.to(player).emit("lobbyDisband");
          gameController.removePremades(lobbyLeader);
          break;
        } else if (player === socket.id) {
          socket.to(lobbyLeader).emit("message", "Player has left lobby");
          gameController.removePremades(lobbyLeader);
          break;
        }
      }
    }

    if (gameController.currentMatch.includes(socket.id)) {
      gameController.declareWinner(
        1 - gameController.currentMatch.indexOf(socket.id) + 1,
        "opponent disconnected"
      ); // opposite player
    }
  });
  socket.on("getQueueSize", () => {
    socket.emit("queueSize", gameController.queue.length);
  });
  socket.on("listSerial", async () => {
    if (
      socket.id === gameController.broadcaster ||
      !gameController.broadcaster
    ) {
      socket.emit("serialList", await SerialPort.list());
    } else {
      console.log("non admin requested serial list");
    }
  });
  socket.on("join_queue", () => {
    if (
      !gameController.queue.includes(socket.id) &&
      !gameController.isInPremade(socket.id)
    ) {
      console.log(`Adding user to queue ${socket.id}`);
      gameController.addToQueue(socket.id);
    }
    gameController.checkQueueStatus(); // check the status of the queue
  });
  socket.on("leave_queue", () => {
    gameController.removeFromQueue(socket, socket.id);
  });
  socket.on("controlDownCommand", (message) => {
    const playerNum = gameController.currentMatch.indexOf(socket.id);
    if (playerNum !== -1) {
      gameController.controllerState[playerNum][message] = true;
      dispatchControlState(serialPort, gameController.controllerState);
    }
  });
  socket.on("controlUpCommand", (message) => {
    const playerNum = gameController.currentMatch.indexOf(socket.id);

    if (playerNum !== -1) {
      gameController.controllerState[playerNum][message] = false;
      dispatchControlState(serialPort, gameController.controllerState);
    }
  });
  socket.on("serialConnect", (path) => {
    if (
      socket.id === gameController.broadcaster ||
      !gameController.broadcaster
    ) {
      console.log(`Trying to connect to Serial device at ${path}`);
      serialPort = new SerialPort({
        path,
        baudRate: 57600,
        autoOpen: false,
      });
      const parser = serialPort.pipe(new ReadlineParser());
      parser.on("data", (content) => {
        serialHandler(content, gameController);
      });
      serialPort.on("error", function (err) {
        console.error(err);
      });
      try {
        serialPort.open(() => {
          console.log("Successfully connected to serial device");
        });
      } catch (error) {
        console.error("Failed to connect to serial device");
      }
    }
  });
  socket.on("lowerLift", () => {
    if (socket.id === gameController.broadcaster) {
      console.log("lowering lift");
      lowerLift(serialPort);
    }
  });
  socket.on("raiseLift", () => {
    if (socket.id === gameController.broadcaster) {
      console.log("raise lift");
      raiseLift(serialPort);
    }
  });
  socket.on("broadcastMessage", (message) => {
    if (socket.id === gameController.broadcaster) {
      console.log(`Broadcasting message: ${message}`);
      socket.broadcast.emit("message", message);
    }
  });
  socket.on("lobbyJoin", (lobbyLeader) => {
    console.log("someone joined lobby");
    if (gameController.isInPremade(lobbyLeader)) {
      socket.emit("message", "Lobby is full!");
      return;
    }
    gameController.addToPremades(lobbyLeader, socket.id); // add this user to the lobby
    socket.emit("message", "Successfully joined lobby");
    socket.to(lobbyLeader).emit("message", "Player joined lobby");
  });

  socket.on("leaveLobby", () => {
    if (gameController.isInPremade(lobbyLeader)) {
      removePremades(lobbyLeader);
      socket.emit("message", "Successfully left lobby");
      socket.to(lobbyLeader).emit("message", "Player has left your lobby");
    }
  });

  socket.on("endMatch", () => {
    if (socket.id === gameController.broadcaster) {
      gameController.declareWinner(1, "Admin has ended the game");
    }
  });
});

const gameController = new GameController();

server.listen(port, () => console.log(`Server is running on port ${port}`));
