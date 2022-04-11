const express = require("express");
const app = express();

let broadcaster;
const port = 30120;
let queue = []

const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server);
app.use(express.static(__dirname + "/public"));

const checkQueueStatus = (socket) => {
  if (queue.length >= 2) {
    console.log("starting game")
    socket.to(broadcaster).emit("watcher", queue.shift());  // send video to first client
    socket.to(broadcaster).emit("watcher", queue.shift());  // send video to first client
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
    // TODO need to check if user is in queue and kick them
  });

  socket.on("join_queue", () => {
    if (!queue.includes(socket.id)) {
      console.log(`Adding user to queue ${socket.id}`)
      queue.push(socket.id)
    }

    checkQueueStatus(socket)  // check the status of the queue
  })
  socket.on("control_command", (message) => {
    console.log(`${socket.id}: sent ${message}`);
  })
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
