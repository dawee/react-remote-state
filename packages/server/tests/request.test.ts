import { expect, test, beforeEach, afterEach, assert } from "vitest";
import Server from "../src/Server";
import { io as ioc, type Socket as Client } from "socket.io-client";
import { Game } from "../src/types";

let server: Server;

function createClient() {
  return new Promise<Client>((done) => {
    let client: Client = ioc(`http://localhost:${server.port}`);

    client.on("connect", () => done(client));
    client.on("error", (error) => console.error(error));
  });
}

beforeEach(
  () =>
    new Promise<void>((done) => {
      server = new Server();
      server.start(done);
    })
);

afterEach(async () => {
  await server.stop();
});

test("create game", () =>
  new Promise<void>(async (done) => {
    let host = await createClient();

    host.on("start", (response) => {
      expect(response.playerId).toBeTypeOf("string");
      expect(response.game.players[0].id).toBeTypeOf("string");
      expect(response.game.players[0].host).toBe(true);
      done();
    });

    host.emit("create");
  }));

test("join game: accept", () =>
  new Promise<void>(async (done) => {
    let game: Game;
    let host = await createClient();
    let joiningPlayer = await createClient();

    host.on("start", (start) => {
      game = start.game as Game;
      joiningPlayer.emit("join", { gameId: game.id });
    });

    host.on("join", (join) => {
      host.emit("accept", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("update", (game) => {
      expect(game.players.length).toBe(2);
      done();
    });

    host.emit("create");
  }));

test("join game: decline", () =>
  new Promise<void>(async (done) => {
    let game: Game;
    let host = await createClient();
    let joiningPlayer = await createClient();

    host.on("start", (start) => {
      game = start.game as Game;
      joiningPlayer.emit("join", { gameId: game.id });
    });

    host.on("join", (join) => {
      host.emit("decline", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("decline", () => {
      done();
    });

    host.emit("create");
  }));
