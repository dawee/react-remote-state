import { Game, RejoinEvent } from "@react-remote-state/types";
import { useEffect, useReducer, useState } from "react";
import { Socket as Client } from "socket.io-client";
import socket from "./socket";
import { flow } from "lodash";

type Meta = {
  client?: Client;
  isHostReady: boolean;
  localPlayerId?: string;
  isGuestReady: boolean;
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

type InternalAction<GameCustom, PlayerCustom, Action> =
  | InternalReduceAction<Action>
  | InternalUpdateAction<GameCustom, PlayerCustom>;

function wrapReducer<GameCustom, PlayerCustom, Action>(
  reducer: Reducer<GameCustom, PlayerCustom, Action>
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
    }
  };
}

export function useRemoteReducer<GameCustom, PlayerCustom, Action>(
  uri: string,
  reducer: Reducer<GameCustom, PlayerCustom, Action>,
  gameId?: string | null,
  storage: Storage = sessionStorage
): [
  Game<GameCustom, PlayerCustom> | undefined,
  string | undefined,
  (action: Action) => void
] {
  let [meta, setMeta] = useState<Meta>({
    isHostReady: false,
    isGuestReady: false,
  });

  let [game, internalDispatch] = useReducer(wrapReducer(reducer), undefined);

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

        setMeta({ ...meta, isGuestReady: true });
      }

      if (isHost(meta.localPlayerId, game) && !meta.isHostReady) {
        meta.client.on("join", (join) => {
          meta.client?.emit("accept", {
            gameId: game?.id,
            playerId: join.playerId,
          });
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

  return [game, meta.localPlayerId, dispatch];
}
