import * as t from "io-ts";

// player

export const playerValidator = <PlayerCustom extends t.Mixed>(playerCustom: PlayerCustom) =>
  t.type({
    id: t.string,
    host: t.boolean,
    custom: t.union([playerCustom, t.undefined])
  })

export type Player<PlayerCustom> = t.TypeOf<ReturnType<typeof playerValidator<t.Type<PlayerCustom>>>>;

// game

export const gameValidator = <GameCustom extends t.Mixed, PlayerCustom extends t.Mixed>(gameCustom: GameCustom, playerCustom: PlayerCustom) =>
  t.type({
    id: t.string,
    players: t.array(playerValidator(playerCustom)),
    custom: t.union([gameCustom, t.undefined])
  })

export type Game<GameCustom, PlayerCustom> = t.TypeOf<ReturnType<typeof gameValidator<t.Type<GameCustom>, t.Type<PlayerCustom>>>>;

export type ServerGame<GameCustom, PlayerCustom> = {
  game: Game<GameCustom, PlayerCustom>;
  playerSocketIds: Record<string, string>;
  playersQueue: Record<string, string>;
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

// notify

export const notifyEventValidator = t.type({
  gameId: t.string,
  action: t.any,
});

export type NotifyEvent = t.TypeOf<typeof notifyEventValidator>;

// update

export const updateEventValidator = <GameCustom extends t.Mixed, PlayerCustom extends t.Mixed>(gameCustom: GameCustom, playerCustom: PlayerCustom) =>
  t.type({
    game: gameValidator(gameCustom, playerCustom),
  });

export type UpdateEvent<GameCustom, PlayerCustom> = t.TypeOf<ReturnType<typeof updateEventValidator<t.Type<GameCustom>, t.Type<PlayerCustom>>>>;;

export type ServerUpdateEvent<GameCustom, PlayerCustom> = UpdateEvent<GameCustom, PlayerCustom> & {
  playerId?: string
};