/**
 * Row-level diffing between two `{ projects, tasks }` documents. Pure, no DOM and no network.
 * The cloud sync uses it to send only the projects and tasks that changed since the last save.
 */
type Row = { id: string };

/** id -> JSON string, so two rows compare by value in one string comparison. */
export type RowIndex = Map<string, string>;
export interface DocIndex {
  projects: RowIndex;
  tasks: RowIndex;
}

export function index<T extends Row>(rows: T[] | undefined): RowIndex {
  const out: RowIndex = new Map();
  for (const r of rows || []) out.set(r.id, JSON.stringify(r));
  return out;
}

/**
 * Compares two indexes (from `index()`) and returns what to write.
 * `upserts` holds the ids that are new or changed in `next`, `deletes` the ids that disappeared.
 */
export function diffIndex(prev: RowIndex, next: RowIndex) {
  const upserts: string[] = [];
  const deletes: string[] = [];
  for (const [id, json] of next) if (prev.get(id) !== json) upserts.push(id);
  for (const id of prev.keys()) if (!next.has(id)) deletes.push(id);
  return { upserts, deletes };
}

/** Diffs both collections of a document against the indexes of the last synced version. */
export function diffDoc(synced: DocIndex, doc: { projects: Row[]; tasks: Row[] }) {
  const projects = index(doc.projects);
  const tasks = index(doc.tasks);
  return {
    projects: diffIndex(synced.projects, projects),
    tasks: diffIndex(synced.tasks, tasks),
    next: { projects, tasks },
  };
}

/**
 * Applies one remote row change to a list of rows and returns the new list.
 * `row` is the new value (insert/update) or null (delete).
 */
export function applyRow<T extends Row>(rows: T[], id: string, row: T | null): T[] {
  const i = rows.findIndex((r) => r.id === id);
  if (!row) return i === -1 ? rows : rows.filter((r) => r.id !== id);
  if (i === -1) return [...rows, row];
  const copy = rows.slice();
  copy[i] = row;
  return copy;
}
