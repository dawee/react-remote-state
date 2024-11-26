import { Game } from "@react-remote-state/types";
import { InternalAction, InternalActionType, Reducer } from "./types";

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
