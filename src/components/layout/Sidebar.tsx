import {
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NavLink } from 'react-router';
import { PAGES } from '../../app/routes';
import { openDialog, setProject, toggleNavPinned, useApp } from '../../app/store';
import { AccountBox, LocalProfile, WorkspacePicker } from '../../features/auth/Account';
import { useSession } from '../../features/auth/session';
import { Icon } from '../shared';

interface Props {
  /** Drawer state below 900px; ignored on wider screens, where the sidebar is always shown. */
  open: boolean;
  onNavigate: () => void;
}

const wideQuery = window.matchMedia('(min-width: 900px)');
const useWide = () =>
  useSyncExternalStore(
    (cb) => {
      wideQuery.addEventListener('change', cb);
      return () => wideQuery.removeEventListener('change', cb);
    },
    () => wideQuery.matches
  );

/** Hover intent: a short wait before opening, so a pointer passing over the rail doesn't open it. */
const OPEN_DELAY = 120;
const CLOSE_DELAY = 220;

/**
 * Wide screens: an icon rail that opens over the page on hover or keyboard focus, or stays open
 * when pinned ([ or the pin button). Below 900px: the slide-in drawer the top bar's menu opens.
 */
export function Sidebar({ open, onNavigate }: Props) {
  const { projects, tasks } = useApp((s) => s.doc);
  const current = useApp((s) => s.project);
  const me = useApp((s) => s.me);
  const pinned = useApp((s) => s.navPinned);
  const cloud = useSession((s) => s.status === 'in');
  const wide = useWide();
  const [peek, setPeek] = useState(false);
  const timer = useRef<number>(0);
  const ref = useRef<HTMLElement>(null);

  const expanded = !wide || pinned || peek;
  const state = !wide ? 'drawer' : pinned ? 'pinned' : peek ? 'peek' : 'rail';

  const peekLater = (on: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPeek(on), on ? OPEN_DELAY : CLOSE_DELAY);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // move focus into the drawer when it opens
  useEffect(() => {
    const links = ref.current?.querySelectorAll<HTMLElement>('a');
    if (open && links) ([...links].find((a) => a.ariaCurrent === 'page') ?? links[0])?.focus();
  }, [open]);

  const openCount = (project?: string) =>
    tasks.filter((t) => t.status !== 'done' && (!project || t.project === project)).length;
  const mine = tasks.filter((t) => t.assignee === me && t.status !== 'done').length;

  return (
    <aside
      ref={ref}
      id="sidebar"
      aria-label="Primary"
      data-state={state}
      onMouseEnter={() => wide && !pinned && peekLater(true)}
      onMouseLeave={() => wide && !pinned && peekLater(false)}
      // keyboard users open the rail by tabbing into it; a mouse click focuses without opening it
      onFocus={(e) => {
        if (wide && !pinned && e.target.matches(':focus-visible')) {
          window.clearTimeout(timer.current);
          setPeek(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && !e.currentTarget.matches(':hover'))
          peekLater(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && state === 'peek') {
          setPeek(false);
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
      className={`sb z-40 flex h-dvh flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-r border-border bg-sidebar px-3 pt-5 pb-3 text-text tablet:sticky tablet:top-0 max-tablet:fixed max-tablet:inset-y-0 max-tablet:left-0 max-tablet:w-[min(var(--sidebar-w),85vw)] max-tablet:shadow-float max-tablet:duration-200 ${
        // visible at once when opening (so focus can move in), hidden only after the slide-out
        open
          ? 'max-tablet:transition-[translate]'
          : 'max-tablet:invisible max-tablet:-translate-x-full max-tablet:transition-[translate,visibility]'
      }`}
    >
      <div className="flex items-center gap-2.5 pb-3 pl-1">
        <span
          aria-hidden="true"
          className="grid size-8 flex-none place-items-center rounded-sm bg-accent text-[0.78rem] font-bold tracking-wide text-accent-contrast"
        >
          TF
        </span>
        <span className="sb-text flex-1 text-[1.1rem] font-semibold tracking-tight">TaskFlow</span>
        {wide && (
          <button
            type="button"
            className="sb-fade icon-btn sm"
            aria-label={pinned ? 'Fold sidebar to icons' : 'Keep sidebar open'}
            aria-pressed={pinned}
            title={pinned ? 'Fold sidebar to icons  [' : 'Keep sidebar open  ['}
            tabIndex={expanded ? 0 : -1}
            onClick={() => {
              toggleNavPinned();
              setPeek(false);
            }}
          >
            <Icon icon={pinned ? PanelLeftClose : PanelLeftOpen} size={16} />
          </button>
        )}
      </div>

      {cloud && (
        <div className="sb-fade">
          <WorkspacePicker />
        </div>
      )}

      <p className="nav-label-group">
        <span className="sb-text">Main menu</span>
      </p>
      <nav aria-label="Views" className="flex flex-col gap-0.5">
        {PAGES.map(({ path, label, icon: PageIcon }) => (
          <NavLink key={path} to={path} end className="nav-item" onClick={onNavigate}>
            <span className="relative flex">
              <PageIcon size={18} aria-hidden="true" />
              {path === '/my-tasks' && mine > 0 && <i aria-hidden="true" className="sb-dot" />}
            </span>
            <span className="sb-text flex-1 truncate">{label}</span>
            {path === '/my-tasks' && mine > 0 && (
              <span className="sb-fade rounded-full bg-surface-3 px-1.5 text-xs font-semibold text-text-2">
                {mine}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center justify-between pr-1">
        <h2 id="projectsHead" className="nav-label-group">
          <span className="sb-text">Projects</span>
        </h2>
        <button
          type="button"
          className="sb-fade icon-btn sm"
          aria-label="New project"
          tabIndex={expanded ? 0 : -1}
          onClick={() => openDialog('project')}
        >
          <Icon icon={Plus} size={16} />
        </button>
      </div>
      <nav aria-labelledby="projectsHead" className="flex flex-col gap-0.5">
        {[{ id: '', name: 'All projects', color: 'var(--muted)' }, ...projects].map((p) => (
          <button
            key={p.id}
            type="button"
            className="nav-item"
            aria-current={current === p.id ? 'page' : undefined}
            onClick={() => setProject(p.id)}
          >
            <i
              aria-hidden="true"
              className="mx-[5px] size-2 flex-none rounded-full"
              style={{ background: p.color }}
            />
            <span className="sb-text flex-1 truncate">{p.name}</span>
            <span className="sb-fade text-xs font-medium text-muted">{openCount(p.id)}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 pt-4">
        <button type="button" className="nav-item" onClick={() => openDialog('next')}>
          <Sparkles size={18} aria-hidden="true" />
          <span className="sb-text">What next?</span>
        </button>
        <button type="button" className="nav-item" onClick={() => openDialog('help')}>
          <CircleHelp size={18} aria-hidden="true" />
          <span className="sb-text">Keyboard shortcuts</span>
        </button>
        <button type="button" className="nav-item" onClick={() => openDialog('settings')}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span className="sb-text">Settings</span>
        </button>
        {cloud ? <AccountBox /> : <LocalProfile />}
      </div>
    </aside>
  );
}
