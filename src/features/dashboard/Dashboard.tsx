/**
 * Dashboard: four key numbers, the completed-tasks trend, "Start here" (the three tasks to look at
 * first), a week calendar of due tasks, and the status, workload and project breakdowns.
 */
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Flag,
  ListChecks,
  ListTodo,
  MessageSquare,
  Minus,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { openDrawer, setProject, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { STATUSES } from '../../lib/config';
import { member, statusLabel } from '../../lib/model/meta';
import {
  SORTS,
  completionTrend,
  dashboardStats,
  projectTasks,
  rankNext,
} from '../../lib/model/selectors';
import type { Doc, Task } from '../../lib/types';
import { addDays, diffDays, fmtDate, fromISO, todayISO } from '../../lib/utils/dates';
import { cap } from '../../lib/utils/text';
import { Avatar, Bar, EmptyState, Icon } from '../../components/shared';
import { DonutChart, TrendChart } from './charts';

type Stats = ReturnType<typeof dashboardStats>;

/* ---------- small pieces ---------- */

function Card({
  title,
  sub,
  action,
  children,
  className = '',
  labelId,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  labelId?: string;
}) {
  return (
    <section className={`db-card ${className}`} aria-labelledby={labelId}>
      <header className="db-card-head">
        <div>
          <h2 id={labelId}>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Person({ id }: { id: string }) {
  const m = member(id);
  return (
    <span className="db-person">
      <Avatar id={id} />
      <span className={m ? '' : 'muted'}>{m ? m.name : 'Unassigned'}</span>
    </span>
  );
}

function dueInfo(t: Task) {
  if (!t.due) return { text: 'No date', cls: '' };
  if (t.status === 'done') return { text: fmtDate(t.due), cls: '' };
  const d = diffDays(t.due);
  if (d < 0) return { text: `Overdue · ${-d}d`, cls: 'overdue' };
  if (d === 0) return { text: 'Today', cls: 'today' };
  if (d === 1) return { text: 'Tomorrow', cls: '' };
  return { text: fmtDate(t.due), cls: '' };
}

const StatusPill = ({ t }: { t: Task }) => (
  <span className={`db-status st-${t.status}`}>{statusLabel(t.status)}</span>
);

const ViewAll = ({ to, label }: { to: string; label: string }) => (
  <Link className="link" to={to}>
    {label}
    <Icon icon={ArrowRight} size={14} />
  </Link>
);

/* ---------- key numbers ---------- */

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: number;
  sub: string;
  delta?: { text: string; dir: 'up' | 'down' | 'flat' };
  alert?: boolean;
}

function Stat({ icon, label, value, sub, delta, alert }: StatProps) {
  const DeltaIcon = delta?.dir === 'up' ? TrendingUp : delta?.dir === 'down' ? TrendingDown : Minus;
  return (
    <div className={`db-card db-stat${alert ? ' alert' : ''}`}>
      <p className="db-stat-label">
        <span className="db-stat-icon">
          <Icon icon={icon} size={15} />
        </span>
        {label}
      </p>
      <p className="db-stat-value">
        <strong>{value}</strong>
        <span>{value === 1 ? 'task' : 'tasks'}</span>
        {delta && (
          <span className={`db-delta ${delta.dir}`}>
            <Icon icon={DeltaIcon} size={12} />
            {delta.text}
          </span>
        )}
      </p>
      <p className="db-stat-sub">{sub}</p>
    </div>
  );
}

function Stats({ s }: { s: Stats }) {
  const done = s.doneWeek.length;
  const last = s.doneLastWeek.length;
  const diff = done - last;
  // a percentage only when last week had something to compare with
  const delta = last
    ? ({
        text: `${Math.abs(Math.round((diff / last) * 100))}%`,
        dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      } as const)
    : undefined;
  return (
    <div className="db-stats">
      <Stat
        icon={ListTodo}
        label="Open tasks"
        value={s.open.length}
        sub={s.highOpen ? `${s.highOpen} high priority` : 'None high priority'}
      />
      <Stat
        icon={TriangleAlert}
        label="Overdue"
        value={s.overdue.length}
        alert={s.overdue.length > 0}
        sub={
          s.overdue.length
            ? `Oldest is ${s.oldestOverdue} day${s.oldestOverdue === 1 ? '' : 's'} late`
            : 'Nothing overdue'
        }
      />
      <Stat
        icon={CalendarClock}
        label="Due in 7 days"
        value={s.soon.length}
        sub={s.nextDue ? `Next: ${fmtDate(s.nextDue)}` : 'Nothing scheduled'}
      />
      <Stat
        icon={CircleCheck}
        label="Completed this week"
        value={done}
        delta={delta}
        sub={`${diff >= 0 ? '+' : '−'}${Math.abs(diff)} vs last week`}
      />
    </div>
  );
}

/* ---------- trend ---------- */

function Trend({ tasks }: { tasks: Task[] }) {
  const n = useApp((s) => s.trendDays);
  return (
    <Card
      title="Completed tasks"
      sub={`Tasks finished per day, last ${n} days`}
      action={
        <select
          className="field sm"
          aria-label="Chart range"
          value={n}
          onChange={(e) => {
            const v = Number(e.target.value);
            useApp.setState({ trendDays: v === 7 || v === 30 ? v : 14 });
          }}
        >
          {[7, 14, 30].map((d) => (
            <option key={d} value={d}>{`Last ${d} days`}</option>
          ))}
        </select>
      }
    >
      <TrendChart {...completionTrend(tasks, new Date(), n)} />
    </Card>
  );
}

/* ---------- start here ---------- */

function StartHere({ doc, project }: { doc: Doc; project: string }) {
  const top = rankNext(doc, { project });
  return (
    <Card
      title="Start here"
      sub="Your top priorities right now"
      labelId="startTitle"
      action={<ViewAll to="/tasks" label="All tasks" />}
    >
      {top.length ? (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Task</th>
                <th scope="col" className="hide-sm">
                  Assignee
                </th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ t, why }, i) => {
                const due = dueInfo(t);
                return (
                  <tr key={t.id}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <button type="button" className="title-btn" onClick={() => openDrawer(t.id)}>
                        {t.title}
                      </button>
                      <p className="db-why">{cap(why.join(', ') || 'Next in line')}</p>
                    </td>
                    <td className="hide-sm">
                      <Person id={t.assignee} />
                    </td>
                    <td className={`db-due ${due.cls}`}>{due.text}</td>
                    <td>
                      <StatusPill t={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="db-empty">Nothing urgent. Add a task or enjoy the quiet.</p>
      )}
    </Card>
  );
}

/* ---------- task calendar ---------- */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const start = addDays(day, -fromISO(day).getDay());
  const week = DOW.map((_, i) => addDays(start, i));
  const due = tasks.filter((t) => t.due === day).sort(SORTS.priority);
  // the next open tasks after the chosen day (v6's "Coming up")
  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.due > day)
    .sort(SORTS.due)
    .slice(0, 5);
  const month = fromISO(day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <Card
      title="Task calendar"
      sub={month}
      labelId="calTitle"
      action={<ViewAll to="/calendar" label="Calendar" />}
    >
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="link" onClick={() => setDay(addDays(day, -7))}>
          ‹ Previous week
        </button>
        {day !== today && (
          <button type="button" className="link" onClick={() => setDay(today)}>
            Today
          </button>
        )}
        <button type="button" className="link" onClick={() => setDay(addDays(day, 7))}>
          Next week ›
        </button>
      </div>
      <div className="db-week" role="group" aria-label="Pick a day">
        {week.map((iso, i) => {
          const count = tasks.filter((t) => t.due === iso && t.status !== 'done').length;
          return (
            <button
              key={iso}
              type="button"
              className={`db-day${count ? ' has' : ''}`}
              aria-pressed={iso === day}
              onClick={() => setDay(iso)}
            >
              {/* the visible day and date stay the start of the name; the rest is for screen readers */}
              {DOW[i]}
              <b>{fromISO(iso).getDate()}</b>
              <span className="sr-only">
                {fromISO(iso).toLocaleDateString(undefined, { month: 'long' })}
                {count ? `, ${count} open` : ''}
              </span>
            </button>
          );
        })}
      </div>
      {due.length ? (
        <ul className="db-tasks">
          {due.map((t) => {
            const subsDone = t.subtasks.filter((s) => s.done).length;
            const info = dueInfo(t);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`db-tcard${t.status === 'done' ? ' done' : ''}`}
                  onClick={() => openDrawer(t.id)}
                >
                  <span className="db-tcard-title">{t.title}</span>
                  {t.description && <span className="db-tcard-desc">{t.description}</span>}
                  <span className="db-tcard-meta">
                    <Icon icon={Flag} size={13} />
                    <span className={`db-due ${info.cls}`}>{info.text}</span>
                    <StatusPill t={t} />
                  </span>
                  <span className="db-tcard-meta">
                    <Avatar id={t.assignee} />
                    <span>{member(t.assignee)?.name || 'Unassigned'}</span>
                    <span className="db-counts">
                      <span title="Subtasks done">
                        <Icon icon={ListChecks} size={13} />
                        {subsDone}/{t.subtasks.length}
                      </span>
                      <span title="Comments">
                        <Icon icon={MessageSquare} size={13} />
                        {t.comments.length}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="db-empty">Nothing due on {fmtDate(day)}.</p>
      )}
      {upcoming.length > 0 && (
        <>
          <h3 className="db-sub-head">Coming up</h3>
          <ul className="db-upcoming">
            {upcoming.map((t) => {
              const info = dueInfo(t);
              return (
                <li key={t.id}>
                  <span className={`db-due ${info.cls}`}>{info.text}</span>
                  <button type="button" className="title-btn" onClick={() => openDrawer(t.id)}>
                    {t.title}
                  </button>
                  <Avatar id={t.assignee} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ---------- breakdowns ---------- */

function StatusCard({ s, total }: { s: Stats; total: number }) {
  return (
    <Card title="Status breakdown" sub="All tasks in view, by status">
      <div className="db-donut">
        <DonutChart counts={s.counts} total={total} />
        <ul className="db-list">
          {STATUSES.map((st) => (
            <li key={st.id} className={`st-${st.id}`}>
              <i className="dot" aria-hidden="true" />
              <span>{st.label}</span>
              <span>
                <strong>{s.counts[st.id]}</strong>{' '}
                <span className="muted">{Math.round((s.counts[st.id] / total) * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function WorkloadCard({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.workload.map((w) => w.n));
  return (
    <Card title="Workload" sub="Open tasks per person">
      <ul className="db-bars">
        {s.workload.map((w) => (
          <li key={w.id || 'none'}>
            <Person id={w.id} />
            <strong>{w.n}</strong>
            <Bar pct={(w.n / max) * 100} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProjectsCard({ doc, tasks }: { doc: Doc; tasks: Task[] }) {
  return (
    <Card title="Project progress" sub="Done out of all tasks">
      <ul className="db-bars">
        {doc.projects.map((p) => {
          const pt = tasks.filter((t) => t.project === p.id);
          const done = pt.filter((t) => t.status === 'done').length;
          const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="db-person"
                onClick={() => setProject(p.id)}
                aria-label={`Show ${p.name}: ${done} of ${pt.length} done`}
              >
                <i
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </button>
              <span className="text-muted">
                {done}/{pt.length} · <strong className="text-text">{pct}%</strong>
              </span>
              <Bar pct={pct} color={p.color} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- screen ---------- */

export function Dashboard() {
  const { doc, project } = useView();
  const tasks = projectTasks(doc, { project });
  if (!tasks.length) return <EmptyState filtered={false} />;
  const s = dashboardStats(tasks);
  return (
    <div className="db">
      <Stats s={s} />
      <div className="db-main">
        <div className="db-main-left">
          <Trend tasks={tasks} />
          <StartHere doc={doc} project={project} />
        </div>
        <TaskCalendar tasks={tasks} />
      </div>
      <div className={`db-row3${project ? ' two' : ''}`}>
        <StatusCard s={s} total={tasks.length} />
        <WorkloadCard s={s} />
        {!project && <ProjectsCard doc={doc} tasks={tasks} />}
      </div>
    </div>
  );
}
