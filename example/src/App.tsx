import { useRemoteReducer } from "@react-remote-state/client";
import { Game } from "@react-remote-state/types";
import React, { useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  redirect,
  useNavigate,
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
  let navigate = useNavigate();
  let [game, playerId, dispatch] = useRemoteReducer<Buzzer, any, Action>(
    "http://localhost:4000",
    reducer
  );

  useEffect(() => {
    if (!!game) {
      navigate(`/g/${game.id}`);
    }
  }, [game, playerId]);

  return <div>Creating Game...</div>;
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
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
