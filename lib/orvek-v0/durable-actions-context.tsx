"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DurableActionsRefreshContextValue = {
  revision: number;
  refreshAfterDurableWrite: () => void;
};

const DurableActionsRefreshContext = createContext<DurableActionsRefreshContextValue | null>(
  null
);

export function DurableActionsRefreshProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: DurableActionsRefreshContextValue;
}) {
  const [revision, setRevision] = useState(value?.revision ?? 0);

  const refreshAfterDurableWrite = useCallback(() => {
    if (value) {
      value.refreshAfterDurableWrite();
      return;
    }
    setRevision((current) => current + 1);
  }, [value]);

  const contextValue = useMemo(
    () =>
      value ?? {
        revision,
        refreshAfterDurableWrite,
      },
    [value, revision, refreshAfterDurableWrite]
  );

  return (
    <DurableActionsRefreshContext.Provider value={contextValue}>
      {children}
    </DurableActionsRefreshContext.Provider>
  );
}

export function useDurableActionsRefresh() {
  const context = useContext(DurableActionsRefreshContext);
  if (!context) {
    return {
      revision: 0,
      refreshAfterDurableWrite: () => {},
    };
  }
  return context;
}
