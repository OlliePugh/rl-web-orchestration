var http = require("http");
var https = require("https");
var fs = require("fs");
var index = fs.readFileSync("downtime.html");

http
  .createServer(function (req, res) {
    res.end(index);
  })
  .listen(80);

var options = {
  key: fs.readFileSync("keys/olliepugh_com.key"),
  cert: fs.readFileSync("keys/olliepugh_com.crt"),
};

https
  .createServer(options, function (req, res) {
    res.end(index);
  })
  .listen(443);
