# TaskFlow

A team task manager with accounts, shared workspaces and live sync, built with React, Vite and TypeScript. Supabase provides sign-in, the database and realtime updates.

**Live app:** https://adithyakammara.github.io/taskflow/

![Dashboard in light mode](docs/screenshots/dashboard-light.png)

| Board, dark mode                          | Task drawer                                 | Mobile                                 |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------- |
| ![Board](docs/screenshots/board-dark.png) | ![Drawer](docs/screenshots/task-drawer.png) | ![Mobile](docs/screenshots/mobile.png) |

## Try it

1. Open the live app and **create an account** (name, email, password), then confirm the email.
2. You land in your own workspace. Press **Add sample data** to see a full board, or add a task.
3. Open **Team → Create invite link** and send it to a teammate. When they join, edit a task in one browser and watch it change in the other.

## Features

**Team work**

- Email and password sign-up, sign-in, password reset and log out.
- Workspaces with a switcher in the sidebar; every new account gets one.
- Invite links valid for 7 days. Owners can remove members; members can leave.
- Live sync: a teammate's change shows up in about a second, with no refresh.
- Teammates are the assignees, so `@name`, the assignee filter and **My tasks** use real people.

**Planning**

- **Dashboard:** a "Start here" list of the three tasks to look at first, key numbers, a status donut, a 7/14/30-day completion chart, workload, project progress and upcoming work. All charts are hand-built SVG.
- **Views:** a sortable, filterable list, a drag-and-drop board and a month calendar.
- **Quick add:** type `Review PR tomorrow @priya #dev !high` and the date, assignee, tag and priority are filled in.
- **Task drawer:** status, priority, assignee, due date, tags, description, subtasks, comments and an activity log.

**Speed**

- Undo and redo (50 steps), bulk move, assign and delete, a command palette (`Ctrl K`), a "What next?" ranking and a focus timer.
- Keyboard shortcuts: `N` new task, `/` filter, `F` timer, `?` all shortcuts.

**Data and quality**

- JSON backup and restore, and CSV export guarded against spreadsheet formula injection.
- Keyboard accessible with visible focus, reduced-motion support, light and dark themes, a compact density option and layouts down to phone width. Every page and the main dialogs pass an automated WCAG 2.1 AA scan (axe) in both themes.
- Glass surfaces on the sidebar, top bar and dialogs, which turn solid when the browser cannot blur or the viewer asks for reduced transparency. Task rows, cards and forms stay solid for readability.

## How it works

| Layer     | What it does                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front end | React 19 and TypeScript (strict), built by Vite. One Zustand store holds the `{ projects, tasks }` document; views render from it. Tailwind CSS 4 maps the design tokens. |
| Sync      | After each save, only the rows that changed are written. Teammates' changes arrive over Supabase Realtime. Failed writes retry; reconnects catch up.                      |
| Database  | Supabase Postgres. Every table has Row Level Security, so people can only read and write workspaces they belong to.                                                       |
| Auth      | Supabase Auth with email and password. Joining a workspace is only possible through a valid invite (`accept_invite()`).                                                   |
| Hosting   | GitHub Pages at `/taskflow/`, deployed by GitHub Actions on every push to `main`. A Vercel project also builds every push (`vercel.json`), serving the app from `/`.      |

A few choices worth knowing:

- React renders all user text as text, and everything loaded from the database, storage or an imported file passes through `sanitize` first.
- Diffing, selectors, the quick-add parser, the undo history and the sync engine have unit tests; the main flows have end-to-end tests.
- When two people edit the same task at the same moment, the last save wins.
- The version 6 to 7 move from plain JavaScript to React is written up in [docs/MIGRATION-V7.md](docs/MIGRATION-V7.md).

## Run it locally

Needs Node 22.12 or newer.

```bash
npm install
```

```bash
npm run dev
```

That serves http://localhost:5173/taskflow/ with hot reload.

**Local mode or cloud mode.** `.env` holds the Supabase project URL and public key. With both values set, the app asks people to sign in and syncs through Supabase. Leave them empty and it runs in local mode: no accounts, a demo team, and tasks saved only in that browser. To work in local mode without editing `.env`, create a `.env.local` (git-ignored) with both values set to nothing.

**Use your own Supabase project.** Fork the repository, create a free Supabase project, run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor, set your site address under Authentication, and put your project's URL and publishable key in `.env`. [docs/SUPABASE.md](docs/SUPABASE.md) walks through each step.

## Project structure

```
index.html
src/
  main.tsx, App.tsx  entry point and routes
  app/               store (Zustand), actions, routes
  components/        app frame (sidebar, top bar, page header), shared pieces, toast
  features/          dashboard, tasks (list, drawer), board, calendar, palette and shortcuts,
                     settings dialogs, auth (sign-in, workspaces, team)
  lib/               logic with no React in it: config, types, model (sanitise, parser,
                     selectors, diff), store (history, storage), supabase (client, sync), utils
  styles/            design tokens, Tailwind setup, view styles, self-hosted fonts
supabase/            schema.sql: tables, Row Level Security, triggers, invite function
tests/               unit tests (Vitest)
e2e/                 end-to-end and accessibility tests (Playwright, axe)
```

## Scripts

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Serve the app locally with hot reload                        |
| `npm run build` / `preview`       | Production build into `dist/`, and serve that build          |
| `npm test`                        | Unit tests (Vitest)                                          |
| `npm run e2e`                     | End-to-end and accessibility tests (Playwright)              |
| `npm run typecheck`               | TypeScript, strict                                           |
| `npm run lint`                    | ESLint                                                       |
| `npm run format` / `format:check` | Prettier                                                     |
| `npm run check`                   | Lint, format check, typecheck, unit tests and build together |

GitHub Actions runs `check` and the end-to-end tests on every push and pull request (`.github/workflows/ci.yml`), and deploys the build to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`).

## Roadmap

- [x] Dashboard, list, board and calendar views with tests and CI
- [x] Accounts, workspaces, invite links and live team sync
- [x] React, Vite and TypeScript front end with a refreshed design (v7)
- [ ] Roles beyond owner and member (for example, view-only guests)
- [ ] Rename and delete workspaces
- [ ] Email notifications when a task is assigned to you
- [ ] Audit log and reports

## Credits

Built by [Adithya Kammara](https://github.com/AdithyaKammara) · [LinkedIn](https://linkedin.com/in/adithyakammara)

Fonts: [Figtree](https://github.com/erikdkennedy/figtree) and [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), under the SIL Open Font License (copies in `src/styles/fonts/`). Licensed under MIT.
