/** The task list: sortable, filterable rows with selection for bulk actions. */
import { bulkAssign, bulkDelete, bulkStatus } from '../../app/actions';
import { openDrawer, toggleSelected, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { STATUSES } from '../../lib/config';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { Doc, StatusId, Task } from '../../lib/types';
import { Filters, PageHead } from '../../components/layout/PageHead';
import { Avatar, DueBadge, EmptyState, PriorityBadge, ProjectChip } from '../../components/shared';
import { StatusSelect } from './StatusSelect';

function TaskRow({ t, doc, selected }: { t: Task; doc: Doc; selected: boolean }) {
  const nSub = t.subtasks.length;
  const dSub = t.subtasks.filter((s) => s.done).length;
  return (
    <li className={`row status-${t.status}${selected ? ' selected' : ''}`}>
      <label className="sel">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select "${t.title}"`}
          onChange={(e) => toggleSelected(t.id, e.target.checked)}
        />
      </label>
      <div>
        <button type="button" className="title-btn" onClick={() => openDrawer(t.id)}>
          {t.title}
        </button>
        <div className="meta">
          <ProjectChip project={projectOf(doc, t)} />
          {nSub > 0 && <span className="sub-prog">{`${dSub}/${nSub} subtasks`}</span>}
          {t.tags.map((g) => (
            <span key={g} className="tag">{`#${g}`}</span>
          ))}
        </div>
      </div>
      <div className="row-side">
        <Avatar id={t.assignee} />
        <PriorityBadge task={t} />
        {t.due ? <DueBadge task={t} /> : <span className="muted">No date</span>}
        <StatusSelect task={t} label={`Status of "${t.title}"`} />
      </div>
    </li>
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

export function ListView({ title }: { title: string }) {
  const view = useView();
  const sort = useApp((s) => s.sort);
  const selected = useApp((s) => s.selected);
  const { doc } = view;
  const tasks = filteredTasks(doc, view).sort(SORTS[sort] || SORTS.due);
  const allSel = tasks.length > 0 && tasks.every((t) => selected.has(t.id));

  const selectAll = (on: boolean) => {
    const next = new Set(selected);
    tasks.forEach((t) => (on ? next.add(t.id) : next.delete(t.id)));
    useApp.setState({ selected: next });
  };

  return (
    <>
      <PageHead title={title} />
      <Filters sort />
      <BulkBar />
      {!tasks.length ? (
        <EmptyState filtered={doc.tasks.length > 0} />
      ) : (
        <div className="card table">
          <div className="row head">
            <label className="sel">
              <input
                type="checkbox"
                checked={allSel}
                aria-label="Select all visible tasks"
                onChange={(e) => selectAll(e.target.checked)}
              />
            </label>
            <span>Task</span>
            <span>Who</span>
            <span>Priority</span>
            <span>Due</span>
            <span>Status</span>
          </div>
          <ul>
            {tasks.map((t) => (
              <TaskRow key={t.id} t={t} doc={doc} selected={selected.has(t.id)} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
