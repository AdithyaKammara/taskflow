/**
 * Accounts and teams (cloud mode only): the session, the sign-in screens' actions, workspaces,
 * members, invites and log out. Ported from v6 src/ui/account.js; the screens themselves are
 * AuthScreen.tsx, the sidebar pieces Account.tsx and the dialog TeamDialog.tsx.
 */
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { replaceAll, setMembers, toast, useApp } from '../../app/store';
import { KEYS, PROJECT_COLORS } from '../../lib/config';
import {
  acceptInvite,
  createInvite,
  createWorkspace,
  currentUser,
  listMembers,
  listWorkspaces,
  loadDoc,
  onAuthChange,
  removeMember,
  sendReset,
  setPassword,
  signIn,
  signOut,
  signUp,
  type Workspace,
  type WorkspaceMember,
} from '../../lib/supabase/cloud';
import { cloudEnabled } from '../../lib/supabase/env';
import { startSync, stopSync } from '../../lib/supabase/sync';
import { readPref, writePref } from '../../lib/store/storage';
import { clean } from '../../lib/utils/text';

export const MIN_PASSWORD = 8;

export type Screen = 'loading' | 'signin' | 'signup' | 'reset' | 'sent' | 'newpw';

interface SessionState {
  /** 'off' in local mode; otherwise whether the app or a sign-in screen is shown. */
  status: 'off' | 'auth' | 'in';
  screen: Screen;
  /** Loading message, or the address a "check your email" screen names. */
  screenArg: string;
  /** Error shown on the sign-in screen when it opens (e.g. a workspace failed to load). */
  screenError: string;
  user: { id: string; name: string; email: string } | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  members: WorkspaceMember[];
  /** An invite link was opened: ask before joining (a link alone must not move anyone in). */
  pendingInvite: boolean;
}

export const useSession = create<SessionState>(() => ({
  status: cloudEnabled() ? 'auth' : 'off',
  screen: 'loading',
  screenArg: '',
  screenError: '',
  user: null,
  workspaces: [],
  workspaceId: null,
  members: [],
  pendingInvite: false,
}));

const set = useSession.setState;
const get = useSession.getState;

let recovering = false;

/** A stable colour per member, so avatars match across devices. */
export const colorFor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
};

export const myRole = () => get().members.find((m) => m.id === get().user?.id)?.role;
export const currentWorkspace = () => get().workspaces.find((w) => w.id === get().workspaceId);

export function showAuth(screen: Screen, screenArg = '', screenError = '') {
  set({ status: 'auth', screen, screenArg, screenError });
}

// ---------- sign-in screens ----------

export interface AuthFields {
  name: string;
  email: string;
  password: string;
}

/** Client-side checks before anything is sent. Returns [field, message] or null. */
export function validate(kind: Screen, f: AuthFields): [keyof AuthFields, string] | null {
  if (kind === 'signup' && !f.name.trim()) return ['name', 'Enter your name.'];
  if (kind !== 'newpw' && !/^\S+@\S+\.\S+$/.test(f.email.trim())) {
    return ['email', 'Enter a valid email address.'];
  }
  if (kind === 'signin' && !f.password) return ['password', 'Enter your password.'];
  if ((kind === 'signup' || kind === 'newpw') && f.password.length < MIN_PASSWORD) {
    return ['password', `Use at least ${MIN_PASSWORD} characters.`];
  }
  return null;
}

/** Runs a sign-in screen's form. Throws an Error with a message to show next to the form. */
export async function submitAuth(kind: Screen, f: AuthFields) {
  const email = f.email.trim();
  if (kind === 'signin') {
    await signIn(email, f.password);
  } else if (kind === 'signup') {
    if (await signUp(clean(f.name, 60), email, f.password)) showAuth('sent', email);
  } else if (kind === 'reset') {
    await sendReset(email);
    showAuth('sent', email);
  } else if (kind === 'newpw') {
    await setPassword(f.password);
    recovering = false;
    toast('Password updated');
    const signedIn = await currentUser();
    if (signedIn) await enter(signedIn);
  }
  // sign-in and a confirmed sign-up: the auth listener takes over from here
}

// ---------- session ----------

async function handleAuth(event: AuthChangeEvent, session: Session | null) {
  if (event === 'PASSWORD_RECOVERY') {
    recovering = true;
    return showAuth('newpw');
  }
  if (recovering) return; // stay on "choose a new password" until it is saved
  const { user } = get();
  if (!session) {
    if (user) await leaveApp();
    return showAuth('signin');
  }
  if (user && session.user.id === user.id) return; // token refresh
  await enter(session.user);
}

async function enter(authUser: User) {
  const user = {
    id: authUser.id,
    email: authUser.email || '',
    name: (authUser.user_metadata && authUser.user_metadata.name) || authUser.email || 'You',
  };
  set({ user });
  showAuth('loading', 'Opening your workspace…');
  try {
    let workspaces = await listWorkspaces();
    if (!workspaces.length) {
      await createWorkspace(`${user.name.split(' ')[0]}'s workspace`);
      workspaces = await listWorkspaces();
    }
    set({ workspaces });
    const saved = readPref(KEYS.workspace);
    await openWorkspace(workspaces.some((w) => w.id === saved) ? saved! : workspaces[0].id);
    // an invite is only accepted once the person confirms it (InviteDialog)
    set({ status: 'in', pendingInvite: Boolean(readPref(KEYS.invite)) });
  } catch (err) {
    set({ user: null });
    showAuth('signin', '', `Could not open your workspace: ${(err as Error).message}`);
  }
}

async function leaveApp() {
  await stopSync();
  set({ user: null, workspaceId: null, workspaces: [], members: [], pendingInvite: false });
  setMembers([], '');
  replaceAll({});
  useApp.setState({ dialog: null });
}

function applyMembers(list: WorkspaceMember[]) {
  set({ members: list });
  setMembers(
    list.map((m) => ({ id: m.id, name: m.name, color: colorFor(m.id) })),
    get().user!.id
  );
}

export async function openWorkspace(id: string) {
  const [list, doc] = await Promise.all([listMembers(id), loadDoc(id)]);
  set({ workspaceId: id });
  writePref(KEYS.workspace, id);
  applyMembers(list); // before the document, so assignees are recognised when it is sanitised
  replaceAll(doc);
  await startSync(id, refreshMembers);
}

async function refreshMembers() {
  const { workspaceId, user } = get();
  if (!workspaceId || !user) return;
  const list = await listMembers(workspaceId).catch(() => null);
  if (!list) return;
  if (!list.some((m) => m.id === user.id)) {
    toast(`You are no longer a member of ${currentWorkspace()?.name || 'that workspace'}`);
    return switchAfterLeaving();
  }
  applyMembers(list);
}

async function switchAfterLeaving() {
  let workspaces = await listWorkspaces();
  if (!workspaces.length) {
    await createWorkspace(`${get().user!.name.split(' ')[0]}'s workspace`);
    workspaces = await listWorkspaces();
  }
  set({ workspaces });
  await openWorkspace(workspaces[0].id);
}

// ---------- workspace and team actions (sidebar and Team dialog) ----------

export async function switchWorkspace(id: string) {
  try {
    await openWorkspace(id);
    useApp.setState({ navOpen: false });
  } catch (err) {
    toast(`Could not open workspace: ${(err as Error).message}`);
  }
}

/** Creates a workspace and opens it. Throws with a message for the form. */
export async function newWorkspace(raw: string) {
  const name = clean(raw, 60);
  if (!name) throw new Error('Give the workspace a name.');
  const id = await createWorkspace(name);
  set({ workspaces: await listWorkspaces() });
  await openWorkspace(id);
  toast(`Created ${name}`);
}

export const inviteLink = () => createInvite(get().workspaceId!);

/** The person confirmed the invite: join, open that workspace and remember it as the default. */
export async function acceptPendingInvite() {
  const token = readPref(KEYS.invite);
  writePref(KEYS.invite, '');
  set({ pendingInvite: false });
  if (!token) return;
  try {
    const id = await acceptInvite(token);
    set({ workspaces: await listWorkspaces() });
    await openWorkspace(id);
    toast(`You joined ${currentWorkspace()?.name || 'the workspace'}`);
  } catch (err) {
    toast((err as Error).message);
  }
}

/** The person said no (or closed the question): forget the invite; the link still works later. */
export function declinePendingInvite() {
  writePref(KEYS.invite, '');
  set({ pendingInvite: false });
}

export async function removeFromWorkspace(userId: string) {
  try {
    await removeMember(get().workspaceId!, userId);
    await refreshMembers();
    toast('Member removed');
  } catch (err) {
    toast((err as Error).message);
  }
}

export async function leaveWorkspace() {
  try {
    const name = currentWorkspace()?.name;
    await removeMember(get().workspaceId!, get().user!.id);
    useApp.setState({ dialog: null });
    await switchAfterLeaving();
    toast(`You left ${name}`);
  } catch (err) {
    toast((err as Error).message);
  }
}

export async function logOut() {
  try {
    await signOut();
  } catch (err) {
    toast((err as Error).message);
  }
}

// ---------- start ----------

/** Remember an invite token from the URL (it survives the email confirmation round trip). */
function captureInvite() {
  const params = new URLSearchParams(location.search);
  const token = params.get('invite');
  if (!token) return;
  if (/^[a-f0-9]{16,64}$/i.test(token)) writePref(KEYS.invite, token);
  params.delete('invite');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
}

/** Cloud mode: watch the session and show sign-in or the workspace. Local mode: nothing to do. */
export async function initSession() {
  if (!cloudEnabled()) return;
  captureInvite();
  try {
    await onAuthChange(handleAuth);
  } catch {
    showAuth(
      'signin',
      '',
      'Could not reach the TaskFlow server. Check your connection and reload the page.'
    );
  }
}
