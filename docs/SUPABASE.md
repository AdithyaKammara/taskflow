# Accounts and team sync with Supabase

TaskFlow runs in two modes:

- **Local mode**: no accounts, data stays in the browser. This is what you get while the two
  values in `.env` are empty (or overridden as empty in a git-ignored `.env.local`).
- **Cloud mode**: email + password accounts, workspaces you invite teammates into, and live sync —
  when someone edits a task, everyone in the workspace sees it within a second.

The app stays a static site (GitHub Pages works); Supabase provides the database, auth and realtime.

## Set it up (about 10 minutes)

1. **Create a project** at [supabase.com](https://supabase.com) (the free plan is enough). Pick a
   region near your team and save the database password somewhere safe.
2. **Create the tables.** In the dashboard open **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](../supabase/schema.sql) and press **Run**. It is safe to run again later.
3. **Allow your site's address.** Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://adithyakammara.github.io/taskflow/`
   - **Redirect URLs**: add the same address, plus `http://localhost:5173/taskflow/` for local
     development.

   Confirmation, password-reset and invite links always point at the app's base address (never a
   page inside it), so these two entries are all it needs.
4. **Connect the app.** In **Project Settings → API** copy the **Project URL** and the
   **publishable** (anon) key into `.env`:

   ```bash
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

   The anon key is designed to be public; Row Level Security in `schema.sql` decides what each signed-in
   person can read and write. **Never** use the `service_role` key in the app.

5. Commit and push. The Pages workflow redeploys, and the live site now asks people to sign in.

## How it works

| Piece                                              | Where                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Tables, security, invite function                  | `supabase/schema.sql`                                                          |
| Which mode the app runs in                         | `src/lib/supabase/env.ts`                                                      |
| Client, accounts, workspaces, invites              | `src/lib/supabase/cloud.ts`                                                    |
| Live sync (send changes, apply teammates' changes) | `src/lib/supabase/sync.ts`, tested in `tests/sync.test.ts`                     |
| Session, sign-in screens, workspace switcher, Team | `src/features/auth/`                                                           |
| Row diffing (unit tested)                          | `src/lib/model/diff.ts`, `tests/diff.test.ts`                                  |

- **Workspaces.** Every new account gets its own workspace. Use the switcher at the top of the sidebar
  to move between workspaces or create another one.
- **Invites.** Open **Team** in the sidebar, press **Create invite link** and send the link. It works
  for 7 days; whoever opens it signs in (or signs up) and joins. Owners can remove members; members
  can leave.
- **Assignees** are the workspace's members, so `@name` in quick add, the assignee filter and "My
  tasks" all use real people.
- **Sync.** After each change the app sends only the projects and tasks that changed. Teammates'
  changes arrive over a realtime channel. If two people edit the same task at the same moment, the
  last save wins. While offline the sidebar shows "Offline, retrying" and changes are re-sent
  automatically. Undo and redo still work and sync like any other change.

## Notes and limits

- Email confirmation is on by default in Supabase: new accounts must click the link in their email
  before they can sign in. You can turn it off under **Authentication → Providers → Email**.
- Supabase's built-in email sender is rate-limited and meant for testing. For a real team, add your
  own SMTP server under **Authentication → Emails → SMTP Settings**.
- Deleting a task sends its id to every connected client (Supabase cannot filter delete events by
  workspace); clients ignore ids that are not theirs, and no task content is included.
- Data in local mode is not moved automatically. To bring it across, use **Settings → Export JSON
  backup** in local mode, then **Import JSON** after signing in.
