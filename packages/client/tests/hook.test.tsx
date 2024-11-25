import MutationObserver from "@sheerun/mutationobserver-shim";
import { expect, test, beforeEach, afterEach, vi } from "vitest";
import { Server } from "@react-remote-state/server";
import { render, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { useRemoteReducer } from "../src";
import { Socket as Client } from "socket.io-client";
import socket from "../src/socket";
import { Game } from "@react-remote-state/types";
import { noop } from "lodash";

let server: Server;

global.MutationObserver = MutationObserver;

function createSessionStorage(): Storage {
  let storage: Record<string, string> = {};

  return {
    setItem(key: string, value: string) {
      storage[key] = value;
    },
    getItem(key: string) {
      return storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    clear() {
      storage = {};
    },
    removeItem(key: string) {
      delete storage[key];
    },
    key(index) {
      return Object.keys(storage)[index];
    },
  };
}

beforeEach(
  () =>
    new Promise<void>((done) => {
      server = new Server();
      global.sessionStorage = createSessionStorage();
      server.start(done);
    })
);

afterEach(async () => {
  await server.stop();
});

function TestComponent<Data>(props: {
  onUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  gameId?: string;
  initialAction?: Data;
}) {
  let { onUpdate = noop, initialAction, gameId } = props;
  let [initialActionSent, setInitialActionSent] = useState(false);
  let [game, playerId, dispatch] = useRemoteReducer<Data, Data, Data>(
    `http://localhost:${server.port}`,
    (game, action, playerId) => ({ ...game, custom: action }),
    gameId
  );

  useEffect(() => {
    if (!!game && !!playerId) {
      onUpdate(game, playerId);

      if (!initialActionSent && !!initialAction) {
        dispatch(initialAction);
        setInitialActionSent(true);
      }
    }
  });

  return <></>;
}

function LinkerComponent<Data>(props: {
  onHostUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  onGuestUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  initialAction?: Data;
}) {
  let { onHostUpdate = noop, onGuestUpdate = noop, initialAction } = props;
  let [game, setGame] = useState<Game<Data, Data> | undefined>();

  function handleHostConnected(hostGame: Game<Data, Data>, playerId: string) {
    setGame(hostGame);
    onHostUpdate(hostGame, playerId);
  }

  return (
    <>
      <TestComponent key="host" onUpdate={handleHostConnected} />
      {!!game && (
        <TestComponent
          key="guest"
          onUpdate={onGuestUpdate}
          gameId={game.id}
          initialAction={initialAction}
        />
      )}
    </>
  );
}

test("create game when no gameId is provided", async () => {
  let game!: Game<number, number>;

  let onUpdate = vi.fn(
    (hostGame: Game<number, number>, playerId: string) => (hostGame = game)
  );

  render(<TestComponent onUpdate={onUpdate} />);

  await waitFor(() => expect(onUpdate).toBeCalled());

  expect(onUpdate.mock?.lastCall?.[0]?.id).toBeTypeOf("string");
  expect(onUpdate.mock?.lastCall?.[0]?.players.length).toBe(1);
});

test("join game when gameId is provided", async () => {
  let onHostUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );
  let onGuestUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );

  render(
    <LinkerComponent
      onHostUpdate={onHostUpdate}
      onGuestUpdate={onGuestUpdate}
    />
  );

  await waitFor(() => expect(onGuestUpdate).toBeCalled());

  expect(onGuestUpdate.mock?.lastCall?.[0]?.id).toBeTypeOf("string");
  expect(onGuestUpdate.mock?.lastCall?.[0]?.id).toBe(
    onHostUpdate.mock?.lastCall?.[0]?.id
  );
  expect(onGuestUpdate.mock?.lastCall?.[0]?.players.length).toBe(2);
  expect(onGuestUpdate.mock.lastCall?.[1]).toBeDefined();
  expect(onHostUpdate.mock.lastCall?.[1]).toBeDefined();
  expect(onHostUpdate.mock.lastCall?.[1]).not.toBe(
    onGuestUpdate.mock.lastCall?.[1]
  );
});

test("host runs reducer from notified action", async () => {
  let onHostUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );
  let onGuestUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );

  render(
    <LinkerComponent
      onHostUpdate={onHostUpdate}
      onGuestUpdate={onGuestUpdate}
      initialAction={42}
    />
  );

  await waitFor(() => {
    expect(onGuestUpdate.mock?.lastCall?.[0]?.custom).toBeDefined();
    expect(onHostUpdate.mock?.lastCall?.[0]?.custom).toBeDefined();
  });

  expect(onGuestUpdate.mock?.lastCall?.[0]?.custom).toBe(42);
  expect(onHostUpdate.mock?.lastCall?.[0]?.custom).toBe(42);
  expect(onHostUpdate.mock?.lastCall?.[0]?.players.length).toBe(2);
});
