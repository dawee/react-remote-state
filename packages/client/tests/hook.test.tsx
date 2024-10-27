import { expect, test, beforeEach, afterEach, assert } from "vitest";
import { Server } from "@react-remote-state/server";
import { io as ioc, type Socket as Client } from "socket.io-client";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useRemoteReducer } from "../src";

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

test("create game when no gameId is provided", () =>
  new Promise<void>((done) => {
    function ComponentTest() {
      let [game, playerId] = useRemoteReducer(
        `http://localhost:${server.port}`,
        (game, action, playerId) => game
      );

      if (!!game) {
        expect(game.id).toBeTypeOf("string");
        expect(game.players.length).toBe(1);
        done();
      }

      return <div></div>;
    }

    render(<ComponentTest />);
  }));

test("join game when gameId is provided", () =>
  new Promise<void>(async (done) => {
    let gameId: string | undefined = undefined;

    function ComponentTest() {
      let [game, playerId] = useRemoteReducer(
        `http://localhost:${server.port}`,
        (game, action, playerId) => game,
        gameId
      );

      if (!!game) {
        expect(game.id).toBe(gameId);
        expect(game.players.length).toBe(2);
        done();
      }

      return <div></div>;
    }

    let host = await createClient();

    host.on("update", (update) => {
      if (!gameId) {
        gameId = update.game.id;
        render(<ComponentTest />);
      }
    });

    host.on("join", (join) =>
      host.emit("accept", {
        gameId: gameId,
        playerId: join.playerId,
      })
    );

    host.emit("create");
  }));