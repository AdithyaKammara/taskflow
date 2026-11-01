import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { normalize } from '../src/lib/model/sanitize';
import {
  SORTS,
  completionTrend,
  dashboardStats,
  filteredTasks,
  rankNext,
  scoreTask,
} from '../src/lib/model/selectors';

const NOW = new Date(2026, 9, 26, 12, 0); // Mon 26 Oct 2026
const iso = (offset: number) => {
  const d = new Date(2026, 9, 26 + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const state = normalize({
  tasks: [
    {
      id: 'a',
      title: 'Overdue high',
      priority: 'high',
      due: iso(-2),
      assignee: 'me',
      tags: ['dev'],
    },
    { id: 'b', title: 'Due today', priority: 'medium', due: iso(0), assignee: 'priya' },
    { id: 'c', title: 'Next week', priority: 'low', due: iso(8), assignee: '' },
    {
      id: 'd',
      title: 'Finished',
      status: 'done',
      priority: 'high',
      completedAt: NOW.getTime() - 3600_000,
    },
    {
      id: 'e',
      title: 'Unassigned doing',
      status: 'doing',
      assignee: '',
      description: 'needle in text',
    },
  ],
});

const ui = (over = {}) => ({
  project: '',
  assignee: '',
  priority: '',
  search: '',
  quickChip: 'all',
  ...over,
});
const ids = (list: { id: string }[]) => list.map((t) => t.id).sort();

describe('filteredTasks', () => {
  it('returns everything with no filters', () => {
    assert.equal(filteredTasks(state, ui(), NOW).length, 5);
  });

  it('filters by assignee, priority and project', () => {
    assert.deepEqual(ids(filteredTasks(state, ui({ assignee: 'priya' }), NOW)), ['b']);
    assert.deepEqual(ids(filteredTasks(state, ui({ priority: 'high' }), NOW)), ['a', 'd']);
    assert.equal(filteredTasks(state, ui({ project: 'p-none' }), NOW).length, 0);
  });

  it('supports the quick chips', () => {
    assert.deepEqual(ids(filteredTasks(state, ui({ quickChip: 'today' }), NOW)), ['b']);
    assert.deepEqual(ids(filteredTasks(state, ui({ quickChip: 'overdue' }), NOW)), ['a']);
    assert.deepEqual(ids(filteredTasks(state, ui({ quickChip: 'unassigned' }), NOW)), ['c', 'e']);
    assert.deepEqual(ids(filteredTasks(state, ui({ quickChip: '#dev' }), NOW)), ['a']);
  });

  it('searches title, description and tags, case-insensitively', () => {
    assert.deepEqual(ids(filteredTasks(state, ui({ search: 'OVERDUE' }), NOW)), ['a']);
    assert.deepEqual(ids(filteredTasks(state, ui({ search: 'needle' }), NOW)), ['e']);
    assert.deepEqual(ids(filteredTasks(state, ui({ search: 'dev' }), NOW)), ['a']);
  });
});

describe('SORTS', () => {
  it('sorts by due date with finished tasks last', () => {
    const sorted = [...state.tasks].sort(SORTS.due).map((t) => t.id);
    assert.deepEqual(sorted.slice(0, 3), ['a', 'b', 'c']);
    assert.equal(sorted.at(-1), 'd');
  });
});

describe('scoreTask / rankNext', () => {
  it('ranks an overdue high-priority task above one due today', () => {
    const [a, b] = ['a', 'b'].map((id) =>
      scoreTask(
        state.tasks.find((t) => t.id === id)!,
        NOW
      )
    );
    assert.ok(a.s > b.s);
    assert.ok(a.why.includes('overdue by 2 days'));
    assert.ok(b.why.includes('due today'));
  });

  it('only suggests open tasks that are yours or unassigned, max three', () => {
    const top = rankNext(state, ui(), NOW);
    assert.ok(top.length <= 3);
    assert.ok(top.every((r) => r.t.status !== 'done'));
    assert.ok(top.every((r) => r.t.assignee === 'me' || r.t.assignee === ''));
    assert.equal(top[0].t.id, 'a');
  });
});

describe('dashboardStats extras', () => {
  it('reports open high-priority tasks, oldest overdue and next due date', () => {
    const s = dashboardStats(state.tasks, NOW);
    assert.equal(s.highOpen, 1);
    assert.equal(s.oldestOverdue, 2);
    assert.equal(s.nextDue, iso(0));
  });

  it('has no next due date and no overdue when nothing is scheduled', () => {
    const s = dashboardStats([], NOW);
    assert.equal(s.nextDue, '');
    assert.equal(s.oldestOverdue, 0);
  });

  it('counts completions from the previous 7 days separately', () => {
    const day = 86400000;
    const s = dashboardStats(
      normalize({
        tasks: [
          { id: 'x', title: 'This week', status: 'done', completedAt: NOW.getTime() - 2 * day },
          { id: 'y', title: 'Last week', status: 'done', completedAt: NOW.getTime() - 9 * day },
          { id: 'z', title: 'Too old', status: 'done', completedAt: NOW.getTime() - 20 * day },
        ],
      }).tasks,
      NOW
    );
    assert.equal(s.doneWeek.length, 1);
    assert.equal(s.doneLastWeek.length, 1);
  });
});

describe('dashboardStats / completionTrend', () => {
  it('counts open, overdue, upcoming and recently completed tasks', () => {
    const s = dashboardStats(state.tasks, NOW);
    assert.equal(s.open.length, 4);
    assert.equal(s.overdue.length, 1);
    assert.equal(s.soon.length, 1); // only "Due today"
    assert.equal(s.doneWeek.length, 1);
    assert.equal(s.completionPct, 20);
    assert.equal(s.counts.done, 1);
    assert.equal(s.workload.find((w) => w.id === '')!.n, 2);
  });

  it('builds a 14-day completion series ending today', () => {
    const { days, counts } = completionTrend(state.tasks, NOW);
    assert.equal(days.length, 14);
    assert.equal(days.at(-1), iso(0));
    assert.equal(counts.at(-1), 1);
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      1
    );
  });
});

describe('completionTrend range', () => {
  it('returns one bucket per requested day, oldest first', () => {
    for (const n of [7, 14, 30]) {
      const t = completionTrend(state.tasks, NOW, n);
      assert.equal(t.days.length, n);
      assert.equal(t.counts.length, n);
      assert.equal(t.days.at(-1), iso(0));
    }
  });
});
