/**
 * Calendar: tasks on their due dates, as a month grid, a week of day columns, or a list grouped by
 * date. Drag a task to another day to move its due date; hover (or focus) one for its details;
 * "+" on a day adds a task due that day.
 */
import { Plus } from 'lucide-react';
import {
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { editTask, quickAdd } from '../../app/actions';
import { openDrawer, toast, undo, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { Avatar, ProjectChip } from '../../components/shared';
import { Filters } from '../../components/layout/Toolbar';
import { nameOf } from '../../lib/model/meta';
import { parseQuickAdd } from '../../lib/model/parser';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { Doc, Task } from '../../lib/types';
import { addDays, diffDays, fmtDate, fromISO, todayISO } from '../../lib/utils/dates';
import { PriorityChip } from '../board/BoardCard';
import { StatusBadge } from '../tasks/StatusSelect';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DRAG_TYPE = 'application/x-taskflow-task';
const MONTH_LIMIT = 3;

const longDate = (iso: string) =>
  fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** Move a task to `iso`, with Undo in the toast. */
function reschedule(doc: Doc, id: string, iso: string) {
  const t = doc.tasks.find((x) => x.id === id);
  if (!t || t.due === iso) return;
  editTask(id, (x) => (x.due = iso), `Due date moved to ${fmtDate(iso)}`);
  toast(`Moved to ${fmtDate(iso)}`, undo);
}

// ---------- hover card ----------

interface Hover {
  id: string;
  left: number;
  top: number;
  above: boolean;
}

const CARD_W = 288;

/** Where the details card goes for the chip at `el`: below it, or above when near the bottom. */
function placeCard(id: string, el: Element): Hover {
  const r = el.getBoundingClientRect();
  const above = r.bottom > window.innerHeight - 240;
  return {
    id,
    left: Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8)),
    top: above ? r.top - 6 : r.bottom + 6,
    above,
  };
}

function HoverCard({ doc, hover }: { doc: Doc; hover: Hover }) {
  const t = doc.tasks.find((x) => x.id === hover.id);
  if (!t) return null;
  const subsDone = t.subtasks.filter((s) => s.done).length;
  return (
    <div
      className={`cal-card${hover.above ? ' above' : ''}`}
      style={{ left: hover.left, top: hover.top, width: CARD_W }}
      aria-hidden="true"
    >
      <div className="cal-card-head">
        <strong>{t.title}</strong>
        <i style={{ background: projectOf(doc, t).color }} />
      </div>
      {t.description && <p className="cal-card-desc">{t.description}</p>}
      <div className="cal-card-chips">
        <StatusBadge status={t.status} />
        <PriorityChip priority={t.priority} />
      </div>
      <dl className="cal-card-meta">
        <div>
          <dt>Project</dt>
          <dd>
            <ProjectChip project={projectOf(doc, t)} />
          </dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd>{nameOf(t.assignee)}</dd>
        </div>
        {t.subtasks.length > 0 && (
          <div>
            <dt>Subtasks</dt>
            <dd>{`${subsDone} of ${t.subtasks.length} done`}</dd>
          </div>
        )}
      </dl>
      {t.tags.length > 0 && (
        <p className="cal-card-tags">{t.tags.map((g) => `#${g}`).join('  ')}</p>
      )}
    </div>
  );
}

// ---------- shared pieces ----------

interface ItemProps {
  t: Task;
  doc: Doc;
  onHover: (h: Hover | null) => void;
}

/** Props that make a task draggable and give it the hover card. */
function itemHandlers({ t, onHover }: ItemProps) {
  const show = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) =>
    onHover(placeCard(t.id, e.currentTarget));
  return {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.setData(DRAG_TYPE, t.id);
      e.dataTransfer.effectAllowed = 'move';
      onHover(null);
    },
    onMouseEnter: show,
    onMouseLeave: () => onHover(null),
    onFocus: show,
    onBlur: () => onHover(null),
    onClick: () => {
      onHover(null);
      openDrawer(t.id);
    },
  };
}

/** A compact chip for the month grid, tinted with the task's project colour. */
function TaskChip(props: ItemProps) {
  const { t, doc } = props;
  return (
    <button
      type="button"
      className={`cal-chip${t.status === 'done' ? ' done' : ''}`}
      style={{ '--pc': projectOf(doc, t).color } as CSSProperties}
      {...itemHandlers(props)}
    >
      {t.title}
      {t.status === 'done' && <span className="sr-only"> (done)</span>}
    </button>
  );
}

/** A fuller card for week columns: title, project, priority and assignee. */
function WeekCard(props: ItemProps) {
  const { t, doc } = props;
  const p = projectOf(doc, t);
  return (
    <button
      type="button"
      className={`cal-wcard st-${t.status}${t.status === 'done' ? ' done' : ''}`}
      style={{ '--pc': p.color } as CSSProperties}
      {...itemHandlers(props)}
    >
      <span className="cal-wcard-title">{t.title}</span>
      <span className="cal-wcard-meta">
        <span className="cal-wcard-proj">
          <i aria-hidden="true" />
          {p.name}
        </span>
        <Avatar id={t.assignee} />
      </span>
      <span className="cal-wcard-meta">
        <StatusBadge status={t.status} />
        {t.priority === 'high' && <PriorityChip priority={t.priority} />}
      </span>
    </button>
  );
}

/** Drop target props for a day, highlighting it while a task is dragged over. */
function useDrop(doc: Doc) {
  const [over, setOver] = useState('');
  const target = (iso: string) => ({
    'data-over': over === iso || undefined,
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== iso) setOver(iso);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver('');
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver('');
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) reschedule(doc, id, iso);
    },
  });
  return target;
}

/** "+" on a day: opens a quick-add field (same syntax) for a task due that day. */
function DayAdd({ iso, wide }: { iso: string; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const close = () => {
    setOpen(false);
    setText('');
    setError('');
  };
  if (!open) {
    return (
      <button
        type="button"
        className={wide ? 'cal-add wide' : 'cal-add'}
        aria-label={`Add task on ${longDate(iso)}`}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" size={14} />
        {wide && <span aria-hidden="true">Add task</span>}
      </button>
    );
  }
  return (
    <form
      className="cal-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseQuickAdd(text);
        const err = quickAdd({ ...parsed, due: parsed.due || iso });
        setError(err);
        if (!err) close();
      }}
    >
      <input
        autoFocus // opened by the button just pressed
        className="field"
        value={text}
        aria-label={`New task due ${longDate(iso)}`}
        aria-invalid={!!error}
        placeholder="Task title"
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        }}
        onBlur={() => !text && close()}
      />
      {error && (
        <p className="cal-add-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function groupByDay(tasks: Task[]) {
  const byDay: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    if (t.due) (byDay[t.due] ||= []).push(t);
  });
  Object.values(byDay).forEach((list) => list.sort(SORTS.priority));
  return byDay;
}

// ---------- views ----------

interface GridProps {
  doc: Doc;
  tasks: Task[];
  onHover: (h: Hover | null) => void;
}

function MonthGrid({ doc, tasks, onHover }: GridProps) {
  const calMonth = useApp((s) => s.calMonth);
  const calExpanded = useApp((s) => s.calExpanded);
  const drop = useDrop(doc);
  const first = fromISO(calMonth);
  const startIso = addDays(calMonth, -first.getDay());
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const byDay = groupByDay(tasks);
  const today = todayISO();
  return (
    <div className="cal-scroll">
      <div className="cal-grid">
        {DOW.map((n) => (
          <div key={n} className="cal-dow">
            {n}
          </div>
        ))}
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const iso = addDays(startIso, i);
          const d = fromISO(iso);
          const list = byDay[iso] || [];
          const expanded = calExpanded === iso;
          const shown = expanded ? list : list.slice(0, MONTH_LIMIT);
          return (
            <div
              key={iso}
              className={`cal-cell${d.getMonth() === first.getMonth() ? '' : ' out'}${iso === today ? ' today' : ''}`}
              {...drop(iso)}
            >
              <div className="cal-cell-head">
                <span className="cal-day">
                  {d.getDate()}
                  {iso === today && <span className="sr-only"> (today)</span>}
                </span>
                <DayAdd key={`${iso}-add`} iso={iso} />
              </div>
              {shown.map((t) => (
                <TaskChip key={t.id} t={t} doc={doc} onHover={onHover} />
              ))}
              {list.length > MONTH_LIMIT && (
                <button
                  type="button"
                  className="cal-more"
                  onClick={() => useApp.setState({ calExpanded: expanded ? '' : iso })}
                >
                  {expanded ? 'Show less' : `+${list.length - MONTH_LIMIT} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ doc, tasks, onHover }: GridProps) {
  const calWeek = useApp((s) => s.calWeek);
  const drop = useDrop(doc);
  const byDay = groupByDay(tasks);
  const today = todayISO();
  return (
    <div className="cal-scroll">
      <div className="cal-week">
        {Array.from({ length: 7 }, (_, i) => {
          const iso = addDays(calWeek, i);
          const d = fromISO(iso);
          const list = byDay[iso] || [];
          return (
            <section
              key={iso}
              className={`cal-wcol${iso === today ? ' today' : ''}`}
              aria-label={`${longDate(iso)}, ${list.length} task${list.length === 1 ? '' : 's'}`}
              {...drop(iso)}
            >
              <header className="cal-whead">
                <span className="cal-wdow">{DOW[d.getDay()]}</span>
                <span className="cal-day">{d.getDate()}</span>
                {list.length > 0 && <span className="count">{list.length}</span>}
              </header>
              <div className="cal-wbody">
                {list.map((t) => (
                  <WeekCard key={t.id} t={t} doc={doc} onHover={onHover} />
                ))}
                <DayAdd iso={iso} wide />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Group heading: "Today · Wednesday, 4 November", "Tomorrow · …", "3 days ago · …". */
function dayHeading(iso: string) {
  const d = diffDays(iso);
  const rel =
    d === 0
      ? 'Today'
      : d === 1
        ? 'Tomorrow'
        : d === -1
          ? 'Yesterday'
          : d < 0
            ? `${-d} days ago`
            : '';
  return { rel, date: longDate(iso), past: d < 0 };
}

function AgendaItem({ t, doc }: { t: Task; doc: Doc }) {
  const p = projectOf(doc, t);
  return (
    <li>
      <button
        type="button"
        className={`cal-agenda-item${t.status === 'done' ? ' done' : ''}`}
        style={{ '--pc': p.color } as CSSProperties}
        onClick={() => openDrawer(t.id)}
      >
        <i className="cal-agenda-dot" aria-hidden="true" />
        <span className="cal-agenda-main">
          <span className="cal-agenda-title">{t.title}</span>
          {t.description && <span className="cal-agenda-desc">{t.description}</span>}
          <span className="cal-agenda-meta">
            <ProjectChip project={p} />
            {t.tags.map((g) => (
              <span key={g} className="tag">{`#${g}`}</span>
            ))}
          </span>
        </span>
        <span className="cal-agenda-side">
          <StatusBadge status={t.status} />
          <PriorityChip priority={t.priority} />
          <Avatar id={t.assignee} />
        </span>
      </button>
    </li>
  );
}

function AgendaList({ doc, tasks }: { doc: Doc; tasks: Task[] }) {
  const byDay = groupByDay(tasks);
  const days = Object.keys(byDay).sort();
  const undated = tasks.filter((t) => !t.due).sort(SORTS.priority);
  if (!days.length && !undated.length) {
    return <p className="cal-empty">No tasks match these filters.</p>;
  }
  return (
    <div className="cal-agenda">
      {days.map((iso) => {
        const h = dayHeading(iso);
        return (
          <section key={iso} aria-labelledby={`agenda-${iso}`}>
            <h2 id={`agenda-${iso}`} className={h.past ? 'past' : undefined}>
              {h.rel && <span className="rel">{h.rel}</span>}
              {h.date}
              <span className="count">{byDay[iso].length}</span>
            </h2>
            <ul>
              {byDay[iso].map((t) => (
                <AgendaItem key={t.id} t={t} doc={doc} />
              ))}
            </ul>
          </section>
        );
      })}
      {undated.length > 0 && (
        <section aria-labelledby="agenda-undated">
          <h2 id="agenda-undated">
            No due date<span className="count">{undated.length}</span>
          </h2>
          <ul>
            {undated.map((t) => (
              <AgendaItem key={t.id} t={t} doc={doc} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CalendarView() {
  const view = useView();
  const calView = useApp((s) => s.calView);
  const [hover, setHover] = useState<Hover | null>(null);
  const tasks = filteredTasks(view.doc, view);
  const unscheduled = tasks.filter((t) => !t.due && t.status !== 'done').length;

  // a fixed-position card would drift from its chip on scroll, so scrolling hides it
  useEffect(() => {
    if (!hover) return;
    const hide = () => setHover(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [hover]);

  return (
    <>
      <Filters />
      <div className="card cal-card-wrap">
        {calView === 'month' && <MonthGrid doc={view.doc} tasks={tasks} onHover={setHover} />}
        {calView === 'week' && <WeekGrid doc={view.doc} tasks={tasks} onHover={setHover} />}
        {calView === 'list' && <AgendaList doc={view.doc} tasks={tasks} />}
        {calView !== 'list' && unscheduled > 0 && (
          <p className="cal-note">
            {`${unscheduled} open task${unscheduled === 1 ? ' has' : 's have'} no due date and ${unscheduled === 1 ? 'is' : 'are'} not shown here. Switch to List to see ${unscheduled === 1 ? 'it' : 'them'}.`}
          </p>
        )}
      </div>
      {hover && <HoverCard doc={view.doc} hover={hover} />}
    </>
  );
}
