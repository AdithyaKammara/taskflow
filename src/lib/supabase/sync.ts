/**
 * Live sync of the open workspace with Supabase (ported line for line from v6 src/backend/sync.js).
 *
 * Outgoing: after every local save the store calls its `onSaved` listeners; we diff the document
 * against what the server last confirmed and upsert or delete only those rows. Writes run one at a
 * time, in order. A failed write is forgotten as "saved" and retried every 5 seconds.
 * Incoming: a realtime channel delivers teammates' inserts, updates and deletes, which are applied
 * with `applyRemote()` (no undo step, not echoed back). Our own writes carry this tab's id in
 * `updated_by`, so their echoes are ignored. After a dropped connection, the whole workspace is
 * loaded again. Conflicts resolve per task: the last write wins.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { applyRemote, onSaved, useApp } from '../../app/store';
import { member } from '../model/meta';
import { applyRow, diffDoc, index, type DocIndex } from '../model/diff';
import type { Doc, Project, Task } from '../types';
import { uid } from '../utils/text';
import { loadDoc, sb } from './cloud';

export type SyncStatus = 'synced' | 'saving' | 'offline';

const TAB_ID = 'tab-' + uid();
const TABLES = ['projects', 'tasks'] as const;
type Table = (typeof TABLES)[number];
const RETRY_MS = 5000;

let workspaceId: string | null = null;
let synced: DocIndex = { projects: new Map(), tasks: new Map() };
let channel: RealtimeChannel | null = null;
let refreshMembers: () => Promise<void> = async () => {};
let queue: Promise<void> = Promise.resolve();
let pending = 0;
let failed = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let wasSubscribed = false;

/** 'synced' | 'saving' | 'offline'. The sidebar shows it next to the account. */
function setStatus() {
  useApp.setState({ syncStatus: failed ? 'offline' : pending ? 'saving' : 'synced' });
}

const snapshotOf = (doc: Doc): DocIndex => ({
  projects: index(doc.projects),
  tasks: index(doc.tasks),
});

async function write(table: Table, upserts: { id: string }[], deletes: string[]) {
  const client = await sb();
  if (upserts.length) {
    const at = new Date().toISOString();
    const rows = upserts.map((row) => ({
      workspace_id: workspaceId,
      id: row.id,
      data: row,
      updated_by: TAB_ID,
      updated_at: at,
    }));
    const { error } = await client.from(table).upsert(rows);
    if (error) throw error;
  }
  if (deletes.length) {
    const { error } = await client
      .from(table)
      .delete()
      .eq('workspace_id', workspaceId)
      .in('id', deletes);
    if (error) throw error;
  }
}

/** Queue the difference between `doc` and the last synced snapshot. */
function flush(doc: Doc) {
  if (!workspaceId) return;
  const d = diffDoc(synced, doc);
  const jobs = TABLES.map((table) => ({
    table,
    upserts: d[table].upserts.map((id) => JSON.parse(d.next[table].get(id)!) as { id: string }),
    deletes: d[table].deletes,
    before: synced[table],
  })).filter((j) => j.upserts.length || j.deletes.length);
  if (!jobs.length) return;
  synced = d.next;
  const ws = workspaceId;
  pending++;
  setStatus();
  queue = queue
    .then(async () => {
      if (ws !== workspaceId) return; // switched workspace while queued
      for (const j of jobs) await write(j.table, j.upserts, j.deletes);
      failed = false;
    })
    .catch(() => {
      if (ws !== workspaceId) return;
      // forget what we assumed was saved so the next flush sends these rows again
      for (const j of jobs) {
        for (const row of j.upserts) synced[j.table].delete(row.id);
        for (const id of j.deletes) synced[j.table].set(id, j.before.get(id) || '');
      }
      failed = true;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => flush(useApp.getState().doc), RETRY_MS);
    })
    .finally(() => {
      pending--;
      setStatus();
    });
}

interface Row {
  workspace_id?: string;
  id?: string;
  data?: Record<string, unknown>;
  updated_by?: string;
}

interface ChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Row;
  old: Row;
}

/** Put one remote row into the document (null deletes it). `applyRemote` sanitises it afterwards. */
function setRow(doc: Doc, table: Table, id: string, row: object | null) {
  if (table === 'tasks') doc.tasks = applyRow(doc.tasks, id, row as Task | null);
  else doc.projects = applyRow(doc.projects, id, row as Project | null);
}

// remote events are applied strictly in arrival order, even when one waits for the member list
let inbox: Promise<void> = Promise.resolve();
const receive = (table: Table, payload: ChangePayload) => {
  inbox = inbox.then(() => onRemote(table, payload)).catch(() => {});
};

async function onRemote(table: Table, payload: ChangePayload) {
  if (payload.eventType === 'DELETE') {
    const old = payload.old || {};
    if (old.workspace_id !== workspaceId || !old.id) return;
    const id = old.id;
    synced[table].delete(id);
    applyRemote((doc) => setRow(doc, table, id, null));
    return;
  }
  const row = payload.new || {};
  if (row.workspace_id !== workspaceId || row.updated_by === TAB_ID || !row.id) return;
  const id = row.id;
  // assigned to someone who joined a moment ago: load them first, or sanitising drops the assignee
  const who = row.data && row.data.assignee;
  if (table === 'tasks' && who && !member(who)) await refreshMembers();
  if (row.workspace_id !== workspaceId) return;
  applyRemote((doc) => setRow(doc, table, id, { ...row.data, id }));
  // record what the store kept after sanitising, so the next local save does not resend it
  const kept = (useApp.getState().doc[table] as { id: string }[]).find((r) => r.id === id);
  if (kept) synced[table].set(id, JSON.stringify(kept));
}

/** Pull the whole workspace again, after a dropped connection may have missed events. */
async function catchUp() {
  const ws = workspaceId!;
  await queue;
  const doc = await loadDoc(ws);
  if (ws !== workspaceId) return;
  applyRemote((state) => {
    state.projects = doc.projects as unknown as Project[]; // applyRemote sanitises them
    state.tasks = doc.tasks as unknown as Task[];
  });
  synced = snapshotOf(useApp.getState().doc);
}

/**
 * Start syncing `id`, whose current document is already in the store. `onMembers` is called when
 * someone joins or leaves, so the caller can refresh the team.
 */
export async function startSync(id: string, onMembers: () => Promise<void>) {
  await stopSync();
  workspaceId = id;
  refreshMembers = onMembers;
  synced = snapshotOf(useApp.getState().doc);
  failed = false;
  wasSubscribed = false;
  setStatus();

  const client = await sb();
  const filter = `workspace_id=eq.${id}`;
  const ch = client.channel(`ws-${id}`);
  channel = ch;
  for (const table of TABLES) {
    for (const event of ['INSERT', 'UPDATE'] as const) {
      ch.on('postgres_changes', { event, schema: 'public', table, filter }, (p) =>
        receive(table, p as unknown as ChangePayload)
      );
    }
    // delete events cannot be filtered on the server; onRemote checks the workspace instead
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) =>
      receive(table, p as unknown as ChangePayload)
    );
  }
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, (p) => {
    const payload = p as unknown as ChangePayload;
    const r = payload.new && payload.new.workspace_id ? payload.new : payload.old || {};
    if (r.workspace_id === workspaceId) onMembers();
  });
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (wasSubscribed) catchUp().catch(() => {});
      wasSubscribed = true;
      failed = false;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      failed = true;
    }
    setStatus();
  });
}

export async function stopSync() {
  clearTimeout(retryTimer);
  await queue.catch(() => {});
  workspaceId = null;
  if (channel) {
    const client = await sb();
    await client.removeChannel(channel);
    channel = null;
  }
}

onSaved((doc) => flush(doc));
