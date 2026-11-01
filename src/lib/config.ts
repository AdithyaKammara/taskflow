/**
 * App-wide constants. Nothing in this file touches the DOM or storage.
 */
import type { Member, Priority, StatusId } from './types';

/** Storage keys. These must never change: local-mode users' data lives under them. */
export const KEYS = {
  data: 'todo-app:v4',
  v3: 'todo-app:v3',
  v2: 'todo-app:v2',
  v1: 'todos',
  theme: 'todo-app:theme',
  density: 'todo-app:density',
  view: 'todo-app:view',
  workspace: 'todo-app:workspace',
  invite: 'todo-app:invite',
};

export const INBOX = 'inbox';
export const VIEWS = ['dashboard', 'list', 'board', 'calendar'] as const;
export type View = (typeof VIEWS)[number];

/** Short lines shown next to the dashboard greeting; one per day. */
export const QUOTES = [
  ['Small steps every day lead to big results.', 'Keep going. You have got this.'],
  ['Start with the thing you have been avoiding.', 'The rest gets easier.'],
  ['Done is better than perfect.', 'Ship it, then improve it.'],
  ['Focus on one task at a time.', 'Finish it, then pick the next.'],
  ['Clear the small blockers first.', 'They are holding up the big work.'],
  ['Progress counts, even when it is slow.', 'Look at how much is already done.'],
  ['Plan the day, then protect your focus.', 'Your future self will thank you.'],
];

export const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  list: 'Tasks',
  board: 'Board',
  calendar: 'Calendar',
};

export const STATUSES: { id: StatusId; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);

export const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
export const PRIORITY_WEIGHT: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

/**
 * The people tasks can be assigned to, and `ME`, the signed-in user. In local mode this is a demo
 * team; with Supabase configured, `setTeam()` swaps in the members of the current workspace.
 * Both are live bindings, so every importer sees the change.
 */
export const TEAM: Member[] = [
  { id: 'me', name: 'Adithya K', color: '#6b5bd2' },
  { id: 'priya', name: 'Priya Sharma', color: '#2f9e7a' },
  { id: 'rahul', name: 'Rahul Verma', color: '#d9822b' },
  { id: 'ananya', name: 'Ananya Rao', color: '#d05a8c' },
  { id: 'karthik', name: 'Karthik Reddy', color: '#3a8fb7' },
];
export let ME = 'me';

/** Replace the team with real workspace members and set who "me" is. */
export function setTeam(members: Member[], meId: string) {
  TEAM.splice(0, TEAM.length, ...members);
  ME = meId;
}

export const PROJECT_COLORS = [
  '#6b5bd2',
  '#2f9e7a',
  '#d9822b',
  '#d05a8c',
  '#3a8fb7',
  '#9065b0',
  '#d44c47',
];

export const MAX_TITLE = 120;
export const MAX_DESC = 2000;
export const MAX_TAGS = 5;
export const MAX_SUBS = 30;
export const MAX_HISTORY = 50;

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const TAG_RE = /^[\w-]{1,20}$/;

export const SEED_MARKER = 'Finalise homepage wireframes';
export const HINT_DEFAULT =
  'Try: Review PR tomorrow @priya #dev !high  (date, @assignee, #tags and !priority are picked out automatically)';
