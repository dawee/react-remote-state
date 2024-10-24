import { Socket as IOSocket } from "socket.io";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";
import { isLeft } from "fp-ts/Either";
import Catbox from "@hapi/catbox";
import { Response, ServerGame, Game, CreateGameResponse } from "./types";
import ShortUniqueId from "short-unique-id";

const uid = new ShortUniqueId({ length: 10 });

const Request = t.type({
  type: t.literal("create-game"),
});

type RequestT = t.TypeOf<typeof Request>;

export default class Socket {
  client: IOSocket;
  cache: Catbox.Client<any>;

  constructor(client: IOSocket, cache: Catbox.Client<any>) {
    this.client = client;
    this.cache = cache;
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

    let createGameResponse: CreateGameResponse = {
      type: "create-game",
      ok: true,
      playerId,
      game: serverGame.game,
    };

    await this.cache.set(
      { id: "serverGame.game.id", segment: "game" },
      JSON.stringify(serverGame),
      3600000
    );

    return createGameResponse;
  }

  public bind() {
    this.client.on("request", async (data: unknown) =>
      this.client.emit("response", await this.handleRequest(data))
    );
  }
}
