import * as t from "io-ts";

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

export interface JoinGameResponse extends Response {
  ok: true;
  playerId: string;
  game: Game;
}

export const CreateGameRequest = t.type({
  type: t.literal("create-game"),
});

export const JoinGameRequest = t.type({
  type: t.literal("join-game"),
  gameId: t.string,
});

export const Request = t.union([CreateGameRequest, JoinGameRequest]);

export type RequestT = t.TypeOf<typeof Request>;
