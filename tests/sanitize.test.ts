import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cleanTags, normalize, sanitizeTask } from '../src/lib/model/sanitize';

/** For inputs that must produce a task: fails loudly instead of returning null. */
const task = (raw: unknown) => sanitizeTask(raw)!;

describe('sanitizeTask', () => {
  it('rejects values that are not usable tasks', () => {
    assert.equal(sanitizeTask(null), null);
    assert.equal(sanitizeTask('text'), null);
    assert.equal(sanitizeTask({}), null);
    assert.equal(sanitizeTask({ title: '   ' }), null);
  });

  it('upgrades the original v1 shape ({ text, isChecked })', () => {
    const t = task({ text: 'Buy milk', isChecked: true });
    assert.equal(t.title, 'Buy milk');
    assert.equal(t.status, 'done');
    assert.equal(t.project, 'inbox');
  });

  it('clamps and tidies the title', () => {
    const t = task({ title: `  a${' '.repeat(5)}b  ${'x'.repeat(200)}` });
    assert.ok(t.title.startsWith('a b x'));
    assert.equal(t.title.length, 120);
  });

  it('falls back to safe defaults for invalid fields', () => {
    const t = task({
      title: 'T',
      status: 'nonsense',
      priority: 'urgent',
      due: '2026-02-31',
      assignee: 'stranger',
      project: 'bad id!',
    });
    assert.equal(t.status, 'todo');
    assert.equal(t.priority, 'medium');
    assert.equal(t.due, '');
    assert.equal(t.assignee, '');
    assert.equal(t.project, 'inbox');
  });

  it('keeps valid fields', () => {
    const t = task({
      title: 'T',
      status: 'review',
      priority: 'high',
      due: '2026-10-30',
      assignee: 'priya',
      project: 'p-abc123',
    });
    assert.deepEqual(
      [t.status, t.priority, t.due, t.assignee, t.project],
      ['review', 'high', '2026-10-30', 'priya', 'p-abc123']
    );
  });

  it('drops empty subtasks and comments', () => {
    const t = task({
      title: 'T',
      subtasks: [{ text: 'ok', done: 1 }, { text: '   ' }, null],
      comments: [{ text: 'hi', author: 'priya' }, { text: '' }],
    });
    assert.equal(t.subtasks.length, 1);
    assert.equal(t.subtasks[0].done, true);
    assert.equal(t.comments.length, 1);
    assert.equal(t.comments[0].author, 'priya');
  });

  it('only keeps completedAt for finished tasks', () => {
    assert.equal(task({ title: 'T', status: 'todo', completedAt: 123 }).completedAt, null);
    assert.equal(task({ title: 'T', status: 'done', completedAt: 123 }).completedAt, 123);
  });

  it('keeps markup as plain text (the UI renders with textContent, so it is never executed)', () => {
    const t = task({ title: '<img src=x onerror=alert(1)>' });
    assert.equal(t.title, '<img src=x onerror=alert(1)>');
  });
});

describe('cleanTags', () => {
  it('normalises, de-duplicates, validates and limits tags', () => {
    assert.deepEqual(cleanTags(['#Dev', 'dev', 'bad tag!', 'x'.repeat(21), 'ok-1']), [
      'dev',
      'ok-1',
    ]);
    assert.equal(cleanTags(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length, 5);
    assert.deepEqual(cleanTags(undefined), []);
  });
});

describe('normalize', () => {
  it('always provides an Inbox project', () => {
    const d = normalize({});
    assert.deepEqual(
      d.projects.map((p) => p.id),
      ['inbox']
    );
    assert.deepEqual(d.tasks, []);
  });

  it('survives garbage input', () => {
    assert.deepEqual(normalize(null).tasks, []);
    assert.deepEqual(normalize('nope').tasks, []);
    assert.deepEqual(normalize({ tasks: 5, projects: 'x' }).tasks, []);
  });

  it('repairs duplicate task ids and orphaned project references', () => {
    const d = normalize({
      projects: [{ id: 'p-1', name: 'Alpha', color: '#112233' }],
      tasks: [
        { id: 'same', title: 'One', project: 'p-1' },
        { id: 'same', title: 'Two', project: 'p-gone' },
      ],
    });
    assert.notEqual(d.tasks[0].id, d.tasks[1].id);
    assert.equal(d.tasks[0].project, 'p-1');
    assert.equal(d.tasks[1].project, 'inbox');
  });

  it('drops invalid and duplicate projects and fixes bad colours', () => {
    const d = normalize({
      projects: [
        { id: 'p-1', name: 'Alpha', color: 'red' },
        { id: 'p-1', name: 'Duplicate', color: '#112233' },
        { id: '', name: 'No id' },
        { id: 'p-2', name: '   ' },
      ],
    });
    const alpha = d.projects.find((p) => p.id === 'p-1');
    assert.equal(d.projects.filter((p) => p.id === 'p-1').length, 1);
    assert.match(alpha!.color, /^#[0-9a-f]{6}$/i);
    assert.equal(d.projects.length, 2); // Inbox + Alpha
  });
});
