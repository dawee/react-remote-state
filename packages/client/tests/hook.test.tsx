import MutationObserver from "@sheerun/mutationobserver-shim";
import { expect, test, beforeEach, afterEach, vi, Mock } from "vitest";
import { Server } from "@react-remote-state/server";
import { render, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { useRemoteReducer } from "../src";
import { Socket as Client } from "socket.io-client";
import socket from "../src/socket";
import { Game } from "@react-remote-state/types";
import { noop, constant } from "lodash";

type MockStorage = {
  setItem: Mock<(key: string, value: string) => void>;
  getItem(key: string): string;
  readonly length: number;
  clear(): void;
  removeItem(key: string): void;
  key(index: number): string;
};

let server: Server;
let hostStorage!: MockStorage;
let guestStorage!: MockStorage;

global.MutationObserver = MutationObserver;

function createSessionStorage() {
  let storage: Record<string, string> = {};

  return {
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
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
    key(index: number) {
      return Object.keys(storage)[index];
    },
  };
}

beforeEach(
  () =>
    new Promise<void>((done) => {
      server = new Server();
      hostStorage = createSessionStorage();
      guestStorage = createSessionStorage();
      server.start(done);
    })
);

afterEach(async () => {
  await server.stop();
});

function TestComponent<Data>(props: {
  storage: MockStorage;
  onUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  gameId?: string;
  initialAction?: Data;
  acceptPlayer?: (game: Game<Data, Data>) => boolean;
  onDeclined?: (declined: boolean) => any;
}) {
  let {
    storage,
    onUpdate = noop,
    onDeclined = noop,
    initialAction,
    gameId,
    acceptPlayer = constant(true),
  } = props;
  let [initialActionSent, setInitialActionSent] = useState(false);
  let [game, playerId, dispatch, declined] = useRemoteReducer<Data, Data, Data>(
    `http://localhost:${server.port}`,
    (game, action, playerId) => ({ ...game, custom: action }),
    gameId,
    acceptPlayer,
    storage
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

  useEffect(() => {
    onDeclined(declined);
  }, [declined]);

  return <></>;
}

function LinkerComponent<Data>(props: {
  onHostUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  onGuestUpdate?: (game: Game<Data, Data>, playerId: string) => any;
  initialAction?: Data;
  acceptPlayer?: (game: Game<Data, Data>) => boolean;
  onDeclined?: (declined: boolean) => any;
}) {
  let {
    onHostUpdate = noop,
    onGuestUpdate = noop,
    onDeclined = noop,
    initialAction,
    acceptPlayer = constant(true),
  } = props;
  let [game, setGame] = useState<Game<Data, Data> | undefined>();

  function handleHostConnected(hostGame: Game<Data, Data>, playerId: string) {
    setGame(hostGame);
    onHostUpdate(hostGame, playerId);
  }

  return (
    <>
      <TestComponent
        key="host"
        onUpdate={handleHostConnected}
        storage={hostStorage}
        acceptPlayer={acceptPlayer}
        onDeclined={onDeclined}
      />
      {!!game && (
        <TestComponent
          key="guest"
          onUpdate={onGuestUpdate}
          gameId={game.id}
          initialAction={initialAction}
          storage={guestStorage}
          acceptPlayer={acceptPlayer}
          onDeclined={onDeclined}
        />
      )}
    </>
  );
}

test("create game when no gameId is provided", async () => {
  let game!: Game<number, number>;

  let onUpdate = vi.fn(
    (hostGame: Game<number, number>, playerId: string) => (game = hostGame)
  );

  render(<TestComponent onUpdate={onUpdate} storage={hostStorage} />);

  await waitFor(() => expect(game).toBeDefined());

  expect(hostStorage.setItem).toBeCalledTimes(1);
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

test("returns declined if host declined new player", async () => {
  let onHostUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );
  let onGuestUpdate = vi.fn(
    (game: Game<number, number>, playerId: string) => null
  );

  let onDeclined = vi.fn();

  render(
    <LinkerComponent
      onHostUpdate={onHostUpdate}
      onGuestUpdate={onGuestUpdate}
      onDeclined={onDeclined}
      acceptPlayer={constant(false)}
    />
  );

  await waitFor(() => expect(onDeclined.mock.lastCall?.[0]).toBe(true));
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
