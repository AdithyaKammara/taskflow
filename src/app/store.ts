/**
 * App state: the `{ projects, tasks }` document, the view settings (filters, selection, open
 * panels), the toast, the focus timer and the theme/density preferences.
 *
 * Rules of the road (as in v6):
 *  - the document changes only through `change()` / `commit()`, which save, record an undo step and
 *    publish a new document object so React re-renders;
 *  - undo and redo restore whole-document snapshots.
 */
import { create } from 'zustand';
import { KEYS, MAX_HISTORY, ME, TEAM, setTeam } from '../lib/config';
import { normalize } from '../lib/model/sanitize';
import type { Filters } from '../lib/model/selectors';
import { createHistory } from '../lib/store/history';
import { readPref, storage, writePref } from '../lib/store/storage';
import { cloudEnabled } from '../lib/supabase/env';
import type { Doc, Member } from '../lib/types';
import { todayISO } from '../lib/utils/dates';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type SortKey = 'due' | 'priority' | 'newest' | 'title';
export type DialogName = 'settings' | 'help' | 'next' | 'project' | 'palette' | 'team';
export type SyncStatus = 'synced' | 'saving' | 'offline';

export interface Toast {
  message: string;
  undo?: () => void;
  /** Changes on every toast, so the same message shown twice still restarts its timer. */
  key: number;
}

export interface AppState extends Filters {
  doc: Doc;
  canUndo: boolean;
  canRedo: boolean;

  sort: SortKey;
  selected: ReadonlySet<string>;
  /** First day of the month the calendar shows, `YYYY-MM-01`. */
  calMonth: string;
  /** The calendar day whose full task list is expanded, or ''. */
  calExpanded: string;
  trendDays: 7 | 14 | 30;
  drawerId: string | null;
  dialog: DialogName | null;
  navOpen: boolean;

  toast: Toast | null;
  pomo: { seconds: number; running: boolean };

  theme: Theme;
  density: Density;

  /** People tasks can be assigned to (the demo team, or the workspace's members) and who "me" is. */
  team: Member[];
  me: string;
  /** Cloud mode only: whether local changes have reached the server. */
  syncStatus: SyncStatus;
}

export const FOCUS_SECONDS = 25 * 60;

const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** The saved choice, or null when the user never picked one (then the OS decides). */
const savedTheme = (): Theme | null => {
  const s = readPref(KEYS.theme);
  return s === 'light' || s === 'dark' ? s : null;
};

// decided before the first load, so a signed-out cloud visitor never sees this browser's local data
storage.cloud = cloudEnabled();
const initialDoc = storage.load();
const history = createHistory(MAX_HISTORY, JSON.stringify(initialDoc));

export const useApp = create<AppState>(() => ({
  doc: initialDoc,
  canUndo: false,
  canRedo: false,

  project: '',
  assignee: '',
  priority: '',
  search: '',
  quickChip: 'all',
  sort: 'due',
  selected: new Set(),
  calMonth: todayISO().slice(0, 8) + '01',
  calExpanded: '',
  trendDays: 14,
  drawerId: null,
  dialog: null,
  navOpen: false,

  toast: null,
  pomo: { seconds: FOCUS_SECONDS, running: false },

  theme: savedTheme() ?? (darkQuery.matches ? 'dark' : 'light'),
  density: readPref(KEYS.density) === 'compact' ? 'compact' : 'comfortable',

  team: [...TEAM],
  me: ME,
  syncStatus: 'synced',
}));

const set = useApp.setState;
const get = useApp.getState;

// ---------- toast ----------

let toastTimer = 0;

/** Bottom-of-screen message, with an optional Undo button. */
export function toast(message: string, undo?: () => void) {
  set({ toast: { message, undo, key: Date.now() } });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, undo ? 6000 : 3000);
}

export const hideToast = () => set({ toast: null });

// ---------- the document ----------

/** Drop selected ids and the project filter when what they point at no longer exists. */
function tidyView(doc: Doc): Partial<AppState> {
  const { selected, project, drawerId } = get();
  const ids = new Set(doc.tasks.map((t) => t.id));
  return {
    selected: new Set([...selected].filter((id) => ids.has(id))),
    project: doc.projects.some((p) => p.id === project) ? project : '',
    drawerId: drawerId && ids.has(drawerId) ? drawerId : null,
  };
}

const historyFlags = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });

const savedListeners = new Set<(doc: Doc) => void>();

/** Run `fn` after every local save (edits, undo, redo): the cloud sync sends the changes. */
export function onSaved(fn: (doc: Doc) => void) {
  savedListeners.add(fn);
  return () => savedListeners.delete(fn);
}

let saveWarned = false;

/** Make `doc` the current document: save it, record an undo step and re-render. */
export function commit(doc: Doc) {
  history.record(JSON.stringify(doc));
  if (storage.save(doc)) {
    saveWarned = false;
  } else if (!saveWarned) {
    saveWarned = true;
    toast(
      'Could not save: browser storage is full or blocked. Export a JSON backup from Settings.'
    );
  }
  set({ doc, ...tidyView(doc), ...historyFlags() });
  savedListeners.forEach((fn) => fn(doc));
}

/**
 * Edit a copy of the document and commit it.
 * ponytail: copies the whole document per change; fine for thousands of tasks, switch to per-task
 * copies if a workspace ever gets much bigger.
 */
export function change(fn: (doc: Doc) => void) {
  const doc = structuredClone(get().doc);
  fn(doc);
  commit(doc);
}

function applySnapshot(snapshot: string) {
  const doc = normalize(JSON.parse(snapshot));
  history.sync(JSON.stringify(doc));
  storage.save(doc);
  set({ doc, ...tidyView(doc), selected: new Set(), ...historyFlags() });
  savedListeners.forEach((fn) => fn(doc));
}

export function undo() {
  const snap = history.undo();
  if (snap === null) return toast('Nothing to undo');
  applySnapshot(snap);
  toast('Undone');
}

export function redo() {
  const snap = history.redo();
  if (snap === null) return toast('Nothing to redo');
  applySnapshot(snap);
  toast('Redone');
}

/** Another browser tab saved new data: show it and start a fresh history. */
export function reloadFromStorage() {
  const doc = storage.load();
  history.reset(JSON.stringify(doc));
  set({ doc, ...tidyView(doc), ...historyFlags() });
}

/** A whole new document arrived (signed in, switched workspace): show it with a fresh history. */
export function replaceAll(data: unknown) {
  const doc = normalize(data);
  history.reset(JSON.stringify(doc));
  set({ doc, selected: new Set(), project: '', drawerId: null, ...historyFlags() });
}

/**
 * A teammate changed something. `fn` edits a copy of the document; the sanitised result becomes the
 * current snapshot without an undo step of its own, and is not sent back to the server.
 */
export function applyRemote(fn: (doc: Doc) => void) {
  const draft = structuredClone(get().doc);
  fn(draft);
  const doc = normalize(draft);
  history.sync(JSON.stringify(doc));
  set({ doc, ...tidyView(doc) });
}

/** Replace the team with the workspace's members and set who "me" is (before loading its tasks). */
export function setMembers(members: Member[], meId: string) {
  setTeam(members, meId);
  set({ team: [...TEAM], me: ME });
}

// ---------- view settings ----------

export const clearFilters = () => set({ search: '', assignee: '', priority: '', quickChip: 'all' });

export function setProject(project: string) {
  set({ project, selected: new Set(), navOpen: false });
}

export function toggleSelected(id: string, on: boolean) {
  const selected = new Set(get().selected);
  if (on) selected.add(id);
  else selected.delete(id);
  set({ selected });
}

export const openDialog = (dialog: DialogName) => set({ dialog, navOpen: false });
export const closeDialog = () => set({ dialog: null });
export const openDrawer = (id: string) => set({ drawerId: id, dialog: null });
export const closeDrawer = () => set({ drawerId: null });

// ---------- focus timer ----------

let pomoTimer = 0;

export function togglePomo() {
  const { pomo } = get();
  if (pomo.running) {
    clearInterval(pomoTimer);
    set({ pomo: { ...pomo, running: false } });
    toast('Focus timer paused');
    return;
  }
  pomoTimer = window.setInterval(() => {
    const { seconds } = get().pomo;
    if (seconds > 0) {
      set({ pomo: { seconds: seconds - 1, running: true } });
      return;
    }
    clearInterval(pomoTimer);
    set({ pomo: { seconds: FOCUS_SECONDS, running: false } });
    toast('Focus session complete! Take a 5-minute break.');
  }, 1000);
  set({ pomo: { ...pomo, running: true } });
  toast('25-minute Focus Timer started');
}

export function resetPomo() {
  clearInterval(pomoTimer);
  set({ pomo: { seconds: FOCUS_SECONDS, running: false } });
  toast('Focus timer reset to 25:00');
}

// ---------- theme and density ----------

export function toggleTheme() {
  const theme = get().theme === 'dark' ? 'light' : 'dark';
  writePref(KEYS.theme, theme);
  set({ theme });
}

export function setDensity(density: Density) {
  writePref(KEYS.density, density);
  set({ density });
}

export const toggleDensity = () =>
  setDensity(get().density === 'compact' ? 'comfortable' : 'compact');

// follow the OS until the user picks a theme
darkQuery.addEventListener('change', () => {
  if (!savedTheme()) set({ theme: darkQuery.matches ? 'dark' : 'light' });
});

// the theme and density live on <html>, where the tokens read them; applied before the first render
const applyPrefs = ({ theme, density }: AppState) => {
  root.dataset.theme = theme;
  root.dataset.density = density;
};
applyPrefs(get());
useApp.subscribe(applyPrefs);

// another tab saved new data
window.addEventListener('storage', (e) => {
  if (e.key === KEYS.data) reloadFromStorage();
});
