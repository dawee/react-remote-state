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

function reducer(
  game: Game<Buzzer, any>,
  action: Action,
  playerId: string
): Game<Buzzer, any> {
  switch (action.type) {
    case ActionType.Buzz:
      console.log("buzz action");
      return { ...game, custom: { ...game.custom, buzzingPlayerId: playerId } };
  }
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

function GameView(props: {
  game: Game<Buzzer, any>;
  playerId: string;
  dispatch: (action: Action) => any;
}) {
  let { game, playerId, dispatch } = props;

  return (
    <div>
      <button
        disabled={!!game.custom?.buzzingPlayerId}
        onClick={() => dispatch({ type: ActionType.Buzz })}
      >
        Buzz
      </button>
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

  return (
    <div>
      {!!game && !!playerId ? (
        <GameView game={game} playerId={playerId} dispatch={dispatch} />
      ) : null}
    </div>
  );
}

function JoinGame() {
  let { gameId } = useLoaderData() as { gameId: string };
  let [game, playerId, dispatch] = useRemoteReducer<Buzzer, any, Action>(
    "http://localhost:4000",
    reducer,
    gameId
  );

  return (
    <div>
      {!!game && !!playerId ? (
        <GameView game={game} playerId={playerId} dispatch={dispatch} />
      ) : null}
    </div>
  );
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
