var http = require("http");
var https = require("https");
var fs = require("fs");
var index = fs.readFileSync("downtime.html");

var counter = 0;

http
  .createServer(function (req, res) {
    if (req.url === "/") {
      console.log(`Requests: ${++counter}`);
    }
    res.end(index);
  })
  .listen(80);

var options = {
  key: fs.readFileSync("keys/olliepugh_com.key"),
  cert: fs.readFileSync("keys/olliepugh_com.crt"),
};

https
  .createServer(options, function (req, res) {
    if (req.url === "/") {
      console.log(`Requests: ${++counter}`);
    }
    res.end(index);
  })
  .listen(443);
