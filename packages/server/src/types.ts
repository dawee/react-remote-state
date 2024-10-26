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
  playersQueue: Record<string, string>;
};

// start

export type StartResponse = {
  playerId: string;
  game: Game;
};

// join

export const joinEventValidator = t.type({
  gameId: t.string,
});

export type JoinEvent = t.TypeOf<typeof joinEventValidator>;

// accept

export const acceptEventValidator = t.type({
  playerId: t.string,
  gameId: t.string,
});

export type AcceptEvent = t.TypeOf<typeof acceptEventValidator>;

// decline

export const declineEventValidator = t.type({
  playerId: t.string,
  gameId: t.string,
});

export type DeclineEvent = t.TypeOf<typeof declineEventValidator>;
