import {
  Server as IOServer,
  ServerOptions as IOServerOptions,
} from "socket.io";

interface ServerOptions {
  port: number;
  io?: IOServerOptions;
}

export default class Server {
  options: ServerOptions;
  io: IOServer;

  constructor(options: ServerOptions) {
    this.options = options;
    this.io = new IOServer(options.io);
  }

  public run() {
    this.io.listen(this.options.port);
  }
}
