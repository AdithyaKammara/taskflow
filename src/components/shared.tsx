/** Small pieces used by several screens, ported from v6 (views/shared.js, utils/dom.js). */
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { seedData } from '../app/actions';
import { clearFilters } from '../app/store';
import { member } from '../lib/model/meta';
import type { Project, Task } from '../lib/types';
import { diffDays, fmtDate } from '../lib/utils/dates';
import { initials } from '../lib/utils/text';

/** An avatar's background: the member's colour at 75 % brightness, so white initials pass 4.5:1. */
export const avatarBg = (color: string) => `color-mix(in srgb, ${color} 75%, black)`;

/** A Lucide icon in v6's `.icon` wrapper, so the v6 styles still apply. */
export function Icon({ icon: I, size = 18 }: { icon: LucideIcon; size?: number }) {
  return (
    <span className="icon" aria-hidden="true">
      <I size={size} strokeWidth={1.8} />
    </span>
  );
}

export function Avatar({ id }: { id: string }) {
  const m = member(id);
  if (!m) {
    return (
      <span className="avatar none" title="Unassigned" aria-label="Unassigned">
        –
      </span>
    );
  }
  return (
    <span
      className="avatar"
      style={{ background: avatarBg(m.color) }}
      title={m.name}
      aria-label={m.name}
    >
      {initials(m.name)}
    </span>
  );
}

export function ProjectChip({ project }: { project: Project }) {
  return (
    <span className="proj">
      <i className="dot" style={{ background: project.color }} />
      {project.name}
    </span>
  );
}

export function DueBadge({ task: t }: { task: Task }) {
  if (!t.due) return null;
  const d = diffDays(t.due);
  let label = fmtDate(t.due);
  let cls = 'badge due';
  if (t.status !== 'done') {
    if (d < 0) {
      label = `Overdue · ${-d}d`;
      cls += ' overdue';
    } else if (d === 0) {
      label = 'Due today';
      cls += ' today';
    } else if (d === 1) label = 'Due tomorrow';
  }
  return <span className={cls}>{label}</span>;
}

export const PriorityBadge = ({ task }: { task: Task }) => (
  <span className={`badge p-${task.priority}`}>{task.priority}</span>
);

export function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="empty">
        <h2>No tasks match your filters</h2>
        <button className="btn" type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="empty">
      <h2>No tasks yet</h2>
      <p>
        Use the quick add bar above, press N, or start with sample data to explore the dashboard.
      </p>
      <div className="set-row">
        <button className="btn btn-primary" type="button" onClick={seedData}>
          Add sample data
        </button>
      </div>
    </div>
  );
}

/** Progress bar: `pct` from 0 to 100. */
export const Bar = ({ pct, color }: { pct: number; color?: string }) => (
  <div className="bar" aria-hidden="true">
    <i style={{ width: `${pct}%`, background: color }} />
  </div>
);

interface ModalProps {
  open: boolean;
  onClose: () => void;
  className: string;
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * A native modal <dialog>: the browser handles focus trapping, Escape and the top layer.
 * Clicking the backdrop closes it, as in v6. Children render only while it is open.
 * The store owns open/closed: Escape asks it to close (the `cancel` event fires at once), and the
 * later `close` event only catches a close the browser forced while the dialog stays shut.
 */
export function Modal({ open, onClose, className, children, ...aria }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  // blur the field being edited first, so its save-on-blur runs before the contents unmount
  const close = () => {
    const a = document.activeElement;
    if (a instanceof HTMLElement && ref.current?.contains(a)) a.blur();
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      {...aria}
    >
      {open && children}
    </dialog>
  );
}
