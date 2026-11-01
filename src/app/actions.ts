/**
 * Task, project and data operations, ported from v6 (store/actions.js, features/seed.js,
 * features/data.js). Each one edits the document through `change()` / `commit()`.
 */
import {
  INBOX,
  MAX_SUBS,
  MAX_TITLE,
  PROJECT_COLORS,
  SEED_MARKER,
  STATUS_IDS,
  ME,
} from '../lib/config';
import { member, nameOf, statusLabel } from '../lib/model/meta';
import { normalize, sanitizeTask } from '../lib/model/sanitize';
import { SORTS, projectOf } from '../lib/model/selectors';
import type { Doc, Priority, StatusId, Task } from '../lib/types';
import { toCsv } from '../lib/utils/csv';
import { DAY_MS, addDays, todayISO } from '../lib/utils/dates';
import { clean, pid, truncate, uid } from '../lib/utils/text';
import { change, commit, setProject, toast, useApp } from './store';

/** Append an entry to a task's activity log (keeps the newest 50). */
export function log(task: Task, text: string) {
  task.log.push({ at: Date.now(), text });
  if (task.log.length > 50) task.log.shift();
}

/** Edit one task (`fn` mutates a copy), optionally noting it in the activity log. */
export function editTask(id: string, fn: (t: Task) => void, note?: string) {
  if (!useApp.getState().doc.tasks.some((t) => t.id === id)) return;
  change((doc) => {
    const t = doc.tasks.find((x) => x.id === id)!;
    fn(t);
    if (note) log(t, note);
  });
}

export function addTask(fields: {
  title: string;
  priority: Priority;
  due: string;
  tags: string[];
  assignee: string;
  project: string;
}) {
  const t = sanitizeTask({ ...fields, status: 'todo' });
  if (!t) return null;
  log(t, 'Task created');
  change((doc) => {
    doc.tasks.push(t);
  });
  return t;
}

export function setStatus(id: string, status: StatusId) {
  const t = useApp.getState().doc.tasks.find((x) => x.id === id);
  if (!t || t.status === status || !STATUS_IDS.includes(status)) return;
  editTask(
    id,
    (x) => {
      x.status = status;
      x.completedAt = status === 'done' ? Date.now() : null;
    },
    `Status changed: ${statusLabel(t.status)} → ${statusLabel(status)}`
  );
}

export function deleteTask(id: string) {
  const { doc } = useApp.getState();
  const i = doc.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const removed = doc.tasks[i];
  change((d) => {
    d.tasks.splice(i, 1);
  });
  toast(`Deleted "${truncate(removed.title, 30)}"`, () =>
    change((d) => {
      d.tasks.splice(Math.min(i, d.tasks.length), 0, removed);
    })
  );
}

/** Run `fn` on every selected task, then save once. */
export function bulkUpdate(fn: (t: Task) => void) {
  const { selected } = useApp.getState();
  change((doc) => doc.tasks.filter((t) => selected.has(t.id)).forEach(fn));
}

export function bulkStatus(status: StatusId) {
  if (!STATUS_IDS.includes(status)) return;
  bulkUpdate((t) => {
    if (t.status === status) return;
    log(t, `Status changed: ${statusLabel(t.status)} → ${statusLabel(status)}`);
    t.status = status;
    t.completedAt = status === 'done' ? Date.now() : null;
  });
}

/** `to` is a member id, or '' for unassigned. */
export function bulkAssign(to: string) {
  if (to && !member(to)) return;
  bulkUpdate((t) => {
    if (t.assignee === to) return;
    log(t, `Assignee changed: ${nameOf(t.assignee)} → ${nameOf(to)}`);
    t.assignee = to;
  });
}

export function bulkDelete() {
  const { doc, selected } = useApp.getState();
  const removed = doc.tasks.filter((t) => selected.has(t.id));
  if (!removed.length) return;
  change((d) => {
    d.tasks = d.tasks.filter((t) => !selected.has(t.id));
  });
  useApp.setState({ selected: new Set() });
  toast(`Deleted ${removed.length} task${removed.length === 1 ? '' : 's'}`, () =>
    change((d) => {
      d.tasks.push(...removed);
    })
  );
}

/** Replace ALL data (import / reset) with a one-click undo. */
export function replaceDoc(next: Doc, message: string) {
  const prev = JSON.stringify(useApp.getState().doc);
  useApp.setState({ selected: new Set(), project: '' });
  commit(next);
  toast(message, () => commit(normalize(JSON.parse(prev))));
}

export function addProject(name: string, color: string) {
  const p = {
    id: pid(),
    name: clean(name, 40),
    color: PROJECT_COLORS.includes(color) ? color : PROJECT_COLORS[0],
  };
  if (!p.name) return;
  change((doc) => {
    doc.projects.push(p);
  });
  setProject(p.id);
  toast(`Project "${p.name}" created`);
}

export function addSubtask(id: string, raw: string) {
  const text = clean(raw, 120);
  const t = useApp.getState().doc.tasks.find((x) => x.id === id);
  if (!t || !text || t.subtasks.length >= MAX_SUBS) return;
  editTask(
    id,
    (x) => x.subtasks.push({ id: uid(), text, done: false }),
    `Subtask added: ${truncate(text, 40)}`
  );
}

export function addComment(id: string, raw: string) {
  const text = raw.trim().slice(0, 500);
  if (!text) return;
  editTask(id, (x) => x.comments.push({ id: uid(), author: ME, text, at: Date.now() }));
}

/** Quick add: returns an error message, or '' when the task was added. */
export function quickAdd(p: {
  title: string;
  priority: Priority;
  due: string;
  tags: string[];
  assignee: string;
}) {
  if (!p.title) return 'Type a task title first. Dates, tags and @names alone are not a task.';
  if (p.title.length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  const { doc, project, assignee } = useApp.getState();
  const proj =
    doc.projects.find((x) => x.id === project) || doc.projects.find((x) => x.id === INBOX)!;
  addTask({ ...p, assignee: p.assignee || assignee, project: proj.id });
  toast(`Added to ${proj.name}`);
  return '';
}

// ---------- sample data ----------

/** "Add sample data": three demo projects with realistic tasks, so the app looks alive in a demo. */
export function seedData() {
  const { doc } = useApp.getState();
  if (doc.tasks.some((t) => t.title === SEED_MARKER)) {
    toast('Sample data is already loaded');
    return;
  }
  const web = { id: pid(), name: 'Website Redesign', color: '#6b5bd2' };
  const app = { id: pid(), name: 'Mobile App', color: '#2f9e7a' };
  const mkt = { id: pid(), name: 'Q4 Launch', color: '#d9822b' };
  const t0 = todayISO();

  // [project, title, status, priority, due offset (days), assignee, tags, subtasks, subtasks done]
  const rows: [
    typeof web,
    string,
    StatusId,
    Priority,
    number,
    string,
    string[],
    string[],
    number,
  ][] = [
    [
      web,
      SEED_MARKER,
      'doing',
      'high',
      2,
      'priya',
      ['design'],
      ['Hero section', 'Pricing block', 'Mobile layout'],
      1,
    ],
    [
      web,
      'Audit accessibility issues',
      'todo',
      'high',
      -2,
      'me',
      ['a11y'],
      ['Keyboard navigation', 'Colour contrast'],
      0,
    ],
    [web, 'Write case-study copy', 'review', 'medium', 4, 'ananya', ['content'], [], 0],
    [web, 'Set up analytics events', 'todo', 'low', 9, 'karthik', ['dev', 'data'], [], 0],
    [
      app,
      'Fix login crash on Android 13',
      'doing',
      'high',
      0,
      'rahul',
      ['bug', 'dev'],
      ['Reproduce', 'Patch', 'Regression test'],
      1,
    ],
    [app, 'Design onboarding flow', 'review', 'medium', 3, 'priya', ['design'], [], 0],
    [
      app,
      'Add offline mode for task list',
      'todo',
      'medium',
      12,
      'me',
      ['dev'],
      ['Cache layer', 'Sync queue'],
      0,
    ],
    [app, 'Release v2.3 to Play Store', 'todo', 'high', 6, 'karthik', ['release'], [], 0],
    [
      mkt,
      'Prepare launch announcement',
      'doing',
      'medium',
      5,
      'ananya',
      ['content', 'launch'],
      [],
      0,
    ],
    [mkt, 'Book webinar speakers', 'todo', 'low', -1, 'me', ['events'], [], 0],
    [mkt, 'Publish pricing page', 'done', 'high', -3, 'me', ['launch'], [], 0],
    [web, 'Migrate blog to new CMS', 'done', 'medium', -5, 'rahul', ['dev'], [], 0],
    [app, 'Update privacy policy', 'done', 'low', -6, 'ananya', ['legal'], [], 0],
  ];

  const tasks = rows.flatMap(
    ([proj, title, status, priority, d, assignee, tags, subs, subsDone], i) => {
      const t = sanitizeTask({
        title,
        status,
        priority,
        due: addDays(t0, d),
        assignee,
        tags,
        project: proj.id,
        subtasks: subs.map((text, k) => ({ text, done: k < subsDone })),
        completedAt: status === 'done' ? Date.now() - (i % 5) * DAY_MS : null,
      });
      if (!t) return [];
      log(t, 'Task created');
      if (i === 0) {
        t.description =
          'Collect feedback from design review and lock the homepage layout before development starts.';
        t.comments.push(
          {
            id: uid(),
            author: 'priya',
            text: 'Wireframes are in the shared folder. Please review before Thursday.',
            at: Date.now() - 5 * 3600000,
          },
          {
            id: uid(),
            author: 'me',
            text: 'Looks good. Can we add a pricing block above the fold?',
            at: Date.now() - 2 * 3600000,
          }
        );
      }
      return [t];
    }
  );

  change((d) => {
    d.projects.push(web, app, mkt);
    d.tasks.push(...tasks);
  });
  toast('Sample data added');
}

// ---------- import / export ----------

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON() {
  const { doc } = useApp.getState();
  const payload = {
    app: 'taskflow',
    version: 5,
    exportedAt: new Date().toISOString(),
    projects: doc.projects,
    tasks: doc.tasks,
  };
  download(
    `taskflow-backup-${todayISO()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

export function exportCSV() {
  const { doc } = useApp.getState();
  if (!doc.tasks.length) {
    toast('Nothing to export yet.');
    return;
  }
  const rows: unknown[][] = [
    [
      'Title',
      'Project',
      'Status',
      'Priority',
      'Assignee',
      'Due',
      'Tags',
      'Subtasks done',
      'Subtasks total',
      'Created',
    ],
  ];
  doc.tasks
    .slice()
    .sort(SORTS.due)
    .forEach((t) =>
      rows.push([
        t.title,
        projectOf(doc, t).name,
        statusLabel(t.status),
        t.priority,
        (member(t.assignee) || { name: '' }).name,
        t.due,
        t.tags.join(' '),
        t.subtasks.filter((s) => s.done).length,
        t.subtasks.length,
        new Date(t.createdAt).toISOString(),
      ])
    );
  download(`taskflow-${todayISO()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
}

/** Restore a JSON backup chosen in Settings. Returns true when it was imported. */
export async function importJSON(file: File) {
  if (file.size > 5e6) {
    toast('That file is too large to import.');
    return false;
  }
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.tasks)) throw new Error('Not a TaskFlow backup');
    const next = normalize(data);
    replaceDoc(
      next,
      `Imported ${next.tasks.length} task${next.tasks.length === 1 ? '' : 's'} (replaced current data)`
    );
    return true;
  } catch {
    toast('That file is not a valid TaskFlow backup.');
    return false;
  }
}
