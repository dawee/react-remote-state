const { Server } = require("../dist");

let server = new Server({ port: 4000, logLevel: "debug" });

server.start(() => {
  console.log("Server started on port 4000");
});
