"use client";

import { useEffect, useState } from "react";

type ExploreSessionBridgeState = {
  sessionId: string | null;
  refreshToken: number;
};

type ExploreSessionBridgeListener = (state: ExploreSessionBridgeState) => void;

const exploreSessionBridgeState: ExploreSessionBridgeState = {
  sessionId: null,
  refreshToken: 0,
};

const exploreSessionBridgeListeners = new Set<ExploreSessionBridgeListener>();

function emitExploreSessionBridge() {
  for (const listener of exploreSessionBridgeListeners) {
    listener(exploreSessionBridgeState);
  }
}

export function setExploreSessionBridgeSessionId(sessionId: string | null) {
  exploreSessionBridgeState.sessionId = sessionId;
  emitExploreSessionBridge();
}

export function refreshExploreSessionMovement() {
  exploreSessionBridgeState.refreshToken += 1;
  emitExploreSessionBridge();
}

export function useExploreSessionBridge(): ExploreSessionBridgeState {
  const [state, setState] = useState<ExploreSessionBridgeState>(exploreSessionBridgeState);

  useEffect(() => {
    const listener: ExploreSessionBridgeListener = (nextState) => {
      setState({ ...nextState });
    };

    exploreSessionBridgeListeners.add(listener);
    listener(exploreSessionBridgeState);

    return () => {
      exploreSessionBridgeListeners.delete(listener);
    };
  }, []);

  return state;
}
