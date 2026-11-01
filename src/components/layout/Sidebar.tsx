import { HardDrive, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { PAGES } from '../../app/routes';
import { openDialog, setProject, useApp } from '../../app/store';
import { AccountBox, WorkspacePicker } from '../../features/auth/Account';
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
      className={`sidebar glass z-40 flex h-dvh flex-col gap-1 overflow-y-auto overscroll-contain border-r px-2.5 py-3.5 text-text tablet:sticky tablet:top-0 max-tablet:fixed max-tablet:inset-y-0 max-tablet:left-0 max-tablet:w-[min(var(--sidebar-w),85vw)] max-tablet:shadow-float max-tablet:duration-200 ${
        // visible at once when opening (so focus can move in), hidden only after the slide-out
        open
          ? 'max-tablet:transition-[translate]'
          : 'max-tablet:invisible max-tablet:-translate-x-full max-tablet:transition-[translate,visibility]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-2 pt-1 pb-3.5">
        <span
          aria-hidden="true"
          className="grid size-[30px] place-items-center rounded-sm bg-white font-heading text-[0.78rem] font-extrabold tracking-wide text-[#111827]"
        >
          TF
        </span>
        <span className="font-heading text-[1.15rem] font-bold tracking-tight">TaskFlow</span>
      </div>

      {cloud && <WorkspacePicker />}

      <nav aria-label="Views" className="flex flex-col gap-px">
        {PAGES.map(({ path, label, icon: PageIcon }) => (
          <NavLink key={path} to={path} end className="nav-item" onClick={onNavigate}>
            <PageIcon size={18} aria-hidden="true" />
            <span className="nav-label">{label}</span>
            {path === '/my-tasks' && mine > 0 && <span className="nav-badge">{mine}</span>}
          </NavLink>
        ))}
        <button type="button" className="nav-item" onClick={() => openDialog('next')}>
          <Sparkles size={18} aria-hidden="true" />
          <span className="nav-label">What next?</span>
        </button>
      </nav>

      <section aria-labelledby="projectsHead" className="mt-3.5">
        <div className="flex items-center justify-between pr-1 pb-1 pl-2.5">
          <h2 id="projectsHead" className="font-sans text-[0.82rem] font-semibold text-muted">
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
        <nav aria-label="Projects" className="flex flex-col gap-px">
          {[{ id: '', name: 'All projects', color: 'var(--muted)' }, ...projects].map((p) => (
            <button
              key={p.id}
              type="button"
              className="nav-item"
              aria-current={current === p.id ? 'page' : undefined}
              onClick={() => setProject(p.id)}
            >
              <i className="dot" style={{ background: p.color }} />
              <span className="nav-label">{p.name}</span>
              <span className="nav-badge">{openCount(p.id)}</span>
            </button>
          ))}
        </nav>
      </section>

      <div className="mt-auto flex flex-col gap-px pt-3">
        <button type="button" className="nav-item" onClick={() => openDialog('settings')}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span className="nav-label">Settings</span>
        </button>
        {cloud ? (
          <AccountBox />
        ) : (
          <p className="flex items-center gap-2 px-2.5 pt-2 text-xs text-muted">
            <HardDrive size={14} aria-hidden="true" />
            Local mode: saved in this browser
          </p>
        )}
      </div>
    </aside>
  );
}
