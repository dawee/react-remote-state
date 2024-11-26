import { createClient, RedisClientType } from "redis";
import { ServerGame } from "./types";

const GAME_EXPIRATION = 3600;
const LOCK_EXPIRATION = 30;

export class Database {
  client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env["REDIS_URL"],
    });
  }

  async connect() {
    await this.client.connect();
  }

  async getGame(
    id: string
  ): Promise<[serverGame: ServerGame<unknown, unknown>, hostSocketId: string]> {
    let gameKey = `game-${id}`;
    let rawGame = await this.client.get(gameKey);

    if (rawGame == null) {
      throw new Error(`Unknown game id: "${id}"`);
    }

    let serverGame: ServerGame<unknown, unknown> = JSON.parse(rawGame);
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

  async saveGame(serverGame: ServerGame<unknown, unknown>) {
    let gameKey = `game-${serverGame.game.id}`;

    await this.client.set(gameKey, JSON.stringify(serverGame));
    await this.client.expire(gameKey, GAME_EXPIRATION);
  }
}
