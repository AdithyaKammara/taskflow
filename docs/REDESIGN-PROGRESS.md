# Dashboard redesign: progress notes (paused 2026-11-01)

Goal: restyle the whole app shell and the dashboard after the reference the user shared (white
sidebar with "Main menu" groups and a profile card, header with the page title and a search pill,
toolbar with quick add / Add project / project filter, dashboard with 4 stat cards, an area
"completed" trend chart with hover tooltip, a "Task calendar" week strip with task cards on the
right, and a task overview table). Decisions: **whole app shell**, **blue accent** (`#1570ef`),
Figtree only (Bricolage dropped), flat surfaces (glass only on dialogs).

Work happens in the git worktree `.claude/worktrees/dashboard-redesign` on branch
`dashboard-redesign` (from `main` at 077d0ac). `node_modules` there is a junction to the main
folder's. A git-ignored `.env.local` puts the dev server in local mode. Preview: `dashboard-redesign`
entry in the main folder's `.claude/launch.json` (port 5190). Screenshot helper used:
`scratchpad/shot.mjs` (Playwright with installed Chrome; saves light/dark full-page PNGs).

## Done (WIP commit, does not build yet)

- `src/styles/tokens.css`: new palette (light + dark), blue accent with `--accent-text`, light
  sidebar, card shadow, **restored the `.st-todo/.st-doing/.st-review/.st-done` classes** (lost in
  the v7 port: status donut, status dots and status dropdown colours are broken on the live site;
  ship this fix even if the redesign waits).
- `src/styles/index.css`: Tailwind theme (+ `accent-text`, `shadow-card`), new `.nav-item` and
  `.nav-label-group`, no glass utility, plain background, imports a new `dashboard.css`
  (**not written yet**).
- `src/styles/views.css`: old dashboard CSS and its breakpoints removed (kept `.link`, `.btn.sm`,
  `.field.sm`); account card and workspace picker restyled.
- `src/components/layout/Sidebar.tsx`: rewritten to the reference layout.
- `src/features/auth/Account.tsx`: new `LocalProfile` card.

## Next steps

1. `src/components/layout/TopBar.tsx`: `<h1>` page title from `PAGES` (set `document.title`),
   search pill (opens palette, shows Ctrl K), timer, What next?, undo/redo, theme; no glass.
2. Replace `PageHead` with a `Toolbar` rendered by `AppShell` under the header: quick add (move the
   form out of TopBar; keep `#quickInput`, `QuickHint`), "Add project", project select, calendar
   month controls on `/calendar`. Pages keep `Filters` only; remove `PageHead` imports from
   ListView, BoardView, CalendarView, Dashboard.
3. Write `src/styles/dashboard.css` and rewrite `src/features/dashboard/Dashboard.tsx`:
   stat cards (open, overdue, due in 7 days, completed this week with real % vs last week only),
   area trend chart with dots, grid and hover tooltip (`charts.tsx`), Task calendar panel (week
   strip, cards with due flag, assignee avatars, subtask and comment counts), "Start here" as the
   overview table (rank, task, assignee, due date, status pill), then status donut, workload and
   project progress cards in the same style. Keep every v6 dashboard feature (PRD).
4. Remove the Bricolage font files and update the README fonts line.
5. Screenshot light/dark/375px, fix, then `npm run check` and `npm run e2e` (update e2e if headings
   move; axe must stay clean), then ask the user about committing / PR.

## Other session

"Finish invite-link confirmation" (branch `invite-confirm`, main folder) finished a turn and is
waiting for the user's go-ahead to commit and open its PR.
