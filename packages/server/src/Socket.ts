import { Socket as IOSocket } from "socket.io";
import { PathReporter } from "io-ts/PathReporter";
import { isLeft } from "fp-ts/Either";
import Catbox from "@hapi/catbox";
import {
  ServerGame,
  StartResponse,
  joinEventValidator,
  JoinEvent,
  acceptEventValidator,
  AcceptEvent,
} from "./types";
import { Server as IOServer } from "socket.io";
import ShortUniqueId from "short-unique-id";

const uid = new ShortUniqueId({ length: 10 });

export default class Socket {
  client: IOSocket;
  cache: Catbox.Client<any>;
  io: IOServer;

  constructor(io: IOServer, client: IOSocket, cache: Catbox.Client<any>) {
    this.io = io;
    this.client = client;
    this.cache = cache;
  }

  private async getGame(
    gameId: string
  ): Promise<[serverGame: ServerGame, hostSocketId: string]> {
    let rawGame = await this.cache.get({
      id: gameId,
      segment: "game",
    });

    if (rawGame == null) {
      throw new Error(`Unknown game id: "${gameId}"`);
    }

    let serverGame: ServerGame = JSON.parse(rawGame.item);
    let hostPlayer = serverGame.game.players.find((player) => player.host);

    if (hostPlayer == undefined) {
      throw new Error("Game has no host");
    }

    let hostSocketId =
      hostPlayer.id in serverGame.playerSocketIds
        ? serverGame.playerSocketIds[hostPlayer.id]
        : null;

    if (hostSocketId == null) {
      throw new Error("Host socket id is not stored");
    }

    return [serverGame, hostSocketId];
  }

  private async onCreate(): Promise<void> {
    let playerId = uid.rnd();
    let serverGame: ServerGame = {
      game: {
        id: uid.rnd(),
        players: [
          {
            id: playerId,
            host: true,
          },
        ],
      },
      playerSocketIds: {
        [playerId]: this.client.id,
      },
      playersQueue: {},
    };

    let response: StartResponse = {
      playerId,
      game: serverGame.game,
    };

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.client.join(`game-${serverGame.game.id}`);
    this.client.emit("start", response);
  }

  private async onJoin(data: unknown): Promise<void> {
    console.log("onJoin");
    let playerId = uid.rnd();
    let decoded = joinEventValidator.decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let joinEvent: JoinEvent = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(joinEvent.gameId);
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    serverGame.playersQueue[playerId] = this.client.id;

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io.to(hostSocketId).emit("join", { playerId });
  }

  private async onAccept(data: unknown): Promise<void> {
    console.log("onAccept");

    let decoded = acceptEventValidator.decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let acceptEvent: AcceptEvent = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(acceptEvent.gameId);
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    if (hostSocketId != this.client.id) {
      this.client.emit("error", "Only host can accept new player");
      return;
    }

    let joiningPlayerSocketId =
      acceptEvent.playerId in serverGame.playersQueue
        ? serverGame.playersQueue[acceptEvent.playerId]
        : null;

    if (joiningPlayerSocketId == null) {
      this.client.emit("error", "Cannot find player in queue");
      return;
    }

    serverGame.game.players.push({ id: acceptEvent.playerId, host: false });
    serverGame.playerSocketIds[acceptEvent.playerId] = joiningPlayerSocketId;
    delete serverGame.playersQueue[acceptEvent.playerId];

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io.to(joiningPlayerSocketId).socketsJoin(`game-${serverGame.game.id}`);
    this.io.to(`game-${serverGame.game.id}`).emit("update", serverGame.game);
  }

  public bind() {
    this.client.on("create", () => this.onCreate());
    this.client.on("join", (data: unknown) => this.onJoin(data));
    this.client.on("accept", (data: unknown) => this.onAccept(data));
  }
}