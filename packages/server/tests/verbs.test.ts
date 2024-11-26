import { expect, test, beforeEach, afterEach, vi } from "vitest";
import Server from "../src/Server";
import { io as ioc, type Socket as Client } from "socket.io-client";
import { Game, UpdateEvent } from "@react-remote-state/types";

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

    host.on("update", (response) => {
      expect(response.playerId).toBeTypeOf("string");
      expect(response.game.players[0].id).toBeTypeOf("string");
      expect(response.game.players[0].host).toBe(true);
      done();
    });

    host.emit("create");
  }));

test("join game: accept", () =>
  new Promise<void>(async (done) => {
    let game: Game<any, any>;
    let host = await createClient();
    let joiningPlayer = await createClient();

    host.on("update", (update) => {
      if (!game) {
        game = update.game as Game<any, any>;
        joiningPlayer.emit("join", { gameId: game.id });
      }
    });

    host.on("join", (join) => {
      host.emit("accept", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("update", (update) => {
      expect(update.game.players.length).toBe(2);
      done();
    });

    host.emit("create");
  }));

test("join game: decline", () =>
  new Promise<void>(async (done) => {
    let game: Game<any, any>;
    let host = await createClient();
    let joiningPlayer = await createClient();

    host.on("update", (update) => {
      if (!game) {
        game = update.game as Game<any, any>;
        joiningPlayer.emit("join", { gameId: game.id });
      }
    });

    host.on("join", (join) => {
      host.emit("decline", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("decline", () => {
      done();
    });

    host.emit("create");
  }));

test("notify action", () =>
  new Promise<void>(async (done) => {
    let game: Game<any, any>;
    let host = await createClient();
    let joiningPlayer = await createClient();

    host.on("update", (update) => {
      if (!game) {
        game = update.game as Game<any, any>;
        joiningPlayer.emit("join", { gameId: game.id });
      }
    });

    host.on("join", (join) => {
      host.emit("accept", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("update", (update) => {
      joiningPlayer.emit("notify", {
        gameId: game.id,
        action: { type: "foo" },
      });
    });

    host.on("notify", (notify) => {
      expect(notify.action.type).toBe("foo");
      done();
    });

    host.emit("create");
  }));

test("update state", () =>
  new Promise<void>(async (done) => {
    let game: Game<{ foo: number }, any>;
    let host = await createClient();
    let joiningPlayer = await createClient();
    let updateCount = 0;

    host.on("update", (update) => {
      if (!game) {
        game = update.game as Game<any, any>;
        joiningPlayer.emit("join", { gameId: game.id });
      }
    });

    host.on("join", (join) => {
      host.emit("accept", { playerId: join.playerId, gameId: game.id });
    });

    joiningPlayer.on("update", (update) => {
      updateCount++;

      if (updateCount == 2) {
        expect(update.game?.custom.foo).toBe(42);
        done();
      } else {
        let updateEvent: UpdateEvent<{ foo: number }, any> = {
          gameId: update.game.id,
          gameCustom: { foo: 42 },
          playerCustoms: {},
        };

        host.emit("update", updateEvent);
      }
    });

    host.emit("create");
  }));

test("share player's disconection", async () => {
  let game!: Game<{ foo: number }, any>;
  let host = await createClient();
  let joiningPlayer = await createClient();

  host.on("update", (update) => {
    game = update.game;
  });

  host.on("join", (join) =>
    host.emit("accept", { playerId: join.playerId, gameId: game.id })
  );

  host.emit("create");

  await vi.waitFor(() => expect(game).toBeDefined());

  joiningPlayer.emit("join", { gameId: game.id });

  await vi.waitFor(() => expect(game.players.length).toBe(2));

  joiningPlayer.disconnect();

  await vi.waitFor(() => expect(game.players[1].connected).toBe(false));
});

test("handle player's reconection", async () => {
  let game!: Game<{ foo: number }, any>;
  let host = await createClient();
  let joiningPlayer = await createClient();
  let joiningPlayerSocketId = joiningPlayer.id;
  let reJoiningPlayer = await createClient();

  host.on("update", (update) => {
    game = update.game;
  });

  host.on("join", (join) =>
    host.emit("accept", { playerId: join.playerId, gameId: game.id })
  );

  host.emit("create");

  await vi.waitFor(() => expect(game).toBeDefined());

  joiningPlayer.emit("join", { gameId: game.id });

  await vi.waitFor(() => expect(game.players.length).toBe(2));

  joiningPlayer.disconnect();

  await vi.waitFor(() => expect(game.players[1].connected).toBe(false));

  reJoiningPlayer.emit("rejoin", {
    gameId: game.id,
    playerId: game.players[1].id,
    socketId: joiningPlayerSocketId,
  });

  await vi.waitFor(() => expect(game.players[1].connected).toBe(true));
});
