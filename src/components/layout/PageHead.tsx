/** Page header (crumb, title, greeting, daily quote, calendar month controls) and the filter bar. */
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useApp, type SortKey } from '../../app/store';
import { PRIORITIES, QUOTES } from '../../lib/config';
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

export function PageHead({ title, greeting }: { title: string; greeting?: boolean }) {
  const projects = useApp((s) => s.doc.projects);
  const projectId = useApp((s) => s.project);
  const calMonth = useApp((s) => s.calMonth);
  const team = useApp((s) => s.team);
  const me = useApp((s) => s.me);
  const proj = projects.find((p) => p.id === projectId);
  const isCalendar = title === 'Calendar';
  const greet = greeting && !proj;

  useEffect(() => {
    document.title = `${title} · TaskFlow`;
  }, [title]);

  const now = new Date();
  let heading: ReactNode = title;
  let crumb = proj ? proj.name : 'All projects';
  let actions: ReactNode = null;

  if (greet) {
    const first = (team.find((m) => m.id === me)?.name || '').split(' ')[0];
    const hour = now.getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    heading = (
      <>
        {first ? `${hello}, ${first}` : hello}
        <span className={`greet-icon ${hour < 18 ? 'day' : 'night'}`}>
          <Icon icon={hour < 18 ? Sun : Moon} size={26} />
        </span>
      </>
    );
    crumb = now.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const [line, follow] = QUOTES[Math.floor(now.getTime() / 86400000) % QUOTES.length];
    actions = (
      <aside className="quote" aria-label="Daily reminder">
        <div>
          <p className="quote-line">{`“${line}”`}</p>
          <p className="muted">{follow}</p>
        </div>
      </aside>
    );
  } else if (isCalendar) {
    actions = (
      <>
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
      </>
    );
  }

  return (
    <div className="page-head">
      <div>
        <p className="crumb">{crumb}</p>
        <h1>{heading}</h1>
        {greet && <p className="page-sub">A clear view of what needs your attention.</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
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
