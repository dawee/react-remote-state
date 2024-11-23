import { Socket as IOSocket } from "socket.io";
import { PathReporter } from "io-ts/PathReporter";
import { isLeft } from "fp-ts/Either";
import Catbox from "@hapi/catbox";
import {
  ServerGame,
  joinEventValidator,
  JoinEvent,
  acceptEventValidator,
  AcceptEvent,
  declineEventValidator,
  DeclineEvent,
  NotifyEvent,
  notifyEventValidator,
  updateEventValidator,
  UpdateEvent,
  ServerUpdateEvent,
} from "@react-remote-state/types";
import { Server as IOServer } from "socket.io";
import ShortUniqueId from "short-unique-id";
import * as t from "io-ts";

const uid = new ShortUniqueId({ length: 10 });

export default class Socket {
  client: IOSocket;
  cache: Catbox.Client<any>;
  io: IOServer;
  gameId: string | null;
  playerId: string | null;

  constructor(io: IOServer, client: IOSocket, cache: Catbox.Client<any>) {
    this.io = io;
    this.client = client;
    this.cache = cache;
    this.gameId = null;
    this.playerId = null;
  }

  private async getGame(
    gameId: string
  ): Promise<[serverGame: ServerGame<unknown, unknown>, hostSocketId: string]> {
    let rawGame = await this.cache.get({
      id: gameId,
      segment: "game",
    });

    if (rawGame == null) {
      throw new Error(`Unknown game id: "${gameId}"`);
    }

    let serverGame: ServerGame<unknown, unknown> = JSON.parse(rawGame.item);
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
    this.playerId = uid.rnd();
    this.gameId = uid.rnd();

    let serverGame: ServerGame<unknown, unknown> = {
      game: {
        id: this.gameId,
        players: [
          {
            id: this.playerId,
            host: true,
            connected: true,
            custom: undefined,
          },
        ],
        custom: undefined,
      },
      playerSocketIds: {
        [this.playerId]: this.client.id,
      },
      playersQueue: {},
    };

    let serverUpdate: ServerUpdateEvent<unknown, unknown> = {
      playerId: this.playerId,
      game: serverGame.game,
    };

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.client.join(`game-${serverGame.game.id}`);
    this.client.emit("update", serverUpdate);
    this.client.emit("assign", { playerId: this.playerId });
  }

  private async onJoin(data: unknown): Promise<void> {
    this.playerId = uid.rnd();
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

    serverGame.playersQueue[this.playerId] = this.client.id;

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io.to(hostSocketId).emit("join", { playerId: this.playerId });
    this.client.emit("assign", { playerId: this.playerId });
    this.gameId = joinEvent.gameId;
  }

  private async onAccept(data: unknown): Promise<void> {
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

    serverGame.game.players.push({
      id: acceptEvent.playerId,
      host: false,
      custom: undefined,
      connected: true,
    });

    serverGame.playerSocketIds[acceptEvent.playerId] = joiningPlayerSocketId;
    delete serverGame.playersQueue[acceptEvent.playerId];

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io.to(joiningPlayerSocketId).socketsJoin(`game-${serverGame.game.id}`);

    let serverUpdate: ServerUpdateEvent<unknown, unknown> = {
      playerId: acceptEvent.playerId,
      game: serverGame.game,
    };

    this.io.to(`game-${serverGame.game.id}`).emit("update", serverUpdate);
  }

  private async onDecline(data: unknown): Promise<void> {
    let decoded = declineEventValidator.decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let declineEvent: DeclineEvent = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(declineEvent.gameId);
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    let joiningPlayerSocketId =
      declineEvent.playerId in serverGame.playersQueue
        ? serverGame.playersQueue[declineEvent.playerId]
        : null;

    if (joiningPlayerSocketId == null) {
      this.client.emit("error", "Cannot find player in queue");
      return;
    }

    delete serverGame.playersQueue[declineEvent.playerId];

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io
      .to(joiningPlayerSocketId)
      .emit("decline", { gameId: serverGame.game.id });
  }

  private async onNotify(data: unknown): Promise<void> {
    let decoded = notifyEventValidator.decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let notifyEvent: NotifyEvent = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(notifyEvent.gameId);
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    let playerId = Object.keys(serverGame.playerSocketIds).find(
      (playerId) => serverGame.playerSocketIds[playerId] == this.client.id
    );

    if (!playerId) {
      this.client.emit(
        "error",
        "Only accepted players can notify actions to the game"
      );
      return;
    }

    this.io
      .to(hostSocketId)
      .emit("notify", { action: notifyEvent.action, playerId });
  }

  private async onUpdate(data: unknown): Promise<void> {
    let decoded = updateEventValidator(t.unknown, t.unknown).decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let updateEvent: UpdateEvent<unknown, unknown> = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(updateEvent.game.id);
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    if (hostSocketId != this.client.id) {
      this.client.emit("error", "Only host can update state");
      return;
    }

    serverGame.game = updateEvent.game;

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    this.io.to(`game-${serverGame.game.id}`).emit("update", updateEvent);
  }

  private async disconnect() {
    if (!this.playerId || !this.gameId) {
      return;
    }

    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.getGame(this.gameId);
    } catch (error) {
      return;
    }

    serverGame.game.players = serverGame.game.players.map((player) =>
      player.id == this.playerId ? { ...player, connected: false } : player
    );

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    let updateEvent: UpdateEvent<unknown, unknown> = {
      game: serverGame.game,
    };

    this.io.to(`game-${serverGame.game.id}`).emit("update", updateEvent);
  }

  public bind() {
    this.client.on("create", () => this.onCreate());
    this.client.on("join", (data: unknown) => this.onJoin(data));
    this.client.on("accept", (data: unknown) => this.onAccept(data));
    this.client.on("decline", (data: unknown) => this.onDecline(data));
    this.client.on("notify", (data: unknown) => this.onNotify(data));
    this.client.on("update", (data: unknown) => this.onUpdate(data));
    this.client.on("disconnect", () => this.disconnect());
  }
}
