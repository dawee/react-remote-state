import { useState } from "react";

export function useRemoteState<State>() {
  return useState<State | null>(null);
}
