import { useRemoteReducer } from "@react-remote-state/client";
import { Game } from "@react-remote-state/types";
import React, { useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  redirect,
  useNavigate,
  useLoaderData,
} from "react-router-dom";

enum ActionType {
  Buzz,
}

type BuzzAction = {
  type: ActionType.Buzz;
};

type Action = BuzzAction;

type Buzzer = {
  buzzingPlayerId?: string;
};

function reducer(game: Game<Buzzer, any>, action: Action, playerId: string) {
  return game;
}

function Landing() {
  let navigate = useNavigate();

  return (
    <div>
      <h1>Landing</h1>
      <button onClick={() => navigate("/new")}>New Game</button>
    </div>
  );
}

function NewGame() {
  let [isPathReady, setPathReady] = useState(false);
  let [game, playerId, dispatch] = useRemoteReducer<Buzzer, any, Action>(
    "http://localhost:4000",
    reducer
  );

  useEffect(() => {
    if (!isPathReady && !!game) {
      window.history.pushState("game", "Game", `/g/${game.id}`);

      setPathReady(true);
    }
  });

  return <div>{`Host, Players count: ${game?.players.length}`}</div>;
}

function JoinGame() {
  let { gameId } = useLoaderData() as { gameId: string };
  let [game, playerId, dispatch] = useRemoteReducer<Buzzer, any, Action>(
    "http://localhost:4000",
    reducer,
    gameId
  );

  return <div>{`Guest, Players count: ${game?.players.length}`}</div>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/new",
    element: <NewGame />,
  },
  {
    path: "/g/:gameId",
    element: <JoinGame />,
    loader: ({ params }) => params,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
