import { Game, UpdateEvent } from "@react-remote-state/types";
import { InternalAction, InternalActionType, Reducer } from "./types";
import { chain, Dictionary, entries, flow, keyBy, zip } from "lodash";

export function createInternalReducer<GameCustom, PlayerCustom, Action>(
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
          let updatedGame = reducer(
            game,
            internalAction.action,
            internalAction.playerId
          );

          let playerCustoms: Record<string, PlayerCustom> = {};

          for (let player of updatedGame.players) {
            if (!!player.custom) {
              playerCustoms[player.id] = player.custom;
            }
          }

          let update: UpdateEvent<GameCustom, PlayerCustom> = {
            gameId: game.id,
            gameCustom: updatedGame.custom,
            playerCustoms,
          };

          internalAction.client.emit("update", update);
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
