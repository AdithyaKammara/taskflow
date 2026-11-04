/**
 * Selectors: pure functions that derive data from `state` (and the `ui` filter settings).
 * They take everything they need as arguments, so they can be unit-tested without a browser.
 */
import { ME, PRIORITY_WEIGHT, STATUS_IDS, TEAM } from '../config';
import type { Doc, Priority, StatusId, Task } from '../types';
import { DAY_MS, addDays, diffDays, todayISO, toISO } from '../utils/dates';

/** The filter settings selectors read from the UI state. */
export interface Filters {
  project: string;
  /** Each list means "any of these"; an empty list means no filter. */
  statuses: StatusId[];
  priorities: Priority[];
  /** Member ids; '' stands for unassigned. */
  assignees: string[];
  /** Due-date range, local `YYYY-MM-DD` or '' for open-ended. Tasks with no due date are left out. */
  dueFrom: string;
  dueTo: string;
  search: string;
  /** 'all' | 'today' | 'overdue' | 'unassigned' | '#tag' */
  quickChip: string;
}

export const byId = (state: Doc, id: string) => state.tasks.find((t) => t.id === id);

export const projectOf = (state: Doc, t: Task) =>
  state.projects.find((p) => p.id === t.project) || state.projects[0];

export const projectTasks = (state: Doc, ui: Pick<Filters, 'project'>) =>
  state.tasks.filter((t) => !ui.project || t.project === ui.project);

/** How many filter-panel groups are in use (status, priority, assignee, due date). */
export const panelFilterCount = (ui: Filters) =>
  [ui.statuses.length, ui.priorities.length, ui.assignees.length, ui.dueFrom || ui.dueTo].filter(
    Boolean
  ).length;

/** Applies the filter panel, quick chip and search to the current project's tasks. */
export function filteredTasks(state: Doc, ui: Filters, now = new Date()) {
  const q = ui.search.trim().toLowerCase();
  const chip = ui.quickChip;
  const today = todayISO(now);
  return projectTasks(state, ui).filter((t) => {
    if (ui.statuses.length && !ui.statuses.includes(t.status)) return false;
    if (ui.priorities.length && !ui.priorities.includes(t.priority)) return false;
    if (ui.assignees.length && !ui.assignees.includes(t.assignee)) return false;
    if (ui.dueFrom || ui.dueTo) {
      if (!t.due || (ui.dueFrom && t.due < ui.dueFrom) || (ui.dueTo && t.due > ui.dueTo)) {
        return false;
      }
    }
    if (chip === 'today' && (t.status === 'done' || t.due !== today)) return false;
    if (chip === 'overdue' && (t.status === 'done' || !t.due || diffDays(t.due, now) >= 0)) {
      return false;
    }
    if (chip === 'unassigned' && (t.status === 'done' || t.assignee !== '')) return false;
    if (chip.startsWith('#') && !t.tags.includes(chip.slice(1))) return false;
    if (
      q &&
      !(
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((g) => g.includes(q))
      )
    ) {
      return false;
    }
    return true;
  });
}

type Compare = (a: Task, b: Task) => number;

export const SORTS: Record<'due' | 'priority' | 'newest' | 'title', Compare> = {
  due(a, b) {
    const da = a.status === 'done';
    const db = b.status === 'done';
    if (da !== db) return da ? 1 : -1;
    const x = a.due || '9999-99-99';
    const y = b.due || '9999-99-99';
    if (x !== y) return x < y ? -1 : 1;
    return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.createdAt - b.createdAt;
  },
  priority(a, b) {
    return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || SORTS.due(a, b);
  },
  newest: (a, b) => b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title),
};

/** "What next?" scoring: due date + priority + status + ownership + progress. */
export function scoreTask(t: Task, now = new Date()) {
  let s = 0;
  const why: string[] = [];
  if (t.due) {
    const d = diffDays(t.due, now);
    if (d < 0) {
      s += 60 + Math.min(-d, 10);
      why.push(`overdue by ${-d} day${-d === 1 ? '' : 's'}`);
    } else if (d === 0) {
      s += 50;
      why.push('due today');
    } else if (d === 1) {
      s += 35;
      why.push('due tomorrow');
    } else if (d <= 7) {
      s += 25 - d;
      why.push(`due in ${d} days`);
    }
  }
  s += PRIORITY_WEIGHT[t.priority] * 10;
  if (t.priority === 'high') why.push('high priority');
  if (t.status === 'doing') {
    s += 12;
    why.push('already in progress');
  } else if (t.status === 'review') {
    s += 4;
    why.push('waiting for review');
  }
  if (t.assignee === ME) {
    s += 10;
    why.push('assigned to you');
  } else if (!t.assignee) {
    s += 3;
    why.push('unassigned');
  }
  const n = t.subtasks.length;
  const done = t.subtasks.filter((x) => x.done).length;
  if (n && done > 0 && done < n) {
    s += 5;
    why.push(`${done}/${n} subtasks done`);
  }
  return { t, s, why };
}

/** Top 3 open tasks that belong to the current user or nobody. */
export const rankNext = (state: Doc, ui: Pick<Filters, 'project'>, now = new Date()) =>
  projectTasks(state, ui)
    .filter((t) => t.status !== 'done' && (!t.assignee || t.assignee === ME))
    .map((t) => scoreTask(t, now))
    .sort((a, b) => b.s - a.s || a.t.createdAt - b.t.createdAt)
    .slice(0, 3);

/** Everything the dashboard needs, computed in one place. */
export function dashboardStats(tasks: Task[], now = new Date()) {
  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due && diffDays(t.due, now) < 0);
  const soon = open.filter((t) => t.due && diffDays(t.due, now) >= 0 && diffDays(t.due, now) <= 7);
  const doneWeek = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && now.getTime() - t.completedAt < 7 * DAY_MS
  );
  const doneLastWeek = tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    const age = now.getTime() - t.completedAt;
    return age >= 7 * DAY_MS && age < 14 * DAY_MS;
  });
  const highOpen = open.filter((t) => t.priority === 'high').length;
  const oldestOverdue = overdue.length ? Math.max(...overdue.map((t) => -diffDays(t.due, now))) : 0;
  const nextDue =
    open
      .filter((t) => t.due && diffDays(t.due, now) >= 0)
      .map((t) => t.due)
      .sort()[0] || '';
  const completionPct = tasks.length
    ? Math.round(((tasks.length - open.length) / tasks.length) * 100)
    : 0;
  const counts = Object.fromEntries(
    STATUS_IDS.map((id) => [id, tasks.filter((t) => t.status === id).length])
  ) as Record<StatusId, number>;
  const workload = [
    ...TEAM.map((m) => ({
      id: m.id,
      name: m.name,
      n: open.filter((t) => t.assignee === m.id).length,
    })),
    { id: '', name: 'Unassigned', n: open.filter((t) => !t.assignee).length },
  ];
  const dueList = open
    .filter((t) => t.due)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 6);
  return {
    open,
    overdue,
    soon,
    doneWeek,
    doneLastWeek,
    highOpen,
    oldestOverdue,
    nextDue,
    completionPct,
    counts,
    workload,
    dueList,
  };
}

/** Tasks completed per day for the last `n` days (oldest first). */
export function completionTrend(tasks: Task[], now = new Date(), n = 14) {
  const days = [...Array(n)].map((_, i) => addDays(todayISO(now), i - (n - 1)));
  const counts = days.map(
    (d) => tasks.filter((t) => t.completedAt && toISO(new Date(t.completedAt)) === d).length
  );
  return { days, counts };
}
