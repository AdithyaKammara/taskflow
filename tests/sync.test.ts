import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

/*
 * The cloud sync engine against a fake Supabase client and a fake store: what it writes after a
 * save, how it retries, what it does with realtime events and how it catches up after a reconnect.
 */

const h = vi.hoisted(() => {
  type Row = { id: string; [k: string]: unknown };
  type Doc = { projects: Row[]; tasks: Row[] };
  const state = { doc: { projects: [], tasks: [] } as Doc, syncStatus: 'synced' };
  const calls: { op: string; table: string; ids: string[]; by?: string }[] = [];
  const realtime: { filter: { event: string; table: string }; cb: (p: unknown) => void }[] = [];
  let subscribed: (status: string) => void = () => {};
  const ctl = {
    failWrites: 0,
    saved: (_d: Doc) => {},
    serverDoc: { projects: [], tasks: [] } as Doc,
  };

  const table = (name: string) => ({
    upsert: async (rows: { id: string; updated_by: string }[]) => {
      if (ctl.failWrites > 0) {
        ctl.failWrites--;
        return { error: { message: 'network down' } };
      }
      calls.push({ op: 'upsert', table: name, ids: rows.map((r) => r.id), by: rows[0].updated_by });
      return { error: null };
    },
    delete: () => ({
      eq: () => ({
        in: async (_col: string, ids: string[]) => {
          calls.push({ op: 'delete', table: name, ids });
          return { error: null };
        },
      }),
    }),
  });

  const client = {
    from: table,
    channel: () => {
      const ch = {
        on: (_kind: string, filter: { event: string; table: string }, cb: (p: unknown) => void) => {
          realtime.push({ filter, cb });
          return ch;
        },
        subscribe: (cb: (status: string) => void) => {
          subscribed = cb;
          cb('SUBSCRIBED');
          return ch;
        },
      };
      return ch;
    },
    removeChannel: async () => {},
  };

  return {
    state,
    calls,
    realtime,
    ctl,
    client,
    reconnect: () => subscribed('SUBSCRIBED'),
  };
});

vi.mock('../src/app/store', () => ({
  useApp: {
    getState: () => h.state,
    setState: (p: object) => Object.assign(h.state, p),
  },
  applyRemote: (fn: (d: unknown) => void) => {
    const d = structuredClone(h.state.doc);
    fn(d);
    h.state.doc = d;
  },
  onSaved: (fn: typeof h.ctl.saved) => {
    h.ctl.saved = fn;
  },
}));

vi.mock('../src/lib/supabase/cloud', () => ({
  sb: async () => h.client,
  loadDoc: async () => structuredClone(h.ctl.serverDoc),
}));

const { startSync, stopSync } = await import('../src/lib/supabase/sync');

const task = (id: string, title = id) => ({ id, title });
/** A local save: the store publishes the new document and the engine diffs it. */
const save = (tasks: { id: string }[]) => {
  h.state.doc = { projects: [], tasks };
  h.ctl.saved(h.state.doc);
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const emit = (event: string, table: string, payload: object) => {
  for (const r of h.realtime) {
    if (r.filter.table === table && (r.filter.event === event || r.filter.event === '*')) {
      r.cb({ eventType: event, ...payload });
    }
  }
};

describe('cloud sync', () => {
  beforeEach(async () => {
    h.calls.length = 0;
    h.realtime.length = 0;
    h.ctl.failWrites = 0;
    h.state.doc = { projects: [], tasks: [task('a'), task('b')] };
    await startSync('ws-1', async () => {});
  });

  afterEach(async () => {
    vi.useRealTimers();
    await stopSync();
  });

  it('writes only the rows that changed since the last sync', async () => {
    save([task('a', 'A edited'), task('b'), task('c')]);
    await settle();
    assert.deepEqual(
      h.calls.map((c) => [c.op, c.table, c.ids]),
      [['upsert', 'tasks', ['a', 'c']]]
    );
    assert.equal(h.state.syncStatus, 'synced');
  });

  it('deletes rows that disappeared', async () => {
    save([task('a')]);
    await settle();
    assert.deepEqual(
      h.calls.map((c) => [c.op, c.ids]),
      [['delete', ['b']]]
    );
  });

  it('marks itself offline after a failed write and resends the same rows 5 seconds later', async () => {
    vi.useFakeTimers();
    h.ctl.failWrites = 1;
    save([task('a', 'changed'), task('b')]);
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(h.state.syncStatus, 'offline');
    assert.equal(h.calls.length, 0);
    await vi.advanceTimersByTimeAsync(5000);
    assert.deepEqual(
      h.calls.map((c) => c.ids),
      [['a']]
    );
    assert.equal(h.state.syncStatus, 'synced');
  });

  it("applies a teammate's change but ignores the echo of its own writes", async () => {
    save([task('a', 'mine'), task('b')]);
    await settle();
    const myTab = h.calls[0].by;
    emit('UPDATE', 'tasks', {
      new: { workspace_id: 'ws-1', id: 'a', data: { title: 'echo' }, updated_by: myTab },
    });
    emit('INSERT', 'tasks', {
      new: {
        workspace_id: 'ws-1',
        id: 'z',
        data: { title: 'from Priya' },
        updated_by: 'tab-other',
      },
    });
    emit('INSERT', 'tasks', {
      new: {
        workspace_id: 'ws-OTHER',
        id: 'y',
        data: { title: 'other workspace' },
        updated_by: 'x',
      },
    });
    await settle();
    const titles = h.state.doc.tasks.map((t) => t.title);
    assert.deepEqual(titles, ['mine', 'b', 'from Priya']);
    // the remote row is now known to the server, so the next save does not send it back
    h.calls.length = 0;
    save([...h.state.doc.tasks]);
    await settle();
    assert.equal(h.calls.length, 0);
  });

  it('applies remote deletes for this workspace only', async () => {
    emit('DELETE', 'tasks', { old: { workspace_id: 'ws-OTHER', id: 'a' } });
    emit('DELETE', 'tasks', { old: { workspace_id: 'ws-1', id: 'b' } });
    await settle();
    assert.deepEqual(
      h.state.doc.tasks.map((t) => t.id),
      ['a']
    );
  });

  it('reloads the whole workspace after a reconnect', async () => {
    h.ctl.serverDoc = { projects: [], tasks: [task('a'), task('missed', 'changed while offline')] };
    h.reconnect();
    await settle();
    await settle();
    assert.deepEqual(
      h.state.doc.tasks.map((t) => t.id),
      ['a', 'missed']
    );
  });
});
