const { Server } = require("../dist");

let server = new Server({ port: 4000 });

server.start(() => {
  console.log("Server started on port 4000");
});
