import { createServer, Server as HTTPServer } from "http";
import Catbox from "@hapi/catbox";
import { Engine as CatboxMemory } from "@hapi/catbox-memory";
import { type AddressInfo } from "node:net";
import {
  Server as IOServer,
  ServerOptions as IOServerOptions,
} from "socket.io";
import Socket from "./Socket";

interface ServerOptions {
  port?: number;
  io?: IOServerOptions;
}

export default class Server {
  options?: ServerOptions;
  io: IOServer;
  httpServer: HTTPServer;
  cache: Catbox.Client<any>;

  constructor(options?: ServerOptions) {
    this.cache = new Catbox.Client(CatboxMemory);
    this.options = options;
    this.httpServer = createServer();
    this.io = new IOServer(this.httpServer, options?.io);
  }

  public get port(): number {
    return (this.httpServer.address() as AddressInfo).port;
  }

  public async start(callback?: () => any) {
    await this.cache.start();

    this.io.on("connection", (client) => {
      let socket = new Socket(this.io, client, this.cache);

      socket.bind();
    });

    if (!!this.options?.port) {
      this.httpServer.listen(this.options.port, callback);
    } else {
      this.httpServer.listen(callback);
    }
  }

  public async stop() {
    await this.cache.stop();
    this.httpServer.close();
  }
}
