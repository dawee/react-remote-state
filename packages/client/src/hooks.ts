import { useEffect } from "react";
import { InternalAction, InternalActionType, Meta, PlayerCache } from "./types";
import socket from "./socket";
import { Game, RejoinEvent } from "@react-remote-state/types";
import { flow } from "lodash";
import { isHost } from "./player";

export function useClientInitialization(
  meta: Meta,
  setMeta: React.Dispatch<React.SetStateAction<Meta>>,
  uri: string
) {
  useEffect(() => {
    if (!meta.client) {
      setMeta({
        ...meta,
        client: socket.connect(uri, { transports: ["websocket"] }),
      });
    }
  }, [meta.client]);
}

export function useGuestInitialization<GameCustom, PlayerCustom, Action>(
  meta: Meta,
  setMeta: React.Dispatch<React.SetStateAction<Meta>>,
  storage: Storage,
  internalDispatch: React.Dispatch<
    InternalAction<GameCustom, PlayerCustom, Action>
  >,
  gameId?: string | null,
  game?: Game<GameCustom, PlayerCustom>
) {
  useEffect(() => {
    if (!!meta.client && !meta.isGuestReady) {
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
  }, [meta.client, meta.isGuestReady]);
}

export function useHostInitialization<GameCustom, PlayerCustom, Action>(
  meta: Meta,
  setMeta: React.Dispatch<React.SetStateAction<Meta>>,
  internalDispatch: React.Dispatch<
    InternalAction<GameCustom, PlayerCustom, Action>
  >,
  game?: Game<GameCustom, PlayerCustom>
) {
  useEffect(() => {
    if (!!meta.client) {
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
}
