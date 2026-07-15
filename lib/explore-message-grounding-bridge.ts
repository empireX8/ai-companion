"use client";

import { useEffect, useState } from "react";

import type { ExploreGroundingPayload } from "./explore-grounding-contract";

type ExploreMessageGroundingBridgeState = {
  selectedMessageId: string | null;
  grounding: ExploreGroundingPayload | null;
};

type Listener = (state: ExploreMessageGroundingBridgeState) => void;

const state: ExploreMessageGroundingBridgeState = {
  selectedMessageId: null,
  grounding: null,
};

const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

export function setExploreSelectedMessageGrounding(args: {
  messageId: string | null;
  grounding: ExploreGroundingPayload | null;
}) {
  state.selectedMessageId = args.messageId;
  state.grounding = args.grounding;
  emit();
}

export function useExploreSelectedMessageGrounding(): ExploreMessageGroundingBridgeState {
  const [current, setCurrent] = useState<ExploreMessageGroundingBridgeState>(state);

  useEffect(() => {
    const listener: Listener = (next) => {
      setCurrent({ ...next });
    };
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return current;
}
