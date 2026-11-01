import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createHistory } from '../src/lib/store/history';

describe('createHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const h = createHistory(10, 'a');
    assert.equal(h.canUndo, false);
    assert.equal(h.canRedo, false);
    assert.equal(h.undo(), null);
    assert.equal(h.redo(), null);
  });

  it('records changes, ignores identical snapshots, and steps back and forward', () => {
    const h = createHistory(10, 'a');
    assert.equal(h.record('b'), true);
    assert.equal(h.record('b'), false);
    h.record('c');
    assert.equal(h.undo(), 'b');
    assert.equal(h.undo(), 'a');
    assert.equal(h.undo(), null);
    assert.equal(h.redo(), 'b');
    assert.equal(h.redo(), 'c');
    assert.equal(h.redo(), null);
  });

  it('drops the redo stack when a new change is recorded', () => {
    const h = createHistory(10, 'a');
    h.record('b');
    h.undo();
    assert.equal(h.canRedo, true);
    h.record('x');
    assert.equal(h.canRedo, false);
  });

  it('keeps only the newest `limit` undo steps', () => {
    const h = createHistory(3, '0');
    for (let i = 1; i <= 6; i++) h.record(String(i));
    const seen = [];
    for (let s = h.undo(); s !== null; s = h.undo()) seen.push(s);
    assert.deepEqual(seen, ['5', '4', '3']);
  });

  it('reset() forgets history and sync() only moves the current snapshot', () => {
    const h = createHistory(10, 'a');
    h.record('b');
    h.reset('z');
    assert.equal(h.canUndo, false);
    h.record('y');
    h.sync('y2');
    assert.equal(h.undo(), 'z');
  });
});
