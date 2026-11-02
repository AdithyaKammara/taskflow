/**
 * A board card's face: chips, title, note, then due date, subtask progress and the assignee.
 * The priority chip, due date wording and progress ring are shared with the task list.
 */
import { CalendarDays, Flag } from 'lucide-react';
import { avatarBg } from '../../components/shared';
import { member } from '../../lib/model/meta';
import type { Priority, Project, Task } from '../../lib/types';
import { diffDays, fmtDate } from '../../lib/utils/dates';
import { initials } from '../../lib/utils/text';

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** The due date in words, and whether it needs attention: late (red) or soon (amber). */
export function dueInfo(t: Task) {
  if (!t.due) return null;
  const d = diffDays(t.due);
  if (t.status === 'done') return { label: fmtDate(t.due), tone: '' };
  if (d < 0) return { label: `${-d}d overdue`, tone: 'late' };
  if (d === 0) return { label: 'Today', tone: 'soon' };
  if (d === 1) return { label: 'Tomorrow', tone: 'soon' };
  return { label: fmtDate(t.due), tone: '' };
}

/** Priority as a flag chip, shared by the board and the task list. */
export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={`kb-chip prio-${priority}`}>
      <Flag aria-hidden="true" size={12} strokeWidth={2.25} />
      {PRIORITY_LABEL[priority]}
      <span className="sr-only"> priority</span>
    </span>
  );
}

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const pct = done / total;
  return (
    <span className="kb-ring" title={`${done} of ${total} subtasks done`}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r={r} className="track" />
        <circle
          cx="8"
          cy="8"
          r={r}
          className={done === total ? 'fill complete' : 'fill'}
          strokeDasharray={c}
          strokeDashoffset={c - c * pct}
        />
      </svg>
      <span className="sr-only">Subtasks</span>
      {`${done}/${total}`}
    </span>
  );
}

function Assignee({ id }: { id: string }) {
  const m = member(id);
  if (!m) {
    return (
      <span className="kb-avatar none" data-tip="Unassigned">
        <span className="sr-only">Unassigned</span>
      </span>
    );
  }
  return (
    <span className="kb-avatar" data-tip={m.name} style={{ background: avatarBg(m.color) }}>
      <span aria-hidden="true">{initials(m.name)}</span>
      <span className="sr-only">{`Assigned to ${m.name}`}</span>
    </span>
  );
}

export function CardFace({ t, project }: { t: Task; project: Project }) {
  const n = t.subtasks.length;
  const d = t.subtasks.filter((s) => s.done).length;
  const due = dueInfo(t);
  const note = t.description.split('\n')[0].trim();
  return (
    <>
      <div className="kb-chips">
        <PriorityChip priority={t.priority} />
        <span className="kb-chip">
          <i aria-hidden="true" className="kb-chip-dot" style={{ background: project.color }} />
          {project.name}
        </span>
      </div>

      <p className="kb-title">{t.title}</p>
      {(note || t.tags.length > 0) && (
        <p className="kb-note">
          {note}
          {note && t.tags.length > 0 && ' · '}
          {t.tags.map((g) => `#${g}`).join(' ')}
        </p>
      )}

      <div className="kb-foot">
        {due && (
          <span className={`kb-due ${due.tone}`}>
            <CalendarDays aria-hidden="true" size={12} strokeWidth={2.25} />
            <span className="sr-only">Due </span>
            {due.label}
          </span>
        )}
        {n > 0 && <ProgressRing done={d} total={n} />}
        <span className="kb-foot-end">
          <Assignee id={t.assignee} />
        </span>
      </div>
    </>
  );
}
