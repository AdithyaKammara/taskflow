import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import { storage } from '../src/lib/store/storage';
import { normalize, sanitizeTask } from '../src/lib/model/sanitize';

/** Minimal in-memory localStorage stand-in. */
function installLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const fake = {
    getItem: (k: string) => (data.has(k) ? data.get(k) : null),
    setItem: (k: string, v: string) => {
      if (fake.failWrites) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    failWrites: false,
    data,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: fake,
    configurable: true,
    writable: true,
  });
  return fake;
}

describe('storage', () => {
  beforeEach(() => installLocalStorage());

  it('returns an empty workspace (with Inbox) when nothing is stored', () => {
    const d = storage.load();
    assert.deepEqual(d.tasks, []);
    assert.deepEqual(
      d.projects.map((p) => p.id),
      ['inbox']
    );
  });

  it('round-trips through save() and load()', () => {
    storage.save({
      projects: [{ id: 'inbox', name: 'Inbox', color: '#8a8478' }],
      tasks: [sanitizeTask({ id: 't1', title: 'Hello' })!],
    });
    const d = storage.load();
    assert.equal(d.tasks.length, 1);
    assert.equal(d.tasks[0].title, 'Hello');
  });

  it('migrates the original v1 key ("todos") with its old task shape', () => {
    installLocalStorage({
      todos: JSON.stringify([
        { text: 'Buy milk', uniqueNo: 1, isChecked: true },
        { text: 'Walk dog', uniqueNo: 2, isChecked: false },
      ]),
    });
    const d = storage.load();
    assert.deepEqual(
      d.tasks.map((t) => [t.title, t.status]),
      [
        ['Buy milk', 'done'],
        ['Walk dog', 'todo'],
      ]
    );
  });

  it('migrates v3 data (object with a tasks array)', () => {
    installLocalStorage({
      'todo-app:v3': JSON.stringify({ tasks: [{ id: 'x1', title: 'From v3', priority: 'high' }] }),
    });
    const d = storage.load();
    assert.equal(d.tasks[0].title, 'From v3');
    assert.equal(d.tasks[0].priority, 'high');
  });

  it('prefers current data over older versions', () => {
    installLocalStorage({
      'todo-app:v4': JSON.stringify({ tasks: [{ id: 'n', title: 'New' }] }),
      'todo-app:v3': JSON.stringify({ tasks: [{ id: 'o', title: 'Old' }] }),
    });
    assert.equal(storage.load().tasks[0].title, 'New');
  });

  it('ignores corrupt JSON instead of crashing', () => {
    installLocalStorage({ 'todo-app:v4': '{not json', 'todo-app:v3': '[1,2' });
    assert.deepEqual(storage.load().tasks, []);
  });

  it('reports failure when the browser refuses to save', () => {
    const fake = installLocalStorage();
    assert.equal(storage.save(normalize({})), true);
    fake.failWrites = true;
    assert.equal(storage.save(normalize({})), false);
  });
});
