import { useState } from "react";
import { io as ioc, type Socket as Client } from "socket.io-client";

export function useRemoteState<State>(uri: string, def: State) {
  return useState<State | null>(def);

  let client = ioc(uri);
}
