/** Dashboard: what to do first, key numbers, charts, workload, project progress and upcoming work. */
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CalendarDays,
  CircleCheck,
  Clock,
  FileText,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { openDrawer, setProject, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { STATUSES } from '../../lib/config';
import { member } from '../../lib/model/meta';
import {
  completionTrend,
  dashboardStats,
  projectOf,
  projectTasks,
  rankNext,
} from '../../lib/model/selectors';
import type { Doc, Project, Task } from '../../lib/types';
import { diffDays, fmtDate } from '../../lib/utils/dates';
import { cap } from '../../lib/utils/text';
import { Avatar, Bar, EmptyState, Icon, PriorityBadge } from '../../components/shared';
import { PageHead } from '../../components/layout/PageHead';
import { DonutChart, TrendChart } from './charts';

type Stats = ReturnType<typeof dashboardStats>;

/* ---------- small pieces ---------- */

const ProjectTag = ({ p }: { p: Project }) => (
  <span className="ptag" title={p.name}>
    <i className="dot" style={{ background: p.color }} />
    {p.name}
  </span>
);

function Person({ id }: { id: string }) {
  const m = member(id);
  return (
    <span className="person">
      <Avatar id={id} />
      <span className={m ? 'person-name' : 'person-name muted'}>{m ? m.name : 'Unassigned'}</span>
    </span>
  );
}

function dueInfo(t: Task) {
  if (!t.due) return { text: 'No date', cls: '' };
  const d = diffDays(t.due);
  if (d < 0) return { text: `Overdue · ${-d}d`, cls: 'overdue' };
  if (d === 0) return { text: 'Today', cls: 'today' };
  if (d === 1) return { text: 'Tomorrow', cls: 'soon' };
  return { text: fmtDate(t.due), cls: '' };
}

function DueCell({ t }: { t: Task }) {
  const { text, cls } = dueInfo(t);
  return (
    <span className={`due-cell ${cls}`}>
      <Icon icon={Calendar} size={14} />
      {text}
    </span>
  );
}

function PanelHead({
  title,
  sub,
  icon,
  link,
}: {
  title: string;
  sub?: string;
  icon?: LucideIcon;
  link?: [string, string];
}) {
  return (
    <header className="panel-head">
      {icon && (
        <span className="head-icon">
          <Icon icon={icon} size={22} />
        </span>
      )}
      <div className="panel-titles">
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {link && (
        <Link className="link" to={link[0]}>
          {link[1]}
          <Icon icon={ArrowRight} size={14} />
        </Link>
      )}
    </header>
  );
}

const TitleButton = ({ t }: { t: Task }) => (
  <button type="button" className="title-btn" onClick={() => openDrawer(t.id)}>
    {t.title}
  </button>
);

/* ---------- start here ---------- */

function StartHere({ doc, project }: { doc: Doc; project: string }) {
  const top = rankNext(doc, { project });
  return (
    <section className="card start" aria-labelledby="startTitle">
      <header className="panel-head">
        <span className="head-icon">
          <Icon icon={Target} size={22} />
        </span>
        <div className="panel-titles">
          <h2 id="startTitle">Start here</h2>
          <p className="muted">Your top priorities right now</p>
        </div>
        <Link className="link" to="/tasks">
          View all tasks
          <Icon icon={ArrowRight} size={14} />
        </Link>
      </header>
      {top.length ? (
        <ol className="start-list">
          {top.map((r, i) => (
            <li key={r.t.id} className="start-row">
              <span className="rank">{i + 1}</span>
              <TitleButton t={r.t} />
              <div className="row-meta">
                <ProjectTag p={projectOf(doc, r.t)} />
                <PriorityBadge task={r.t} />
                <DueCell t={r.t} />
                <Person id={r.t.assignee} />
              </div>
              <p className="why">{cap(r.why.join(', ') || 'Next in line')}</p>
              <button type="button" className="btn sm" onClick={() => openDrawer(r.t.id)}>
                Open
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="start-empty muted">Nothing urgent. Add a task or enjoy the quiet.</p>
      )}
    </section>
  );
}

/* ---------- key numbers ---------- */

interface KpiProps {
  tone: string;
  icon: LucideIcon;
  num: number;
  label: string;
  sub: string;
  trend?: 'up' | 'down' | '';
  alert?: boolean;
}

function Kpi({ tone, icon, num, label, sub, trend, alert }: KpiProps) {
  return (
    <div className={`kpi tone-${tone}${alert ? ' alert' : ''}`}>
      <span className="tile">
        <Icon icon={icon} size={24} />
      </span>
      <div className="kpi-body">
        <p className="kpi-main">
          <strong className="kpi-num">{num}</strong>
          <span className="kpi-label">{label}</span>
        </p>
        <p className={`kpi-sub ${trend || ''}`}>
          {trend === 'up' && <Icon icon={ArrowUp} size={14} />}
          {trend === 'down' && <Icon icon={ArrowDown} size={14} />}
          {sub}
        </p>
      </div>
    </div>
  );
}

function KpiRow({ s }: { s: Stats }) {
  const diff = s.doneWeek.length - s.doneLastWeek.length;
  const weekSub =
    diff === 0
      ? 'Same as last week'
      : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`;
  return (
    <div className="kpis">
      <Kpi
        tone="blue"
        icon={FileText}
        num={s.open.length}
        label="Open tasks"
        sub={s.highOpen ? `${s.highOpen} high priority` : 'None high priority'}
      />
      <Kpi
        tone="red"
        icon={Clock}
        num={s.overdue.length}
        label="Overdue"
        alert={s.overdue.length > 0}
        sub={
          s.overdue.length
            ? `Oldest is ${s.oldestOverdue} day${s.oldestOverdue === 1 ? '' : 's'} late`
            : 'Nothing overdue'
        }
      />
      <Kpi
        tone="amber"
        icon={Calendar}
        num={s.soon.length}
        label="Due in 7 days"
        sub={s.nextDue ? `Next: ${fmtDate(s.nextDue)}` : 'Nothing scheduled'}
      />
      <Kpi
        tone="green"
        icon={CircleCheck}
        num={s.doneWeek.length}
        label="Completed this week"
        sub={weekSub}
        trend={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}
      />
    </div>
  );
}

/* ---------- panels ---------- */

function StatusPanel({ s, total }: { s: Stats; total: number }) {
  return (
    <section className="card panel span-5">
      <PanelHead title="Task status breakdown" />
      <div className="donut-wrap">
        <DonutChart counts={s.counts} total={total} />
        <ul className="legend">
          {STATUSES.map((st) => (
            <li key={st.id}>
              <i className={`status-dot st-${st.id}`} />
              <span className="legend-label">{st.label}</span>
              <strong>{s.counts[st.id]}</strong>
              <span className="legend-pct muted">
                {Math.round((s.counts[st.id] / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrendPanel({ tasks }: { tasks: Task[] }) {
  const n = useApp((s) => s.trendDays);
  const wrap = useRef<HTMLDivElement>(null);
  // on narrow screens the chart scrolls sideways; start at the right so today is visible
  useLayoutEffect(() => {
    if (wrap.current) wrap.current.scrollLeft = wrap.current.scrollWidth;
  }, [n]);
  return (
    <section className="card panel span-7">
      <header className="panel-head">
        <div className="panel-titles">
          <h2>{`Completed in the last ${n} days`}</h2>
        </div>
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
      </header>
      <div className="trend-wrap" ref={wrap}>
        <TrendChart {...completionTrend(tasks, new Date(), n)} />
      </div>
    </section>
  );
}

function WorkloadPanel({ s, wide }: { s: Stats; wide: boolean }) {
  const max = Math.max(1, ...s.workload.map((w) => w.n));
  return (
    <section className={`card panel ${wide ? 'span-12' : 'span-7'}`}>
      <PanelHead title="Workload (open tasks)" />
      <ul className="wl-list">
        {s.workload.map((w) => (
          <li key={w.id || 'none'} className="wl">
            <Avatar id={w.id} />
            <span className="wl-name">{w.name}</span>
            <Bar pct={(w.n / max) * 100} />
            <strong>{w.n}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsPanel({ doc, tasks }: { doc: Doc; tasks: Task[] }) {
  return (
    <section className="card panel span-5">
      <PanelHead title="Project progress" />
      <ul className="proj-list">
        {doc.projects.map((p) => {
          const pt = tasks.filter((t) => t.project === p.id);
          const done = pt.filter((t) => t.status === 'done').length;
          const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
          return (
            <li key={p.id}>
              <button type="button" className="proj-row" onClick={() => setProject(p.id)}>
                <span className="proj-name">
                  <i className="dot" style={{ background: p.color }} />
                  {p.name}
                </span>
                <span className="muted">{`${done}/${pt.length}`}</span>
                <Bar pct={pct} color={p.color} />
                <strong>{pct}%</strong>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ComingUp({ doc, s }: { doc: Doc; s: Stats }) {
  return (
    <section className="card panel coming">
      <PanelHead
        title="Coming up"
        sub="Tasks due soon. Stay on track."
        icon={CalendarDays}
        link={['/calendar', 'View calendar']}
      />
      {s.dueList.length ? (
        <ul className="coming-list">
          {s.dueList.map((t) => {
            const { text, cls } = dueInfo(t);
            return (
              <li key={t.id} className="coming-row">
                <span className={`due-chip ${cls}`}>{text}</span>
                <TitleButton t={t} />
                <div className="row-meta">
                  <ProjectTag p={projectOf(doc, t)} />
                  <Person id={t.assignee} />
                  <PriorityBadge task={t} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Nothing scheduled. Add due dates to see upcoming work here.</p>
      )}
    </section>
  );
}

/* ---------- screen ---------- */

export function Dashboard() {
  const { doc, project } = useView();
  const tasks = projectTasks(doc, { project });
  const s = dashboardStats(tasks);
  return (
    <>
      <PageHead title="Dashboard" greeting />
      {!tasks.length ? (
        <EmptyState filtered={false} />
      ) : (
        <>
          <StartHere doc={doc} project={project} />
          <KpiRow s={s} />
          <div className="dash-grid">
            <StatusPanel s={s} total={tasks.length} />
            <TrendPanel tasks={tasks} />
            <WorkloadPanel s={s} wide={!!project} />
            {!project && <ProjectsPanel doc={doc} tasks={tasks} />}
          </div>
          <ComingUp doc={doc} s={s} />
        </>
      )}
    </>
  );
}
