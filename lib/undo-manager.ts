export type UndoAction = {
  id: string;       // contradiction/entity id — used for dedup key
  name: string;     // e.g. "contradiction.resolve"
  expiresAt: number; // Date.now() + 10_000
  revert: () => Promise<void>;
};

type Listener = () => void;
type Unsubscribe = () => void;

export type UndoManager = {
  addUndoAction(action: UndoAction): void;
  cancelUndo(id: string): void;
  getActiveUndoActions(): UndoAction[];
  subscribe(listener: Listener): Unsubscribe;
};

const MAX_ACTIONS = 5;

export function createUndoManager(nowFn: () => number = Date.now): UndoManager {
  let actions: UndoAction[] = [];
  const listeners = new Set<Listener>();

  function notify(): void {
    listeners.forEach((l) => l());
  }

  function removeExpired(): void {
    const now = nowFn();
    const before = actions.length;
    actions = actions.filter((a) => a.expiresAt > now);
    if (actions.length !== before) notify();
  }

  function addUndoAction(action: UndoAction): void {
    removeExpired();
    // Remove any existing action with the same id + name (dedup)
    actions = actions.filter((a) => !(a.id === action.id && a.name === action.name));
    // Newest first
    actions = [action, ...actions];
    // Cap at MAX_ACTIONS — drop the oldest (last in array)
    if (actions.length > MAX_ACTIONS) {
      actions = actions.slice(0, MAX_ACTIONS);
    }
    notify();
  }

  function cancelUndo(id: string): void {
    actions = actions.filter((a) => a.id !== id);
    notify();
  }

  function getActiveUndoActions(): UndoAction[] {
    removeExpired();
    return [...actions];
  }

  function subscribe(listener: Listener): Unsubscribe {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { addUndoAction, cancelUndo, getActiveUndoActions, subscribe };
}

// Module-level singleton — used by the app
export const undoManager = createUndoManager();
