import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';

/*
 * Invite links must not move a signed-in person into a workspace by themselves: signing in with a
 * pending invite only asks (pendingInvite), and the invite is accepted when they confirm.
 */

const TOKEN = '0123456789abcdef0123456789abcdef';

const h = vi.hoisted(() => {
  const prefs = new Map<string, string>();
  return {
    prefs,
    auth: null as null | ((event: string, session: unknown) => Promise<void>),
    workspaces: [{ id: 'ws-home', name: 'Home', owner: 'u1', created_at: '1' }],
    acceptInvite: vi.fn(async () => 'ws-joined'),
    opened: [] as string[],
  };
});

// the browser globals storage.ts and captureInvite() touch
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => (h.prefs.has(k) ? h.prefs.get(k)! : null),
    setItem: (k: string, v: string) => h.prefs.set(k, String(v)),
  },
  location: { search: '', pathname: '/taskflow/', hash: '' },
  history: { replaceState: () => {} },
});

vi.mock('../src/app/store', () => ({
  replaceAll: () => {},
  setMembers: () => {},
  toast: () => {},
  useApp: { setState: () => {}, getState: () => ({}) },
}));

vi.mock('../src/lib/supabase/env', () => ({ cloudEnabled: () => true }));

vi.mock('../src/lib/supabase/sync', () => ({
  startSync: async () => {},
  stopSync: async () => {},
}));

vi.mock('../src/lib/supabase/cloud', () => ({
  onAuthChange: async (fn: typeof h.auth) => {
    h.auth = fn;
  },
  listWorkspaces: async () => h.workspaces,
  listMembers: async (id: string) => {
    h.opened.push(id);
    return [{ id: 'u1', name: 'Me', email: 'me@example.com', role: 'owner' }];
  },
  loadDoc: async () => ({ projects: [], tasks: [] }),
  acceptInvite: h.acceptInvite,
  createWorkspace: async () => 'ws-new',
}));

const { initSession, acceptPendingInvite, declinePendingInvite, useSession } =
  await import('../src/features/auth/session');

const settle = () => new Promise((r) => setTimeout(r, 0));
const session = { user: { id: 'u1', email: 'me@example.com', user_metadata: { name: 'Me' } } };

describe('invite links', () => {
  beforeEach(() => {
    h.acceptInvite.mockClear();
    h.opened.length = 0;
  });

  it('signing in with an invite pending asks first and does not join', async () => {
    h.prefs.set('todo-app:invite', TOKEN);
    await initSession();
    await h.auth!('SIGNED_IN', session);
    await settle();
    assert.equal(h.acceptInvite.mock.calls.length, 0);
    assert.equal(useSession.getState().pendingInvite, true);
    assert.equal(useSession.getState().workspaceId, 'ws-home');
    assert.equal(h.prefs.get('todo-app:workspace'), 'ws-home');
  });

  it('confirming joins, opens the workspace and makes it the default', async () => {
    h.workspaces = [
      ...h.workspaces,
      { id: 'ws-joined', name: 'Team', owner: 'u2', created_at: '2' },
    ];
    await acceptPendingInvite();
    assert.deepEqual(h.acceptInvite.mock.calls, [[TOKEN]]);
    assert.equal(h.prefs.get('todo-app:invite'), '');
    assert.equal(useSession.getState().pendingInvite, false);
    assert.equal(useSession.getState().workspaceId, 'ws-joined');
    assert.equal(h.prefs.get('todo-app:workspace'), 'ws-joined');
  });

  it('declining forgets the invite without joining', async () => {
    h.prefs.set('todo-app:invite', TOKEN);
    useSession.setState({ pendingInvite: true });
    declinePendingInvite();
    assert.equal(h.acceptInvite.mock.calls.length, 0);
    assert.equal(h.prefs.get('todo-app:invite'), '');
    assert.equal(useSession.getState().pendingInvite, false);
    assert.deepEqual(h.opened, []);
  });
});
