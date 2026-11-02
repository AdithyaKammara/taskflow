import { CircleHelp, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { PAGES } from '../../app/routes';
import { openDialog, setProject, useApp } from '../../app/store';
import { AccountBox, LocalProfile, WorkspacePicker } from '../../features/auth/Account';
import { useSession } from '../../features/auth/session';
import { Icon } from '../shared';

interface Props {
  /** Drawer state below 900px; ignored on wider screens, where the sidebar is always shown. */
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: Props) {
  const { projects, tasks } = useApp((s) => s.doc);
  const current = useApp((s) => s.project);
  const me = useApp((s) => s.me);
  const cloud = useSession((s) => s.status === 'in');
  const ref = useRef<HTMLElement>(null);

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
      className={`z-40 flex h-dvh flex-col overflow-y-auto overscroll-contain border-r border-border bg-sidebar px-3 pt-5 pb-3 text-text tablet:sticky tablet:top-0 max-tablet:fixed max-tablet:inset-y-0 max-tablet:left-0 max-tablet:w-[min(var(--sidebar-w),85vw)] max-tablet:shadow-float max-tablet:duration-200 ${
        // visible at once when opening (so focus can move in), hidden only after the slide-out
        open
          ? 'max-tablet:transition-[translate]'
          : 'max-tablet:invisible max-tablet:-translate-x-full max-tablet:transition-[translate,visibility]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-2 pb-3">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-sm bg-accent text-[0.78rem] font-bold tracking-wide text-accent-contrast"
        >
          TF
        </span>
        <span className="text-[1.1rem] font-semibold tracking-tight">TaskFlow</span>
      </div>

      {cloud && <WorkspacePicker />}

      <p className="nav-label-group">Main menu</p>
      <nav aria-label="Views" className="flex flex-col gap-0.5">
        {PAGES.map(({ path, label, icon: PageIcon }) => (
          <NavLink key={path} to={path} end className="nav-item" onClick={onNavigate}>
            <PageIcon size={18} aria-hidden="true" />
            <span className="flex-1 truncate">{label}</span>
            {path === '/my-tasks' && mine > 0 && (
              <span className="rounded-full bg-surface-3 px-1.5 text-xs font-semibold text-text-2">
                {mine}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center justify-between pr-1">
        <h2 id="projectsHead" className="nav-label-group">
          Projects
        </h2>
        <button
          type="button"
          className="icon-btn sm"
          aria-label="New project"
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
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-xs font-medium text-muted">{openCount(p.id)}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 pt-4">
        <button type="button" className="nav-item" onClick={() => openDialog('next')}>
          <Sparkles size={18} aria-hidden="true" />
          What next?
        </button>
        <button type="button" className="nav-item" onClick={() => openDialog('help')}>
          <CircleHelp size={18} aria-hidden="true" />
          Keyboard shortcuts
        </button>
        <button type="button" className="nav-item" onClick={() => openDialog('settings')}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          Settings
        </button>
        {cloud ? <AccountBox /> : <LocalProfile />}
      </div>
    </aside>
  );
}
