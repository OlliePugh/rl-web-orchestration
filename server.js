const express = require("express");
const app = express();
const adminInfo = require("./admin-details")

let broadcaster;
const port = 30120;
let queue = []

const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server);

// setup routing
app.use(express.static(__dirname + "/public"));
app.use((req, res, next) => {
  const auth = {
    login: adminInfo.username,
    password: adminInfo.password
  }
  const [, b64auth = ''] = (req.headers.authorization || '').split(' ')
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')
  if (login && password && login === auth.login && password === auth.password) {
    return next()
  }
  res.set('WWW-Authenticate', 'Basic realm="401"')
  res.status(401).send('Authentication required.')
})
app.use(express.static(__dirname + "/admin"));

const checkQueueStatus = (socket) => {
  socket.to(broadcaster).emit("queueSize", queue.length)
  if (queue.length >= 2) {  // TODO make sure that a game is not currently in progress
    socket.to(broadcaster).emit("watcher", queue[0]);  // send video to first client
    socket.to(broadcaster).emit("watcher", queue[1]);  // send video to second client
    removeFromQueue(socket, queue[0])
    removeFromQueue(socket, queue[0])
    console.log(`Start game: ${queue[0]} vs ${queue[1]}`)
  }
}

const removeFromQueue = (socket, clientId) => {
  if (queue.includes(clientId)) {
    console.log(`Removing user from queue ${clientId}`)
    queue = queue.filter(item => item != clientId)
    socket.to(broadcaster).emit("queueSize", queue.length)
  }
}

io.sockets.on("error", e => console.log(e));
io.sockets.on("connection", socket => {
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
    socket.to(broadcaster).emit("disconnectPeer", socket.id);
    removeFromQueue(socket, socket.id)
  });
  socket.on("getQueueSize", () => {
    socket.emit("queueSize", queue.length)
  })

  socket.on("join_queue", () => {
    if (!queue.includes(socket.id)) {
      console.log(`Adding user to queue ${socket.id}`)
      queue.push(socket.id)
    }

    checkQueueStatus(socket)  // check the status of the queue
  })

  socket.on("leave_queue", () => {
    removeFromQueue(socket, socket.id);
  })

  socket.on("control_command", (message) => {
    console.log(`${socket.id}: sent ${message}`);
  })
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
