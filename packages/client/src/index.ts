import { Game } from "@react-remote-state/types";
import { useEffect, useState } from "react";
import { io as ioc, type Socket as Client } from "socket.io-client";

type Meta = {
  client: Client;
  isInitialized: boolean;
  isHostReady: boolean;
  localPlayerId?: string;
};

function getPlayer<GameCustom, PlayerCustom>(
  playerId?: string,
  game?: Game<GameCustom, PlayerCustom>
) {
  if (!game || !playerId) {
    return undefined;
  }

  return game.players.find((player) => player.id == playerId);
}

function isHost<GameCustom, PlayerCustom>(
  playerId?: string,
  game?: Game<GameCustom, PlayerCustom>
) {
  let player = getPlayer(playerId, game);

  return player?.host;
}

type Reducer<GameCustom, PlayerCustom, Action> = (
  game: Game<GameCustom, PlayerCustom>,
  action: Action,
  playerId: string
) => Game<GameCustom, PlayerCustom>;

export function useRemoteReducer<GameCustom, PlayerCustom, Action>(
  uri: string,
  reducer: Reducer<GameCustom, PlayerCustom, Action>,
  gameId?: string
): [Game<GameCustom, PlayerCustom> | undefined, string | undefined] {
  let [meta, setMeta] = useState<Meta>({
    client: ioc(uri),
    isInitialized: false,
    isHostReady: false,
  });

  let [game, setGame] = useState<Game<GameCustom, PlayerCustom>>();

  useEffect(() => {
    if (!meta.isInitialized) {
      meta.client.on("connect", () => {
        if (gameId == undefined) {
          meta.client.emit("create");
        } else {
          meta.client.emit("join", { gameId });
        }
      });

      meta.client.on("update", (update) => {
        if (!meta.localPlayerId && !!update.playerId) {
          setMeta({ ...meta, localPlayerId: update.playerId });
        }

        setGame(update.game);
      });

      setMeta({ ...meta, isInitialized: true });
    } else if (isHost(meta.localPlayerId, game) && !meta.isHostReady) {
      meta.client.on("join", (join) => {
        meta.client.emit("accept", {
          gameId: game?.id,
          playerId: join.playerId,
        });
      });

      meta.client.on("notify", (notify) => {
        if (!!game) {
          meta.client.emit("update", {
            game: reducer(game, notify.action, notify.playerId),
          });
        }
      });

      setMeta({ ...meta, isHostReady: true });
    }
  });

  return [game, meta.localPlayerId];
}
