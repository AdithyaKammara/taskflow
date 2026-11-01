import { test } from 'vitest';
import assert from 'node:assert/strict';
import { applyRow, diffDoc, diffIndex, index } from '../src/lib/model/diff';

test('diffIndex finds new, changed and removed rows', () => {
  const prev = index([
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]);
  const next = index([
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B2' },
    { id: 'd', title: 'D' },
  ]);
  assert.deepEqual(diffIndex(prev, next), { upserts: ['b', 'd'], deletes: ['c'] });
});

test('diffIndex reports nothing for identical documents', () => {
  const rows = [{ id: 'a', tags: ['x'] }];
  assert.deepEqual(diffIndex(index(rows), index(structuredClone(rows))), {
    upserts: [],
    deletes: [],
  });
});

test('diffDoc diffs projects and tasks separately and returns the next indexes', () => {
  const synced = { projects: index([{ id: 'inbox', name: 'Inbox' }]), tasks: index([]) };
  const doc = { projects: [{ id: 'inbox', name: 'Inbox' }], tasks: [{ id: 't1', title: 'New' }] };
  const d = diffDoc(synced, doc);
  assert.deepEqual(d.projects, { upserts: [], deletes: [] });
  assert.deepEqual(d.tasks, { upserts: ['t1'], deletes: [] });
  assert.equal(d.next.tasks.get('t1'), JSON.stringify(doc.tasks[0]));
});

test('applyRow inserts, replaces and deletes without mutating the input', () => {
  const rows = [{ id: 'a', v: 1 }];
  const added = applyRow(rows, 'b', { id: 'b', v: 2 });
  assert.equal(added.length, 2);
  const replaced = applyRow(added, 'a', { id: 'a', v: 9 });
  assert.equal(replaced[0].v, 9);
  assert.equal(rows[0].v, 1);
  assert.deepEqual(applyRow(replaced, 'a', null), [{ id: 'b', v: 2 }]);
  assert.equal(applyRow(rows, 'zzz', null), rows);
});
