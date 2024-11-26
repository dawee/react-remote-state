import * as t from "io-ts";

export type Player<PlayerCustom> = {
  id: string;
  host: boolean;
  connected: boolean;
  custom?: PlayerCustom;
};

export type Game<GameCustom, PlayerCustom> = {
  id: string;
  players: Player<PlayerCustom>[];
  custom: GameCustom;
};

// join

export const joinEventValidator = t.type({
  gameId: t.string,
});

export type JoinEvent = t.TypeOf<typeof joinEventValidator>;

// rejoin

export const rejoinEventValidator = t.type({
  gameId: t.string,
  playerId: t.string,
  socketId: t.string,
});

export type RejoinEvent = t.TypeOf<typeof rejoinEventValidator>;

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

// notify

export const notifyEventValidator = t.type({
  gameId: t.string,
  action: t.any,
});

export type NotifyEvent = t.TypeOf<typeof notifyEventValidator>;

// update

export const updateEventValidator = <
  GameCustom extends t.Mixed,
  PlayerCustom extends t.Mixed
>(
  gameCustom: GameCustom,
  playerCustom: PlayerCustom
) =>
  t.type({
    gameId: t.string,
    gameCustom: gameCustom,
    playerCustoms: t.record(t.string, playerCustom),
  });

export type UpdateEvent<GameCustom, PlayerCustom> = t.TypeOf<
  ReturnType<
    typeof updateEventValidator<t.Type<GameCustom>, t.Type<PlayerCustom>>
  >
>;

export type ServerUpdateEvent<GameCustom, PlayerCustom> = {
  playerId?: string;
  game: Game<GameCustom, PlayerCustom>;
};
