import { Socket as IOSocket } from "socket.io";
import { PathReporter } from "io-ts/PathReporter";
import { isLeft } from "fp-ts/Either";
import Catbox from "@hapi/catbox";
import {
  Response,
  ServerGame,
  JoinGameResponse,
  Request,
  RequestT,
} from "./types";
import ShortUniqueId from "short-unique-id";

const uid = new ShortUniqueId({ length: 10 });

export default class Socket {
  client: IOSocket;
  cache: Catbox.Client<any>;

  constructor(client: IOSocket, cache: Catbox.Client<any>) {
    this.client = client;
    this.cache = cache;
  }

  private async createJoinGameResponse(
    playerId: string,
    serverGame: ServerGame
  ): Promise<JoinGameResponse> {
    let joinGameResponse: JoinGameResponse = {
      ok: true,
      playerId,
      game: serverGame.game,
    };

    await this.cache.set(
      { id: serverGame.game.id, segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    return joinGameResponse;
  }

  private async createGame(): Promise<Response> {
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
    };

    return await this.createJoinGameResponse(playerId, serverGame);
  }

  private async joinGame(id: string): Promise<Response> {
    let data = await this.cache.get({ id, segment: "game" });

    if (data == null) {
      return {
        ok: false,
        message: "Game doesn't exist",
      };
    }

    let serverGame: ServerGame = JSON.parse(data.item);
    let playerId = uid.rnd();

    serverGame = {
      ...serverGame,
      game: {
        ...serverGame.game,
        players: [...serverGame.game.players, { id: playerId, host: false }],
      },
    };

    return await this.createJoinGameResponse(playerId, serverGame);
  }

  public async handleRequest(data: unknown): Promise<Response> {
    let decoded = Request.decode(data);

    if (isLeft(decoded)) {
      return {
        ok: false,
        message: `Invalid request: ${PathReporter.report(decoded).join("\n")}`,
      };
    }

    let decodedRequest: RequestT = decoded.right;

    switch (decodedRequest.type) {
      case "create-game":
        return await this.createGame();
      case "join-game":
        return await this.joinGame(decodedRequest.gameId);
    }
  }

  public bind() {
    this.client.on("request", async (data: unknown) =>
      this.client.emit("response", await this.handleRequest(data))
    );
  }
}
