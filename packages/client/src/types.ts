import { Game } from "@react-remote-state/types";
import { Socket as Client } from "socket.io-client";

export type Meta = {
  client?: Client;
  isHostReady: boolean;
  localPlayerId?: string;
  isGuestReady: boolean;
  declined: boolean;
};

export type PlayerCache = {
  playerId: string;
  socketId: string;
};

export type Reducer<GameCustom, PlayerCustom, Action> = (
  game: Game<GameCustom, PlayerCustom>,
  action: Action,
  playerId: string
) => Game<GameCustom, PlayerCustom>;

export enum InternalActionType {
  Reduce,
  Update,
  Accept,
}

export type InternalReduceAction<Action> = {
  type: InternalActionType.Reduce;
  client: Client;
  playerId: string;
  action: Action;
};

export type InternalUpdateAction<GameCustom, PlayerCustom> = {
  type: InternalActionType.Update;
  game: Game<GameCustom, PlayerCustom>;
};

export type InternalAcceptAction = {
  type: InternalActionType.Accept;
  playerId: string;
  client: Client;
};

export type InternalAction<GameCustom, PlayerCustom, Action> =
  | InternalReduceAction<Action>
  | InternalUpdateAction<GameCustom, PlayerCustom>
  | InternalAcceptAction;
