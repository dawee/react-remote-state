import { Game } from "@react-remote-state/types";
import { useReducer, useState } from "react";
import { constant } from "lodash";
import { Meta, Reducer } from "./types";
import {
  useClientInitialization,
  useGuestInitialization,
  useHostInitialization,
} from "./hooks";
import { createInternalReducer } from "./reducer";

export function useRemoteReducer<GameCustom, PlayerCustom, Action>(
  uri: string,
  reducer: Reducer<GameCustom, PlayerCustom, Action>,
  gameId?: string | null,
  acceptPlayer: (game: Game<GameCustom, PlayerCustom>) => boolean = constant(
    true
  ),
  storage: Storage = sessionStorage
): [
  game: Game<GameCustom, PlayerCustom> | undefined,
  localPlayerId: string | undefined,
  dispatch: (action: Action) => void,
  declined: boolean
] {
  let [meta, setMeta] = useState<Meta>({
    isHostReady: false,
    isGuestReady: false,
    declined: false,
  });

  let [game, internalDispatch] = useReducer(
    createInternalReducer(reducer, acceptPlayer),
    undefined
  );

  let dispatch = (action: Action) => {
    if (!!meta.client && !!game) {
      meta.client.emit("notify", { gameId: game.id, action });
    }
  };

  useClientInitialization(meta, setMeta, uri);
  useGuestInitialization(
    meta,
    setMeta,
    storage,
    internalDispatch,
    gameId,
    game
  );

  if (!gameId) {
    useHostInitialization(meta, setMeta, internalDispatch, game);
  }

  return [game, meta.localPlayerId, dispatch, meta.declined];
}
