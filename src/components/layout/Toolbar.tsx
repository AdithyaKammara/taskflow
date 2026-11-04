/** The toolbar under the header (quick add, new project, project filter, month controls) and the filter bar. */
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FolderPlus,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { quickAdd } from '../../app/actions';
import {
  clearPanelFilters,
  openDialog,
  setCalView,
  setProject,
  useApp,
  weekStart,
  type CalView,
  type SortKey,
} from '../../app/store';
import { PRIORITIES, STATUSES } from '../../lib/config';
import { parseQuickAdd } from '../../lib/model/parser';
import { panelFilterCount, projectTasks } from '../../lib/model/selectors';
import { addDays, fmtMonth, fromISO, toISO, todayISO } from '../../lib/utils/dates';
import { cap } from '../../lib/utils/text';
import { Icon } from '../shared';

const CAL_VIEWS: { id: CalView; label: string; icon: typeof CalendarDays }[] = [
  { id: 'month', label: 'Month', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: Columns3 },
  { id: 'list', label: 'List', icon: List },
];

/** Move the calendar by a month (month view) or a week (week view), or back to today. */
function moveCalendar(direction: 'prev' | 'next' | 'today') {
  const { calView, calMonth, calWeek } = useApp.getState();
  const today = todayISO();
  if (calView === 'week') {
    const step = direction === 'next' ? 7 : -7;
    useApp.setState({ calWeek: direction === 'today' ? weekStart(today) : addDays(calWeek, step) });
    return;
  }
  let month = today.slice(0, 8) + '01';
  if (direction !== 'today') {
    const d = fromISO(calMonth);
    d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1), 1);
    month = toISO(d);
  }
  useApp.setState({ calMonth: month, calExpanded: '' });
}

/** The week as a date range in the reader's locale, e.g. "Nov 1 – 7, 2026" or "1–7 Nov 2026". */
const fmtWeek = (start: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatRange(fromISO(start), fromISO(addDays(start, 6)));

/** Calendar layout switch (Month / Week / List) and, for month and week, prev / next / Today. */
function CalendarControls() {
  const calView = useApp((s) => s.calView);
  const calMonth = useApp((s) => s.calMonth);
  const calWeek = useApp((s) => s.calWeek);
  const unit = calView === 'week' ? 'week' : 'month';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="seg cal-views" role="group" aria-label="Calendar view">
        {CAL_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={calView === v.id}
            onClick={() => setCalView(v.id)}
          >
            <Icon icon={v.icon} size={15} />
            <span className="max-sm:sr-only">{v.label}</span>
          </button>
        ))}
      </div>
      {calView !== 'list' && (
        <>
          <button
            type="button"
            className="icon-btn bordered"
            aria-label={`Previous ${unit}`}
            onClick={() => moveCalendar('prev')}
          >
            <Icon icon={ChevronLeft} />
          </button>
          <span className="cal-title" aria-live="polite">
            {calView === 'week' ? fmtWeek(calWeek) : fmtMonth(calMonth)}
          </span>
          <button
            type="button"
            className="icon-btn bordered"
            aria-label={`Next ${unit}`}
            onClick={() => moveCalendar('next')}
          >
            <Icon icon={ChevronRight} />
          </button>
          <button type="button" className="btn" onClick={() => moveCalendar('today')}>
            Today
          </button>
        </>
      )}
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
        {calendar && <CalendarControls />}
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

/** Toggles `item` in a list: adds it when missing, removes it when present. */
const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** A pill that switches one value of a multi-select filter on and off. */
function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pill${on ? ' active' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** The panel behind the Filters button: status, priority, assignee and due-date range. */
function FilterPanel() {
  const f = useApp(
    useShallow(({ team, statuses, priorities, assignees, dueFrom, dueTo }) => ({
      team,
      statuses,
      priorities,
      assignees,
      dueFrom,
      dueTo,
    }))
  );
  const set = useApp.setState;
  const people = [
    ...f.team.map((m) => ({ id: m.id, name: m.name })),
    { id: '', name: 'Unassigned' },
  ];
  return (
    <div id="filterPanel" className="filter-panel" role="group" aria-label="Filters">
      <fieldset>
        <legend>Status</legend>
        <div className="filter-chips">
          {STATUSES.map((st) => (
            <ToggleChip
              key={st.id}
              on={f.statuses.includes(st.id)}
              onClick={() => set({ statuses: toggle(f.statuses, st.id) })}
            >
              {st.label}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Priority</legend>
        <div className="filter-chips">
          {PRIORITIES.map((p) => (
            <ToggleChip
              key={p}
              on={f.priorities.includes(p)}
              onClick={() => set({ priorities: toggle(f.priorities, p) })}
            >
              {cap(p)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset className="span-2">
        <legend>Assignees</legend>
        <div className="filter-chips">
          {people.map((m) => (
            <ToggleChip
              key={m.id || 'unassigned'}
              on={f.assignees.includes(m.id)}
              onClick={() => set({ assignees: toggle(f.assignees, m.id) })}
            >
              {m.name}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset className="span-2">
        <legend>Due date</legend>
        <div className="filter-dates">
          <label>
            <span>From</span>
            <input
              className="field"
              type="date"
              value={f.dueFrom}
              max={f.dueTo || undefined}
              onChange={(e) => set({ dueFrom: e.target.value })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              className="field"
              type="date"
              value={f.dueTo}
              min={f.dueFrom || undefined}
              onChange={(e) => set({ dueTo: e.target.value })}
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

/** Search, the Filters button and panel, sort (list only) and the quick-filter pills. */
export function Filters({ sort }: { sort?: boolean }) {
  const s = useApp(
    useShallow((st) => ({
      doc: st.doc,
      project: st.project,
      search: st.search,
      sort: st.sort,
      quickChip: st.quickChip,
      // the search box counts as a filter too, like the panel groups
      active: panelFilterCount(st) + (st.search.trim() ? 1 : 0),
    }))
  );
  const [open, setOpen] = useState(false);
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
        <div className="search-group">
          <Icon icon={Search} size={16} />
          <input
            id="searchInput"
            className="field search"
            type="search"
            placeholder="Search tasks (press /)"
            value={s.search}
            onChange={(e) => useApp.setState({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && s.search) {
                e.stopPropagation();
                useApp.setState({ search: '' });
              }
            }}
          />
          {s.search && (
            <button
              type="button"
              className="icon-btn search-clear"
              aria-label="Clear search"
              onClick={() => {
                useApp.setState({ search: '' });
                document.getElementById('searchInput')?.focus();
              }}
            >
              <Icon icon={X} size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          className={`btn filter-toggle${s.active ? ' has-active' : ''}`}
          aria-expanded={open}
          aria-controls="filterPanel"
          onClick={() => setOpen(!open)}
        >
          <Icon icon={SlidersHorizontal} size={16} />
          Filters
          {s.active > 0 && (
            <span className="filter-count" aria-label={`${s.active} active`}>
              {s.active}
            </span>
          )}
        </button>
        {s.active > 0 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              clearPanelFilters();
              useApp.setState({ search: '' });
            }}
          >
            <Icon icon={X} size={16} />
            Clear all
          </button>
        )}
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
      {open && <FilterPanel />}
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
