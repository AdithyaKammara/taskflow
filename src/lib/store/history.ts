/**
 * Undo/redo history of serialised state snapshots. Pure logic, no DOM and no storage.
 */
export function createHistory(limit = 50, initial = '') {
  let past: string[] = [];
  let future: string[] = [];
  let last = initial;

  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    /** Record a new snapshot. Returns false (and does nothing) when nothing changed. */
    record(snapshot: string) {
      if (snapshot === last) return false;
      past.push(last);
      if (past.length > limit) past.shift();
      future = [];
      last = snapshot;
      return true;
    },
    /** Forget all history and treat `snapshot` as the starting point. */
    reset(snapshot: string) {
      past = [];
      future = [];
      last = snapshot;
    },
    /** Update the "current" snapshot without touching the stacks (used after normalising). */
    sync(snapshot: string) {
      last = snapshot;
    },
    /** Step back. Returns the snapshot to restore, or null when there is nothing to undo. */
    undo(): string | null {
      if (!past.length) return null;
      future.push(last);
      last = past.pop()!;
      return last;
    },
    /** Step forward. Returns the snapshot to restore, or null when there is nothing to redo. */
    redo(): string | null {
      if (!future.length) return null;
      past.push(last);
      last = future.pop()!;
      return last;
    },
  };
}

export type History = ReturnType<typeof createHistory>;
