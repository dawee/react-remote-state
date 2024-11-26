import { Game } from "@react-remote-state/types";

export type ServerGame<GameCustom, PlayerCustom> = {
  game: Game<GameCustom, PlayerCustom>;
  playerSocketIds: Record<string, string>;
  playersQueue: Record<string, string>;
};
