# TaskFlow v7.0.0: architecture assessment and migration plan

Phase 1 deliverable for the v7 frontend modernization PRD. It records how v6.0.0 works today, what must
not change, and the plan for moving to React, Vite and TypeScript.

Guiding rule (from the PRD and applied throughout): **port what works, add a dependency only when it
removes code or fixes a real gap.**

## 1. How v6.0.0 works

About 8,800 lines: 5,200 JS, 3,300 CSS, 395 HTML. There is no build step.

| Area | Files | How it works |
| --- | --- | --- |
| Entry | `main.js` | Calls about 14 `initX()` functions that bind DOM listeners, then `render()`. |
| Data | `store/store.js` | One mutable `store.state = { projects, tasks }` plus `store.ui` (view, filters, selection, drawer). Changes go through `commit()`, which saves, records history and emits `render`. |
| Events | `store/events.js` | A small pub/sub bus: `render`, `saved`, `sync`, `drawer:*`. |
| History | `store/history.js` | Undo/redo of **whole-document JSON snapshots**, up to 50. Remote changes call `history.sync()`, so they don't add an undo step. |
| Storage | `store/storage.js` | localStorage key `todo-app:v4`, with migration from v3, v2 and v1. In cloud mode it does nothing, and Supabase holds the data. |
| Model | `model/*` | Pure functions: `sanitize` (repairs and coerces untrusted data), `parser` (quick add), `selectors` (filtering, ranking, dashboard stats), `diff` (row diffing). All have tests. |
| Cloud | `backend/cloud.js` | Supabase client loaded from the jsDelivr CDN. Handles auth, workspaces, members, invites and `loadDoc`. |
| Sync | `backend/sync.js` | On `saved`, it diffs against the last confirmed snapshot and upserts or deletes the changed rows in an ordered queue. Failures are retried every 5 s. One Realtime channel per workspace. `updated_by = TAB_ID` suppresses the echo of the tab's own writes. After a reconnect it runs `catchUp()` to reload the whole workspace. |
| Account | `ui/account.js` (579 lines) | Auth screens, session handling, the `?invite=` capture, the workspace switcher and the team dialog. |
| Views | `views/*` | Rebuilt from scratch on every `render` with an `el()` DOM builder. Charts are hand-written SVG. |

**Database.** There are 6 tables. Projects and tasks are stored as **one JSON document per row**
(`data jsonb`), and RLS restricts every row to members of its workspace. Because the client already
treats this as a document store, the frontend migration needs **no schema change**.

## 2. Things that must survive the migration

1. **localStorage keys stay byte-identical** (`todo-app:v4`, `…:theme`, `…:density`, `…:view`, `…:workspace`, `…:invite`). Otherwise local-mode users lose their data on upgrade.
2. **Snapshot undo across the whole document.** Undo restores a full snapshot, and the diff sync then sends the difference. That means undoing after a teammate's edit can also revert their change. This is existing last-save-wins behaviour. It stays as is and is documented here.
3. **The hidden global `TEAM`.** `sanitizeTask()` drops an assignee unless `member(id)` finds them in the mutable `TEAM` array, which `setTeam()` changes. The TS port (phase 2) keeps this as a module-level registry with the same live binding, so behaviour and tests stay unchanged; the React store will call `setTeam()` and hold the member list itself so components re-render. The ordering rule stays: load members **before** the document, and refresh members when a task arrives with an unknown assignee.
4. **Echo suppression and ordering**: `TAB_ID`, the single write queue, and the inbox promise chain that applies remote events in order.
5. **Cross-tab sync in local mode**: the `storage` event triggers `reloadFromStorage()`.
6. **Auth redirects.** Confirmation and reset emails redirect to `appUrl()`, which is origin plus pathname. With client-side routes this has to be the **app base URL**, not the current route. Otherwise every route needs its own entry in Supabase's redirect allowlist.
7. **Supabase puts tokens in the URL hash** (`detectSessionInUrl`). That **rules out `HashRouter`**. Use `BrowserRouter` with the Vite `base` set to `/taskflow/`, plus a `404.html` copy of `index.html` for GitHub Pages deep links.

## 3. Proposed stack, checked against the PRD list

| PRD item | Decision | Why |
| --- | --- | --- |
| React 19, Vite, TypeScript (strict) | **Use** | These are the goal of the migration. |
| Tailwind CSS 4 | **Use** | The existing tokens become Tailwind `@theme` variables, so the palette carries over exactly. |
| shadcn/ui and Radix | **Use, one component at a time** | Add only what's needed: Dialog/Sheet (drawer), DropdownMenu, Popover, Tooltip. Not the whole catalogue. |
| Lucide React | **Use** | Replaces `icons.js`. |
| React Router | **Use** | `BrowserRouter`, with routes `/`, `/list`, `/board`, `/calendar`. This replaces the `todo-app:view` preference, which becomes the default redirect only. |
| Zustand | **Use** | Replaces `store.js` and `events.js` with one store. Its selectors keep re-renders narrow. |
| TanStack Query | **Skip** | Tasks and projects are a local document with snapshot undo, diff sync and realtime patches. A query cache would be a second source of truth for the same data, which the PRD forbids. Workspaces and members are about 4 calls, made at sign-in and on membership events. Add it only if we start paging server data. |
| Zod | **Skip** | `sanitize` already validates untrusted data, and it *repairs* rather than *rejects*. Swapping it would change behaviour on old backups. We keep it and add types. |
| React Hook Form | **Skip** | There are 4 short auth forms and the task drawer. The existing `validate()` plus controlled inputs covers them. |
| date-fns | **Skip** | `utils/dates.js` is 49 lines, has tests, and works on ISO date strings. |
| Supabase JS | **Use (npm)** | Moves from the CDN to an npm package with the same version, loaded lazily in cloud mode only. |
| Vitest | **Use** | The 8 `node:test` files port almost unchanged: `assert` becomes `expect`. |
| React Testing Library | **Use** | For the drawer, quick add and bulk actions. |
| Playwright | **Use (small)** | 3 flows: local-mode CRUD, the cloud sign-in smoke test, and the invite link. |
| ESLint and Prettier | **Keep** | Add the `typescript-eslint` and React Hooks plugins. |

That's 4 fewer runtime dependencies than the PRD lists. Any of them can still be added once a concrete
need shows up.

## 4. Design system

**Current identity (keep it).** The v6 "v7 flat" direction: cool slate neutrals, an **ink accent** (`#111827`
in light, `#f1f5f9` in dark), a **dark slate sidebar in both themes**, borders instead of shadows, and status
and priority colours as the only colours. The font is Figtree. `Bricolage-Grotesque` is in `css/fonts/` but
**is not loaded anywhere today**.

**Token layers** (following the design skill's approach):

1. **Primitive**: the exact hex values from `css/tokens.css`, unchanged.
2. **Semantic**: `--bg`, `--surface*`, `--text*`, `--border*`, `--accent*`, `--st-*`, `--p-*`. These keep their current names, so the port can be checked by comparing values.
3. **New glass tokens** (the only additions): `--glass-bg`, `--glass-border`, `--glass-blur`, each defined for light, dark and the sidebar.

**Where glass goes (and where it doesn't).** Glass only shows over a layered background. Today's
background is flat `#f6f7f9`, so v7 adds **one** very soft, palette-derived backdrop layer: two radial washes
in the existing "in progress" blue and "in review" fuchsia at 5–8 % opacity, so no new hues. Glass then
applies to:

- the sidebar (dark glass over the wash), the sticky top bar and toolbars,
- dialogs, the command palette, popovers, toasts and the bulk-action bar,
- the task drawer.

It stays **solid** on the list rows, board cards, calendar cells, forms and dashboard data panels, for
readability.

**Fallbacks.** Under `@supports not (backdrop-filter: blur(1px))` and `prefers-reduced-transparency: reduce`,
glass surfaces switch to the opaque `--surface` colour. Text on glass must keep 4.5:1 contrast, checked
in both themes.

**Type.** Figtree for the UI, and Bricolage Grotesque for page titles and dashboard numbers, as the PRD asks.
This is the only new visual element.

## 5. Target structure

The PRD's tree, trimmed to what exists. There are no `notifications/` or `comments/` modules, because
comments live inside the task drawer.

(Phases 2–5 only; phase 6 moved it to the root.) Until PR 6 the v7 app lives in `web/` (Vite root, `base: '/taskflow/'`), next to the v6 app at the
repository root. Run it with `npm run dev`; v6 still runs with `npm start`.

```
src/
  main.tsx  App.tsx
  app/        router.tsx, config.ts (mode detection: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
  components/ ui/ (shadcn), layout/ (Sidebar, TopBar, AppShell)
  features/
    auth/        AuthScreen, useSession
    workspaces/  WorkspaceSwitcher, TeamDialog
    dashboard/   Dashboard, charts/ (Donut, Trend)
    tasks/       List, QuickAdd, TaskDrawer, BulkBar
    board/  calendar/
    palette/     CommandPalette, shortcuts
    settings/    SettingsDialog, data (import/export), Pomodoro
  lib/
    model/       sanitize, parser, selectors, diff, meta   (ported 1:1 to .ts)
    store/       store.ts (Zustand), history.ts, storage.ts
    supabase/    client.ts, cloud.ts, sync.ts                (ported 1:1)
    utils/       dates, text, csv
  styles/     tokens.css (+ @theme), fonts
tests/        the existing 8 suites, plus component tests
e2e/          Playwright
```

`lib/` holds the logic, which has no React dependency. `features/` holds React components only.

## 6. Phases (each one its own PR)

| # | PR | Done when |
| --- | --- | --- |
| 1 | This document | Reviewed |
| 2 | **Vite, React and TS scaffold. `lib/` ported to TS, with all 8 suites passing in Vitest.** | `tsc --noEmit`, lint, tests and `vite build` pass in CI. The old app is still what gets deployed. |
| 3 | Tokens, Tailwind `@theme`, fonts, glass surfaces, AppShell (sidebar, top bar, theme, density) | Shell renders in both themes and at 375 px |
| 4 | Local mode: Dashboard, List, Board, Calendar, QuickAdd, Drawer, undo/redo, bulk actions, palette, shortcuts, focus timer, import/export | Every item in the PRD §8 checklist works in local mode |
| 5 | Cloud mode: auth screens, workspaces, team dialog, invites, sync wired to the Zustand store | Two browsers sync, invites work, retry and reconnect behave as before |
| 6 | Playwright, accessibility pass, Pages workflow switched to `vite build`, `404.html`, delete the old `css/` and `src/*.js` | Deployed to Pages and the README updated |

The live site keeps serving v6 until PR 6, so nothing users rely on breaks during the work.

**Phase 2 status (done).** `web/src/lib/` holds the TS ports of `config`, `types`, `model/*`
(sanitize, parser, selectors, diff, meta), `store/history`, `store/storage` and `utils/*`. All 8 suites
(61 tests) run in Vitest against them. `store.ts`, `sync.ts` and `cloud.ts` are ported in phases 4 and 5,
where they get wired to Zustand, because porting them now would mean writing glue that gets thrown away.
Notes:

- Node 22.12 or newer is now required (Vitest 5), so CI runs on Node 22 and 24.
- The test suites now cover the TS port, not the v6 `src/*.js`. The v6 code is frozen until it is deleted in PR 6.
- `npm audit` reports a moderate minimatch advisory, which comes through ESLint (dev-only). The only fix npm offers downgrades ESLint to v4, so it is left alone.

**Phase 3 status (done).**

- **Tokens.** `web/src/styles/tokens.css` keeps every v6 value and name. It adds `--font-display` (Bricolage Grotesque, now loaded), `--wash` and `--glass-*`.
- **Tailwind.** `index.css` maps the tokens to Tailwind 4 utilities (`bg-surface`, `text-muted`, `font-heading`, `shadow-float`, the `tablet:` breakpoint at 900 px) plus one `glass` utility. The v6 control classes (`btn`, `icon-btn`, `field`, `nav-item`) are carried over as component classes, so controls look the same.
- **Glass fallbacks.** Glass becomes solid when `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce` is set.
- **Shell.** `AppShell`, `Sidebar` and `TopBar` live in `components/layout/`. Routes are `/`, `/my-tasks`, `/tasks`, `/board` and `/calendar` under a `BrowserRouter`. The last view is restored on load, as in v6, except for invite or auth-redirect URLs.
- **Mobile drawer (below 900 px).** It moves focus in when it opens. Escape and the scrim close it, focus returns to the menu button, and the content is `inert` while it's open.
- **State.** `app/store.ts` (Zustand) holds the loaded document, theme and density. It follows the OS theme until the user picks one.
- **Not built yet.** The quick-add field is shown but disabled until phase 4. shadcn/ui isn't added yet: nothing in the shell needs it, and it comes in with the first dialog in phase 4.
- **Checked in the browser.** Light and dark themes, saving the theme choice, text contrast (muted text 6.45:1 and card text 10.48:1 in dark), 375 px with no sideways overflow, and drawer focus and inert handling.

**Phase 4 status (done): local mode at feature parity with v6.**

- **Store.** `app/store.ts` holds the document, the view settings (filters, selection, sort, calendar month, chart range, open drawer or dialog), the toast, the focus timer and the preferences. Changes go through `change()` / `commit()`, which copy the document, save it, record an undo step and publish it. Undo and redo restore whole-document snapshots, as in v6. Selection, the project filter and the open drawer are tidied when what they point at disappears.
- **Actions.** `app/actions.ts` ports `actions.js`, `seed.js` and `data.js`: add, edit, status, delete with toast undo, the bulk actions, projects, subtasks, comments, quick add, sample data, JSON and CSV export, and JSON import.
- **Views.** `features/` holds the dashboard (with hand-built SVG `charts.tsx`), the list (with bulk bar), the board (HTML drag-and-drop, background panning, a status dropdown on every card), the calendar, the task drawer, the dialogs (settings, help, "What next?", new project), the command palette and the keyboard shortcuts.
- **Styles.** `styles/views.css` carries over v6's component, view, dialog and dashboard CSS without changes, apart from removing the old shell rules, so every screen looks as before. Components use the same class names.
- **Dialogs use native `<dialog>`, not shadcn/Radix.** v6 already did, and the browser handles focus trapping, Escape and the top layer. The `Modal` wrapper makes the store the only owner of open/closed. Escape goes through the `cancel` event, and the field being edited is blurred before closing so its save still runs. Radix stays unadded until something needs it, such as a menu or popover.
- **Dialog glass.** Dialogs use `--glass-strong` (96 % light, 94 % dark). At 72 %, small labels over the dimmed backdrop measured 3.62:1, below the 4.5:1 minimum. They now measure 4.58:1 in light and 6.02:1 in dark.
- **Checked in the browser.**
  - Seeding and the dashboard numbers.
  - Quick-add parsing and errors.
  - List filters, pills and sorting.
  - Bulk move, assign and delete, with undo and redo.
  - Every drawer field, subtasks, comments and the activity log.
  - Board drag-and-drop and the status dropdown.
  - Calendar month navigation.
  - The My tasks filter.
  - The palette, with arrow keys.
  - The N, /, F, ? and Ctrl+K shortcuts, ignored while typing.
  - Timer start, pause and reset.
  - Density.
  - New project validation.
  - "What next?" opening the drawer.
  - JSON import (sanitised, undoable) and rejection of bad files.
  - The two-click reset.
  - Sync from another tab.
  - Reload persistence.
  - 375 px with no sideways overflow.
  - Both themes.
- **Not checked.**
  - Actually downloading the JSON and CSV exports. The CSV escaping is unit-tested.
  - Behaviour that needs a visible, focused window: real blur on Escape, and the close animations. The browser pane was hidden, so those were driven with dispatched events.
- **Still to do.** Component tests (React Testing Library) for the drawer, quick add and bulk bar come with the Playwright work in phase 6.

**Phase 5 status (code done; live testing still needed).**

- **Mode.** `lib/supabase/env.ts` is the only place that reads the environment (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from `web/.env`, the same public values as v6's `env.js`). `cloudEnabled()` decides the mode once. To develop in local mode, create a git-ignored `web/.env.local` with both values empty.
- **Client.** `@supabase/supabase-js` is pinned to 2.117.3, the CDN version v6 used. It is loaded on demand into its own chunk (55 KB gzipped), so local mode never downloads it. The build contains only the publishable key.
- **Ports.** `lib/supabase/cloud.ts` and `lib/supabase/sync.ts` are line-for-line ports. The only changes:
  - `appUrl()` is the app's base address (`…/taskflow/`) rather than the current route, so the redirect allow-list needs one entry.
  - Sync listens to the store's `onSaved()` instead of the event bus.
  - The sync status lives in the store.
- **Store.** New pieces:
  - `applyRemote()`: sanitised, no undo step, not echoed back.
  - `replaceAll()`: a fresh history after sign-in or a workspace switch.
  - `setMembers()`: updates the live `TEAM`/`ME` that sanitising and the selectors read, and the reactive `team`/`me` that components read.
  - `onSaved()`.
  - `storage.cloud` is set before the first load, so a signed-out visitor never sees this browser's local data.
- **Session and UI.** `features/auth/session.ts` ports `account.js`: auth events, password recovery, invite capture and acceptance, first-workspace creation, the remembered workspace, member refresh, removal and leaving. On top of it:
  - `AuthScreen` has the sign-in, sign-up, reset, "check your email" and new-password screens.
  - `Account` has the workspace switcher, the Team button and the account box with sync status.
  - `TeamDialog` has members, the owner's remove action, invite links with copy, a new workspace, and leave.
- **Tests.** `tests/sync.test.ts` (6 tests) runs the sync engine against a fake client and store. It covers:
  - writing only changed rows, and deletes;
  - going offline after a failed write, then resending after 5 s;
  - applying a teammate's change while ignoring our own echo and other workspaces;
  - remote deletes;
  - reloading everything after a reconnect.

  Deliberately breaking the echo filter or the retry makes the suite fail.
- **Checked in the browser.**
  - Cloud mode: the sign-in screen replaces the app, the invite token is captured from the URL and the note shows, client-side validation on all forms works, and the screens switch correctly.
  - Local mode: no sign-in, local data, and no Supabase download.
  - Contrast on the auth card is 4.67:1.
- **Not tested against the live Supabase project.**
  - Real sign-up and sign-in, the email links, accepting an invite, two browsers syncing, and reconnecting.
  - Creating accounts or signing in on the production project needs a person at the keyboard.
  - To test the email links from the dev server, add `http://localhost:5174/taskflow/` to Supabase's redirect URLs.
- **Small difference from v6.** If a teammate changes the title, tags or description of a task while you are typing in that same field, their value replaces your unsaved text. v6 kept the field being typed in. Other remote changes leave the field alone.

**Phase 6 status (done): v7 replaces v6.**

- **Layout.** The v6 app (`index.html`, `src/*.js`, `css/`, `scripts/serve.mjs`) is deleted; it stays in git history. The v7 app moved from `web/` to the repository root (`index.html`, `src/`, `.env`), so the `web/` paths in the phase notes above now start at the root. `npm start` is gone: use `npm run dev`. The version is 7.0.0.
- **Deploy.** `pages.yml` runs `npm ci`, then `npm run build` (a cloud-mode build from `.env`), and copies `dist/index.html` to `dist/404.html`, so GitHub Pages serves the app for deep links such as `/taskflow/board`. The production Supabase redirect URL is unchanged (`https://adithyakammara.github.io/taskflow/`). For local development the allow-list needs `http://localhost:5173/taskflow/`.
- **CI.** `ci.yml` keeps the lint, format, typecheck, unit-test and build job on Node 22 and 24. It adds an `e2e` job that installs Chromium, runs Playwright and uploads traces on failure.
- **End-to-end tests.** `e2e/` holds 23 tests against two production builds served by `vite preview`: a local-mode build, and a cloud-mode build that never signs in.
  - Local flows: sample data, quick add with reload persistence, drawer edits saved by Escape, bulk move with Ctrl+Z, board drag-and-drop, the palette, deep links, and the phone menu drawer with focus.
  - Cloud: the invite link, and form checks on the sign-in screens.
  - Accessibility: axe WCAG 2.1 A/AA scans of every page, the drawer and settings in both themes, and the sign-in screen.
- **Component tests.** None were added; React Testing Library was not installed. The e2e tests cover the drawer, quick add and bulk bar in a real browser, including the save-on-Escape that jsdom could not have shown.
- **Fixed because the new tests found it.**
  - Avatar initials failed contrast on four team colours. Avatars now use the member colour at 75 % brightness, at least 4.88:1.
  - The timer and Search buttons had accessible names that did not include their visible text (WCAG 2.5.3).
  - Ctrl+Z did nothing while a checkbox or dropdown had focus. Only text fields now keep their native undo.
  - The board read the dragged card from React state, which a fast drag could outrun. It now uses a ref.
- **Test infrastructure notes.** Local runs use the installed Chrome and 3 workers. More workers starved the preview servers on this machine, which made scans time out. axe scans get 90 s each.
- **Not done.**
  - The README screenshots still show v6.
  - Real sign-in, invite and two-browser sync testing against the live project (see Phase 5).

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Local users lose data | Same storage keys, and the existing `storage.test` runs against the TS port |
| Sync regressions | `sync.ts` is a line-for-line port. Only the `store` import changes, to Zustand `getState`/`setState`. |
| Glass hurts readability | Glass only on chrome and overlays, plus contrast checks and opaque fallbacks |
| Pages deep links 404 | `404.html` fallback and `base: '/taskflow/'` |
| Auth redirect mismatch | `appUrl()` returns `import.meta.env.BASE_URL` resolved against the origin |
