import { expect, test, beforeEach, afterEach, assert } from "vitest";
import Server from "../src/Server";
import { io as ioc, type Socket as Client } from "socket.io-client";
import { Game } from "../src/types";

let server: Server, client: Client;

beforeEach(
  () =>
    new Promise<void>((done) => {
      server = new Server();
      server.start(() => {
        client = ioc(`http://localhost:${server.port}`);
        client.on("connect", done);
      });
    })
);

afterEach(async () => {
  client.disconnect();
  await server.stop();
});

test("response is not ok if request type is unknown", () =>
  new Promise<void>((done) => {
    client.on("response", (response) => {
      expect(response.ok).toBe(false);
      done();
    });

    client.emit("request", { type: "foo" });
  }));

test("create game", () =>
  new Promise<void>((done) => {
    client.on("response", (response) => {
      expect(response.ok).toBe(true);
      expect(response.playerId).toBeTypeOf("string");
      expect(response.game.players[0].id).toBeTypeOf("string");
      expect(response.game.players[0].host).toBe(true);
      done();
    });

    client.emit("request", { type: "create-game" });
  }));

test("join game", () =>
  new Promise<void>((done) => {
    let game: Game | null = null;

    client.on("response", (response) => {
      if (game == null) {
        game = response.game as Game;
        client.emit("request", { type: "join-game", gameId: game.id });
      } else {
        expect(response.ok).toBe(true);
        expect(response.playerId).toBeTypeOf("string");
        expect(response.game.players[1].id).toBeTypeOf("string");
        expect(response.game.players[1].host).toBe(false);
        done();
      }
    });

    client.emit("request", { type: "create-game" });
  }));
