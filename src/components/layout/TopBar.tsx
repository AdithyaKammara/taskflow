import { Menu, Moon, Redo2, Search, Sun, Undo2 } from 'lucide-react';
import { useEffect, type Ref } from 'react';
import { useLocation } from 'react-router';
import { PAGES } from '../../app/routes';
import {
  openDialog,
  redo,
  resetPomo,
  toggleTheme,
  togglePomo,
  undo,
  useApp,
} from '../../app/store';
import { pad } from '../../lib/utils/dates';
import { Icon } from '../shared';

interface Props {
  navOpen: boolean;
  onMenu: () => void;
  menuRef: Ref<HTMLButtonElement>;
}

function PomoButton() {
  const { seconds, running } = useApp((s) => s.pomo);
  const time = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  return (
    <button
      type="button"
      className={`btn ghost pomo-btn${running ? ' running' : ''}`}
      // the name starts with the visible time, so speech users can say what they see
      aria-label={`${time} focus timer, ${running ? 'running' : 'paused'}`}
      title="Click: Start/Pause · Right-click: Reset"
      onClick={togglePomo}
      onContextMenu={(e) => {
        e.preventDefault();
        resetPomo();
      }}
    >
      <span className="pomo-dot" />
      <span>{time}</span>
    </button>
  );
}

/** The header: menu (phones), page title, search, focus timer, undo/redo and theme. */
export function TopBar({ navOpen, onMenu, menuRef }: Props) {
  const theme = useApp((s) => s.theme);
  const canUndo = useApp((s) => s.canUndo);
  const canRedo = useApp((s) => s.canRedo);
  const project = useApp((s) => s.doc.projects.find((p) => p.id === s.project));
  const { pathname } = useLocation();
  const title = (PAGES.find((p) => p.path === pathname) ?? PAGES[0]).label;

  useEffect(() => {
    document.title = `${title} · TaskFlow`;
  }, [title]);

  return (
    <header className="topbar sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-border bg-surface px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 tablet:px-7">
      <button
        ref={menuRef}
        type="button"
        className="icon-btn tablet:hidden"
        aria-label="Open menu"
        aria-controls="sidebar"
        aria-expanded={navOpen}
        onClick={onMenu}
      >
        <Icon icon={Menu} size={20} />
      </button>

      <div className="mr-auto flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-[1.35rem] leading-tight font-semibold">{title}</h1>
        {project && (
          <span className="hidden truncate text-sm text-muted sm:inline">· {project.name}</span>
        )}
      </div>

      <button
        type="button"
        className="search-pill"
        title="Open command palette"
        onClick={() => openDialog('palette')}
      >
        <Icon icon={Search} size={16} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <PomoButton />
      <button
        type="button"
        className="icon-btn"
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        <Icon icon={Undo2} size={19} />
      </button>
      <button
        type="button"
        className="icon-btn redo-btn"
        aria-label="Redo (Ctrl+Shift+Z)"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
      >
        <Icon icon={Redo2} size={19} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggleTheme}
      >
        <Icon icon={theme === 'dark' ? Sun : Moon} size={19} />
      </button>
    </header>
  );
}
