/**
 * Everything that talks to Supabase: the client, accounts, workspaces, members and invites.
 * Ported from v6 src/backend/cloud.js. The client is loaded on first use, so local mode never
 * downloads it. Every call throws an Error with a readable message, so the UI can show it next to
 * the form that caused it.
 */
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

let client: SupabaseClient | null = null;

/** The Supabase client, created on first use. */
export async function sb() {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/**
 * The app's base address: where confirmation, reset and invite links send people back. Always the
 * base (not the current page), so Supabase's redirect allow-list needs one entry.
 */
export const appUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href;

/** Unwraps a Supabase result: its data, or a readable Error. */
function check<R extends { data?: unknown; error: { message?: string } | null }>(
  res: R
): NonNullable<R['data']> {
  const { data, error } = res;
  if (!error) return data as NonNullable<R['data']>;
  const msg = error.message || '';
  if (/failed to fetch|network|load failed/i.test(msg)) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  throw new Error(msg || 'Something went wrong. Please try again.');
}

// ---------- accounts ----------

/** Returns true when the account still has to be confirmed from the email Supabase sends. */
export async function signUp(name: string, email: string, password: string) {
  const data = check(
    await (
      await sb()
    ).auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: appUrl() } })
  );
  return !data.session;
}

export async function signIn(email: string, password: string) {
  check(await (await sb()).auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  check(await (await sb()).auth.signOut());
}

export async function sendReset(email: string) {
  check(await (await sb()).auth.resetPasswordForEmail(email, { redirectTo: appUrl() }));
}

export async function setPassword(password: string) {
  check(await (await sb()).auth.updateUser({ password }));
}

/** The signed-in user, or null. */
export async function currentUser() {
  const data = check(await (await sb()).auth.getSession());
  return data.session ? data.session.user : null;
}

/** Calls `fn(event, session)` on sign-in, sign-out, token refresh and password recovery. */
export async function onAuthChange(fn: (event: AuthChangeEvent, session: Session | null) => void) {
  (await sb()).auth.onAuthStateChange((event, session) => {
    // run outside Supabase's auth lock, as its docs advise, so our own queries do not deadlock
    setTimeout(() => fn(event, session), 0);
  });
}

// ---------- workspaces ----------

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return check(
    await (
      await sb()
    )
      .from('workspaces')
      .select('id, name, owner, created_at')
      .order('created_at', { ascending: true })
  );
}

export async function createWorkspace(name: string) {
  // the id is made here: the owner's membership row is added by a trigger, after the insert
  const id = crypto.randomUUID();
  check(await (await sb()).from('workspaces').insert({ id, name }));
  return id;
}

/** Members of a workspace, owner first. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const c = await sb();
  const rows: { user_id: string; role: 'owner' | 'member' }[] = check(
    await c
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true })
  );
  const ids = rows.map((r) => r.user_id);
  const profiles: { id: string; name: string; email: string }[] = ids.length
    ? check(await c.from('profiles').select('id, name, email').in('id', ids))
    : [];
  return rows
    .map((r) => {
      const p = profiles.find((x) => x.id === r.user_id);
      return {
        id: r.user_id,
        name: p?.name || p?.email || 'Member',
        email: p?.email || '',
        role: r.role,
      };
    })
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));
}

export async function removeMember(workspaceId: string, userId: string) {
  check(
    await (
      await sb()
    )
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
  );
}

/** Creates a 7-day invite and returns the link to share. */
export async function createInvite(workspaceId: string) {
  const row: { token: string } = check(
    await (
      await sb()
    )
      .from('workspace_invites')
      .insert({ workspace_id: workspaceId })
      .select('token')
      .single()
  );
  return `${appUrl()}?invite=${row.token}`;
}

/** Joins the workspace behind an invite token and returns its id. */
export async function acceptInvite(token: string): Promise<string> {
  return check(await (await sb()).rpc('accept_invite', { invite_token: token }));
}

/** The workspace's projects and tasks as a plain `{ projects, tasks }` document (not yet sanitised). */
export async function loadDoc(workspaceId: string) {
  const c = await sb();
  const [projects, tasks] = await Promise.all([
    c.from('projects').select('id, data').eq('workspace_id', workspaceId),
    c.from('tasks').select('id, data').eq('workspace_id', workspaceId),
  ]);
  const rows = (res: {
    data: { id: string; data: object }[] | null;
    error: { message?: string } | null;
  }) => (check(res) || []).map((r) => ({ ...r.data, id: r.id }) as Record<string, unknown>);
  return { projects: rows(projects), tasks: rows(tasks) };
}
