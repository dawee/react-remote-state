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
  rejoinEventValidator,
  RejoinEvent,
} from "@react-remote-state/types";
import { Server as IOServer } from "socket.io";
import ShortUniqueId from "short-unique-id";
import * as t from "io-ts";
import { Logger } from "pino";
import { Database } from "./Database";

const uid = new ShortUniqueId({ length: 10 });

export default class Socket {
  client: IOSocket;
  io: IOServer;
  gameId: string | null;
  playerId: string | null;
  logger: Logger<never, boolean>;
  database: Database;

  constructor(
    io: IOServer,
    client: IOSocket,
    database: Database,
    rootLogger: Logger<never, boolean>
  ) {
    this.io = io;
    this.client = client;
    this.database = database;
    this.gameId = null;
    this.playerId = null;
    this.logger = rootLogger.child({ clientId: client.id });
  }

  private async onCreate(): Promise<void> {
    this.logger.debug("create game");
    this.playerId = uid.rnd();
    this.gameId = uid.rnd();

    this.logger = this.logger.child({
      playerId: this.playerId,
      gameId: this.gameId,
    });

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

    await this.database.saveGame(serverGame);

    this.client.join(`game-${serverGame.game.id}`);
    this.client.emit("update", serverUpdate);

    this.client.emit("assign", {
      playerId: this.playerId,
      gameId: serverGame.game.id,
    });

    this.logger.debug("game created");
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
      [serverGame, hostSocketId] = await this.database.getGame(
        joinEvent.gameId
      );
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    serverGame.playersQueue[this.playerId] = this.client.id;

    await this.database.saveGame(serverGame);
    this.io.to(hostSocketId).emit("join", { playerId: this.playerId });
    this.client.emit("assign", {
      playerId: this.playerId,
      gameId: serverGame.game.id,
    });
    this.gameId = joinEvent.gameId;

    this.logger = this.logger.child({
      playerId: this.playerId,
      gameId: this.gameId,
    });

    this.logger.debug("join game request sent");
  }

  private async onRejoin(data: unknown): Promise<void> {
    let decoded = rejoinEventValidator.decode(data);

    if (isLeft(decoded)) {
      this.client.emit(
        "error",
        `Invalid request: ${PathReporter.report(decoded).join("\n")}`
      );
      return;
    }

    let rejoinEvent: RejoinEvent = decoded.right;
    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.database.getGame(
        rejoinEvent.gameId
      );
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    let player = serverGame.game.players.find(
      (p) => p.id == rejoinEvent.playerId
    );

    if (!player) {
      this.client.emit("error", "Player doesn't exist in that game");

      return;
    }

    if (serverGame.playerSocketIds[player.id] != rejoinEvent.socketId) {
      this.client.emit("error", "Player socket id is incorrect");

      return;
    }

    this.gameId = rejoinEvent.gameId;
    this.playerId = rejoinEvent.playerId;

    this.logger = this.logger.child({
      playerId: this.playerId,
      gameId: this.gameId,
    });

    serverGame.playerSocketIds[player.id] = this.client.id;
    serverGame.game.players = serverGame.game.players.map((p) =>
      p.id == player.id ? { ...p, connected: true } : p
    );

    await this.database.saveGame(serverGame);

    let serverUpdate: ServerUpdateEvent<unknown, unknown> = {
      playerId: this.playerId,
      game: serverGame.game,
    };

    this.client.join(`game-${serverGame.game.id}`);

    this.client.emit("assign", {
      playerId: this.playerId,
      gameId: this.gameId,
    });

    this.io.to(`game-${serverGame.game.id}`).emit("update", serverUpdate);
    this.logger.debug("game rejoined");
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

    this.logger.debug(
      { incommingPlayerId: acceptEvent.playerId },
      "accepting new player"
    );

    try {
      [serverGame, hostSocketId] = await this.database.getGame(
        acceptEvent.gameId
      );
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

    await this.database.saveGame(serverGame);
    this.io.to(joiningPlayerSocketId).socketsJoin(`game-${serverGame.game.id}`);

    let serverUpdate: ServerUpdateEvent<unknown, unknown> = {
      playerId: acceptEvent.playerId,
      game: serverGame.game,
    };

    this.io.to(`game-${serverGame.game.id}`).emit("update", serverUpdate);

    this.logger.debug("new player accepted");
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
      [serverGame, hostSocketId] = await this.database.getGame(
        declineEvent.gameId
      );
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

    await this.database.saveGame(serverGame);

    this.io
      .to(joiningPlayerSocketId)
      .emit("decline", { gameId: serverGame.game.id });

    this.logger.debug("new player declined");
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
      [serverGame, hostSocketId] = await this.database.getGame(
        notifyEvent.gameId
      );
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

    this.logger.debug("notify action");
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
      [serverGame, hostSocketId] = await this.database.getGame(
        updateEvent.game.id
      );
    } catch (error) {
      this.client.emit("error", (error as Error).message);
      return;
    }

    if (hostSocketId != this.client.id) {
      this.client.emit("error", "Only host can update state");
      return;
    }

    serverGame.game = updateEvent.game;

    await this.database.saveGame(serverGame);

    this.io.to(`game-${serverGame.game.id}`).emit("update", updateEvent);
    this.logger.debug("update sent to all players");
  }

  private async disconnect() {
    if (!this.playerId || !this.gameId) {
      return;
    }

    let serverGame, hostSocketId;

    try {
      [serverGame, hostSocketId] = await this.database.getGame(this.gameId);
    } catch (error) {
      return;
    }

    serverGame.game.players = serverGame.game.players.map((player) =>
      player.id == this.playerId ? { ...player, connected: false } : player
    );

    await this.database.saveGame(serverGame);

    let updateEvent: UpdateEvent<unknown, unknown> = {
      game: serverGame.game,
    };

    this.io.to(`game-${serverGame.game.id}`).emit("update", updateEvent);
    this.client.removeAllListeners();
    this.logger.debug("player disconnected");
  }

  public bind() {
    this.client.on("create", () => this.onCreate());
    this.client.on("join", (data: unknown) => this.onJoin(data));
    this.client.on("rejoin", (data: unknown) => this.onRejoin(data));
    this.client.on("accept", (data: unknown) => this.onAccept(data));
    this.client.on("decline", (data: unknown) => this.onDecline(data));
    this.client.on("notify", (data: unknown) => this.onNotify(data));
    this.client.on("update", (data: unknown) => this.onUpdate(data));
    this.client.on("disconnect", () => this.disconnect());
  }
}
