/**
 * The task list: a numbered table of the filtered tasks (title with project, tags and subtask
 * progress; assignee; priority; status; due date), with row selection for bulk actions.
 * Rows rise in, staggered, when they first appear. Below 760px each row becomes a small card.
 */
import { CalendarDays } from 'lucide-react';
import type { CSSProperties } from 'react';
import { bulkAssign, bulkDelete, bulkStatus } from '../../app/actions';
import { openDrawer, toggleSelected, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { Filters } from '../../components/layout/Toolbar';
import { Avatar, EmptyState } from '../../components/shared';
import { STATUSES } from '../../lib/config';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { Doc, StatusId, Task } from '../../lib/types';
import { PriorityChip, ProgressRing, dueInfo } from '../board/BoardCard';
import { StatusSelect } from './StatusSelect';

/** Rows after this many appear together, so a long list never waits on its own animation. */
const STAGGER_ROWS = 14;

function TaskRow({ t, n, doc, selected }: { t: Task; n: number; doc: Doc; selected: boolean }) {
  const subs = t.subtasks.length;
  const subsDone = t.subtasks.filter((s) => s.done).length;
  const project = projectOf(doc, t);
  const due = dueInfo(t);
  return (
    <tr
      className={`tl-row${t.status === 'done' ? ' is-done' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--i': Math.min(n - 1, STAGGER_ROWS) } as CSSProperties}
    >
      <td className="tl-sel">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select "${t.title}"`}
          onChange={(e) => toggleSelected(t.id, e.target.checked)}
        />
      </td>
      <td className="tl-num">{n}</td>
      <td className="tl-task">
        <button type="button" className="tl-title" onClick={() => openDrawer(t.id)}>
          {t.title}
        </button>
        <div className="tl-meta">
          <span className="tl-project">
            <i aria-hidden="true" style={{ background: project.color }} />
            {project.name}
          </span>
          {subs > 0 && <ProgressRing done={subsDone} total={subs} />}
          {t.tags.length > 0 && (
            <span className="tl-tags">{t.tags.map((g) => `#${g}`).join(' ')}</span>
          )}
        </div>
      </td>
      <td className="tl-who">
        <Avatar id={t.assignee} />
      </td>
      <td className="tl-prio">
        <PriorityChip priority={t.priority} />
      </td>
      <td className="tl-status">
        <StatusSelect task={t} label={`Status of "${t.title}"`} />
      </td>
      <td className={`tl-due ${due?.tone ?? ''}`}>
        {due ? (
          <span className="tl-due-in">
            <CalendarDays aria-hidden="true" size={13} className="tl-due-icon" />
            {due.label}
          </span>
        ) : (
          <span className="tl-none">No date</span>
        )}
      </td>
    </tr>
  );
}

/** The "N selected" bar: move, assign, delete. */
function BulkBar() {
  const count = useApp((s) => s.selected.size);
  const team = useApp((s) => s.team);
  if (!count) return null;
  return (
    <div className="bulk">
      <strong>{`${count} selected`}</strong>
      <label className="sr-only" htmlFor="bulkStatus">
        Move selected to
      </label>
      <select
        id="bulkStatus"
        className="field"
        value=""
        onChange={(e) => bulkStatus(e.target.value as StatusId)}
      >
        <option value="">Move to…</option>
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="bulkAssign">
        Assign selected to
      </label>
      <select
        id="bulkAssign"
        className="field"
        value=""
        onChange={(e) =>
          e.target.value && bulkAssign(e.target.value === '_none' ? '' : e.target.value)
        }
      >
        <option value="">Assign to…</option>
        <option value="_none">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button className="btn danger" type="button" onClick={bulkDelete}>
        Delete
      </button>
      <button
        className="btn"
        type="button"
        onClick={() => useApp.setState({ selected: new Set() })}
      >
        Clear selection
      </button>
    </div>
  );
}

export function ListView() {
  const view = useView();
  const sort = useApp((s) => s.sort);
  const selected = useApp((s) => s.selected);
  const { doc } = view;
  const tasks = filteredTasks(doc, view).sort(SORTS[sort] || SORTS.due);
  const allSel = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const someSel = !allSel && tasks.some((t) => selected.has(t.id));
  const done = tasks.filter((t) => t.status === 'done').length;

  const selectAll = (on: boolean) => {
    const next = new Set(selected);
    tasks.forEach((t) => (on ? next.add(t.id) : next.delete(t.id)));
    useApp.setState({ selected: next });
  };

  return (
    <>
      <Filters sort />
      <BulkBar />
      {!tasks.length ? (
        <EmptyState filtered={doc.tasks.length > 0} />
      ) : (
        <section className="tl-card" aria-labelledby="tlTitle">
          <header className="tl-head">
            <h2 id="tlTitle">
              Task list <span className="tl-count">{tasks.length}</span>
            </h2>
            <div className="tl-progress" title={`${done} of ${tasks.length} done`}>
              <span>{`${done} of ${tasks.length} done`}</span>
              <span className="tl-bar" aria-hidden="true">
                <span style={{ width: `${(done / tasks.length) * 100}%` }} />
              </span>
            </div>
          </header>
          <div className="tl-scroll">
            <table className="tl-table">
              <thead>
                <tr>
                  <th scope="col" className="tl-sel">
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={(el) => {
                        if (el) el.indeterminate = someSel;
                      }}
                      aria-label="Select all visible tasks"
                      onChange={(e) => selectAll(e.target.checked)}
                    />
                  </th>
                  <th scope="col" className="tl-num">
                    No
                  </th>
                  <th scope="col">Task</th>
                  <th scope="col" className="tl-who">
                    Who
                  </th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="tl-due">
                    Due date
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <TaskRow key={t.id} t={t} n={i + 1} doc={doc} selected={selected.has(t.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
