import { Game } from "@react-remote-state/types";

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
