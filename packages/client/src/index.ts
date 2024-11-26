import { Game, RejoinEvent } from "@react-remote-state/types";
import { useEffect, useReducer, useState } from "react";
import { Socket as Client } from "socket.io-client";
import socket from "./socket";
import { constant, flow } from "lodash";
import { boolean } from "io-ts";

type Meta = {
  client?: Client;
  isHostReady: boolean;
  localPlayerId?: string;
  isGuestReady: boolean;
  declined: boolean;
};

export function getPlayer<GameCustom, PlayerCustom>(
  playerId?: string,
  game?: Game<GameCustom, PlayerCustom>
) {
  if (!game || !playerId) {
    return undefined;
  }

  return game.players.find((player) => player.id == playerId);
}

export function isHost<GameCustom, PlayerCustom>(
  playerId?: string,
  game?: Game<GameCustom, PlayerCustom>
) {
  let player = getPlayer(playerId, game);

  return player?.host;
}

type PlayerCache = {
  playerId: string;
  socketId: string;
};

type Reducer<GameCustom, PlayerCustom, Action> = (
  game: Game<GameCustom, PlayerCustom>,
  action: Action,
  playerId: string
) => Game<GameCustom, PlayerCustom>;

enum InternalActionType {
  Reduce,
  Update,
  Accept,
}

type InternalReduceAction<Action> = {
  type: InternalActionType.Reduce;
  client: Client;
  playerId: string;
  action: Action;
};

type InternalUpdateAction<GameCustom, PlayerCustom> = {
  type: InternalActionType.Update;
  game: Game<GameCustom, PlayerCustom>;
};

type InternalAcceptAction = {
  type: InternalActionType.Accept;
  playerId: string;
  client: Client;
};

type InternalAction<GameCustom, PlayerCustom, Action> =
  | InternalReduceAction<Action>
  | InternalUpdateAction<GameCustom, PlayerCustom>
  | InternalAcceptAction;

function wrapReducer<GameCustom, PlayerCustom, Action>(
  reducer: Reducer<GameCustom, PlayerCustom, Action>,
  acceptPlayer: (game: Game<GameCustom, PlayerCustom>) => boolean
) {
  return (
    game: Game<GameCustom, PlayerCustom> | undefined,
    internalAction: InternalAction<GameCustom, PlayerCustom, Action>
  ) => {
    switch (internalAction.type) {
      case InternalActionType.Update:
        return internalAction.game;
      case InternalActionType.Reduce:
        if (!!game) {
          internalAction.client.emit("update", {
            game: reducer(game, internalAction.action, internalAction.playerId),
          });
        }

        return game;
      case InternalActionType.Accept:
        if (!!game) {
          internalAction.client?.emit(
            acceptPlayer(game) ? "accept" : "decline",
            {
              gameId: game.id,
              playerId: internalAction.playerId,
            }
          );
        }

        return game;
    }
  };
}

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
    wrapReducer(reducer, acceptPlayer),
    undefined
  );

  let dispatch = (action: Action) => {
    if (!!meta.client && !!game) {
      meta.client.emit("notify", { gameId: game.id, action });
    }
  };

  useEffect(() => {
    if (!meta.client) {
      setMeta({
        ...meta,
        client: socket.connect(uri, { transports: ["websocket"] }),
      });
    }

    if (!!meta.client) {
      if (!meta.isGuestReady) {
        meta.client.on("error", console.error);
        meta.client.on("connect", () => {
          if (gameId == undefined && !game) {
            meta.client?.emit("create");
          } else if (!!gameId) {
            let playerCache = flow(
              () => (!!gameId ? storage.getItem(gameId) : null),
              (cache) => (!!cache ? (JSON.parse(cache) as PlayerCache) : null)
            )();

            if (!!playerCache) {
              let rejoin: RejoinEvent = {
                playerId: playerCache.playerId,
                socketId: playerCache.socketId,
                gameId,
              };

              meta.client?.emit("rejoin", rejoin);
            } else {
              meta.client?.emit("join", { gameId });
            }
          }
        });

        meta.client.on("assign", (assign) => {
          setMeta({ ...meta, localPlayerId: assign.playerId });

          if (!!meta?.client?.id) {
            let playerCache: PlayerCache = {
              playerId: assign.playerId,
              socketId: meta.client?.id,
            };

            storage.setItem(assign.gameId, JSON.stringify(playerCache));
          }
        });

        meta.client.on("update", (update) =>
          internalDispatch({
            type: InternalActionType.Update,
            game: update.game,
          })
        );

        meta.client.on("decline", () => setMeta({ ...meta, declined: true }));

        setMeta({ ...meta, isGuestReady: true });
      }

      if (isHost(meta.localPlayerId, game) && !meta.isHostReady) {
        meta.client.on("join", (join) => {
          if (!!meta.client) {
            internalDispatch({
              type: InternalActionType.Accept,
              playerId: join.playerId,
              client: meta.client,
            });
          }
        });

        meta.client.on("notify", (notify) => {
          if (!!game && !!meta.client) {
            internalDispatch({
              type: InternalActionType.Reduce,
              client: meta.client,
              playerId: notify.playerId,
              action: notify.action,
            });
          }
        });

        setMeta({ ...meta, isHostReady: true });
      }
    }
  });

  return [game, meta.localPlayerId, dispatch, meta.declined];
}
