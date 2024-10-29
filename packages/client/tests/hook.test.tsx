import MutationObserver from "@sheerun/mutationobserver-shim";
import { expect, test, beforeEach, afterEach, vi } from "vitest";
import { Server } from "@react-remote-state/server";
import { render, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { useRemoteReducer } from "../src";
import { Game } from "@react-remote-state/types";
import { noop } from "lodash";

let server: Server;

global.MutationObserver = MutationObserver;

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

function TestComponent<Data>(props: {
  onUpdate?: (game: Game<Data, Data>) => any;
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
    if (!!game) {
      onUpdate(game);

      if (!initialActionSent && !!initialAction) {
        dispatch(initialAction);
        setInitialActionSent(true);
      }
    }
  });

  return <></>;
}

function LinkerComponent<Data>(props: {
  onHostUpdate?: (game: Game<Data, Data>) => any;
  onGuestUpdate?: (game: Game<Data, Data>) => any;
  initialAction?: Data;
}) {
  let { onHostUpdate = noop, onGuestUpdate = noop, initialAction } = props;
  let [game, setGame] = useState<Game<Data, Data> | undefined>();

  function handleHostConnected(hostGame: Game<Data, Data>) {
    setGame(hostGame);
    onHostUpdate(hostGame);
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
  let onUpdate = vi.fn((game: Game<number, number>) => null);

  render(<TestComponent onUpdate={onUpdate} />);

  await waitFor(() => expect(onUpdate).toBeCalled());

  expect(onUpdate.mock?.lastCall?.[0]?.id).toBeTypeOf("string");
  expect(onUpdate.mock?.lastCall?.[0]?.players.length).toBe(1);
});

test("join game when gameId is provided", async () => {
  let onHostUpdate = vi.fn((game: Game<number, number>) => null);
  let onGuestUpdate = vi.fn((game: Game<number, number>) => null);

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
});

test("host runs reducer from notified action", async () => {
  let onHostUpdate = vi.fn((game: Game<number, number>) => null);
  let onGuestUpdate = vi.fn((game: Game<number, number>) => null);

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
});
