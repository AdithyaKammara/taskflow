/** The toolbar under the header (quick add, new project, project filter, month controls) and the filter bar. */
import { ChevronLeft, ChevronRight, FolderPlus, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { quickAdd } from '../../app/actions';
import { openDialog, setProject, useApp, type SortKey } from '../../app/store';
import { PRIORITIES } from '../../lib/config';
import { parseQuickAdd } from '../../lib/model/parser';
import { projectTasks } from '../../lib/model/selectors';
import { fmtMonth, fromISO, toISO, todayISO } from '../../lib/utils/dates';
import { cap } from '../../lib/utils/text';
import { Icon } from '../shared';

/** Move the calendar by a month, or back to the current month. */
function moveCalendar(direction: 'prev' | 'next' | 'today') {
  let calMonth = todayISO().slice(0, 8) + '01';
  if (direction !== 'today') {
    const d = fromISO(useApp.getState().calMonth);
    d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1), 1);
    calMonth = toISO(d);
  }
  useApp.setState({ calMonth, calExpanded: '' });
}

function MonthControls() {
  const calMonth = useApp((s) => s.calMonth);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="icon-btn bordered"
        aria-label="Previous month"
        onClick={() => moveCalendar('prev')}
      >
        <Icon icon={ChevronLeft} />
      </button>
      <span className="cal-title" aria-live="polite">
        {fmtMonth(calMonth)}
      </span>
      <button
        type="button"
        className="icon-btn bordered"
        aria-label="Next month"
        onClick={() => moveCalendar('next')}
      >
        <Icon icon={ChevronRight} />
      </button>
      <button type="button" className="btn" onClick={() => moveCalendar('today')}>
        Today
      </button>
    </div>
  );
}

interface ToolbarProps {
  quick: string;
  setQuick: (text: string) => void;
  setQuickError: (msg: string) => void;
  calendar: boolean;
}

export function Toolbar({ quick, setQuick, setQuickError, calendar }: ToolbarProps) {
  const projects = useApp((s) => s.doc.projects);
  const project = useApp((s) => s.project);
  return (
    <div className="toolbar">
      <form
        className="quick-add"
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
        <Icon icon={Plus} size={16} />
        <input
          id="quickInput"
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
        <button className="btn btn-primary sm" type="submit">
          Add task
        </button>
      </form>
      <button type="button" className="btn" onClick={() => openDialog('project')}>
        <Icon icon={FolderPlus} size={16} />
        <span className="max-sm:sr-only">Add project</span>
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {calendar && <MonthControls />}
        <label className="sr-only" htmlFor="projectFilter">
          Project
        </label>
        <select
          id="projectFilter"
          className="field"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  due: 'Sort: Due date',
  priority: 'Sort: Priority',
  newest: 'Sort: Newest',
  title: 'Sort: Title',
};

/** Search, assignee, priority, sort (list only) and the quick-filter pills. */
export function Filters({ sort }: { sort?: boolean }) {
  const s = useApp(
    useShallow(({ doc, team, project, search, assignee, priority, sort, quickChip }) => ({
      team,
      doc,
      project,
      search,
      assignee,
      priority,
      sort,
      quickChip,
    }))
  );
  const tags = [...new Set(projectTasks(s.doc, s).flatMap((t) => t.tags))].slice(0, 6);
  const pills = [
    ['all', 'All'],
    ['today', 'Due Today'],
    ['overdue', 'Overdue'],
    ['unassigned', 'Unassigned'],
    ...tags.map((g) => [`#${g}`, `#${g}`]),
  ];
  return (
    <>
      <div className="filters">
        <label className="sr-only" htmlFor="searchInput">
          Search tasks
        </label>
        <input
          id="searchInput"
          className="field search"
          type="search"
          placeholder="Filter tasks (press /)"
          value={s.search}
          onChange={(e) => useApp.setState({ search: e.target.value })}
        />
        <label className="sr-only" htmlFor="assigneeFilter">
          Assignee
        </label>
        <select
          id="assigneeFilter"
          className="field"
          value={s.assignee}
          onChange={(e) => useApp.setState({ assignee: e.target.value })}
        >
          <option value="">All assignees</option>
          {s.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="priorityFilter">
          Priority
        </label>
        <select
          id="priorityFilter"
          className="field"
          value={s.priority}
          onChange={(e) => useApp.setState({ priority: e.target.value })}
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {cap(p)}
            </option>
          ))}
        </select>
        {sort && (
          <>
            <label className="sr-only" htmlFor="sortSelect">
              Sort
            </label>
            <select
              id="sortSelect"
              className="field"
              value={s.sort}
              onChange={(e) => useApp.setState({ sort: e.target.value as SortKey })}
            >
              {Object.entries(SORT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="quick-pills" aria-label="Quick filters">
        {pills.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pill${s.quickChip === id ? ' active' : ''}`}
            aria-pressed={s.quickChip === id}
            onClick={() => useApp.setState({ quickChip: id })}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
