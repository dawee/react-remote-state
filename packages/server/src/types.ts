export type Player = {
  id: string;
  host: boolean;
};

export type Game = {
  id: string;
  players: Player[];
};

export type ServerGame = {
  game: Game;
  playerSocketIds: Record<string, string>;
};

export interface Response {
  type?: string;
  ok: boolean;
  message?: string;
}

export interface CreateGameResponse extends Response {
  type: "create-game";
  ok: true;
  playerId: string;
  game: Game;
}
