import { CircleHelp, Menu, Moon, Redo2, Search, Sparkles, Sun, Undo2 } from 'lucide-react';
import type { Ref } from 'react';
import { quickAdd } from '../../app/actions';
import {
  openDialog,
  redo,
  resetPomo,
  toggleTheme,
  togglePomo,
  undo,
  useApp,
} from '../../app/store';
import { parseQuickAdd } from '../../lib/model/parser';
import { pad } from '../../lib/utils/dates';
import { Icon } from '../shared';

interface Props {
  navOpen: boolean;
  onMenu: () => void;
  menuRef: Ref<HTMLButtonElement>;
  quick: string;
  setQuick: (text: string) => void;
  setQuickError: (msg: string) => void;
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

export function TopBar({ navOpen, onMenu, menuRef, quick, setQuick, setQuickError }: Props) {
  const theme = useApp((s) => s.theme);
  const canUndo = useApp((s) => s.canUndo);
  const canRedo = useApp((s) => s.canRedo);

  return (
    <header className="topbar glass sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 tablet:flex-nowrap tablet:px-7">
      <button
        ref={menuRef}
        type="button"
        className="icon-btn mr-auto tablet:hidden"
        aria-label="Open menu"
        aria-controls="sidebar"
        aria-expanded={navOpen}
        onClick={onMenu}
      >
        <Icon icon={Menu} size={20} />
      </button>

      <form
        className="order-last flex min-w-0 flex-[1_0_100%] gap-2 tablet:order-none tablet:flex-1"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const error = quickAdd(parseQuickAdd(quick));
          setQuickError(error);
          if (!error) setQuick('');
        }}
      >
        <label className="sr-only" htmlFor="quickInput">
          Quick add task
        </label>
        <input
          id="quickInput"
          className="field min-w-0 flex-1"
          type="text"
          autoComplete="off"
          maxLength={200}
          placeholder="Add a task… e.g. Review PR tomorrow @priya #dev !high"
          aria-describedby="quickHint quickError"
          value={quick}
          onChange={(e) => {
            setQuick(e.target.value);
            setQuickError('');
          }}
        />
        <button className="btn btn-primary" type="submit">
          Add
        </button>
      </form>

      <PomoButton />
      <button
        type="button"
        className="btn ghost palette-btn"
        title="Open command palette"
        onClick={() => openDialog('palette')}
      >
        <Icon icon={Search} size={16} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button type="button" className="btn ghost next-btn" onClick={() => openDialog('next')}>
        <Icon icon={Sparkles} size={16} />
        <span>What next?</span>
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        <Icon icon={Undo2} size={20} />
      </button>
      <button
        type="button"
        className="icon-btn redo-btn"
        aria-label="Redo (Ctrl+Shift+Z)"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
      >
        <Icon icon={Redo2} size={20} />
      </button>
      <button
        type="button"
        className="icon-btn help-btn"
        aria-label="Keyboard shortcuts (?)"
        title="Keyboard shortcuts (?)"
        onClick={() => openDialog('help')}
      >
        <Icon icon={CircleHelp} size={20} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggleTheme}
      >
        <Icon icon={theme === 'dark' ? Sun : Moon} size={20} />
      </button>
    </header>
  );
}
