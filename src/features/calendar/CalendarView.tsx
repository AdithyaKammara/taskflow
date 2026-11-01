/** Month calendar: tasks on their due dates, three per day with "+N more". */
import { openDrawer, useApp } from '../../app/store';
import { useView } from '../../app/useView';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { Task } from '../../lib/types';
import { addDays, fromISO, todayISO } from '../../lib/utils/dates';
import { Filters, PageHead } from '../../components/layout/PageHead';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView() {
  const view = useView();
  const calMonth = useApp((s) => s.calMonth);
  const calExpanded = useApp((s) => s.calExpanded);
  const first = fromISO(calMonth);
  const startIso = addDays(calMonth, -first.getDay());
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const tasks = filteredTasks(view.doc, view);

  const byDay: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    if (t.due) (byDay[t.due] ||= []).push(t);
  });

  const today = todayISO();
  const unscheduled = tasks.filter((t) => !t.due && t.status !== 'done').length;

  return (
    <>
      <PageHead title="Calendar" />
      <Filters />
      <div className="card">
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
              const list = (byDay[iso] || []).sort(SORTS.priority);
              const expanded = calExpanded === iso;
              const shown = expanded ? list : list.slice(0, 3);
              return (
                <div
                  key={iso}
                  className={`cal-cell${d.getMonth() === first.getMonth() ? '' : ' out'}${iso === today ? ' today' : ''}`}
                >
                  <span className="cal-day">{d.getDate()}</span>
                  {shown.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`chip${t.status === 'done' ? ' done' : ''}`}
                      style={{ borderLeftColor: projectOf(view.doc, t).color }}
                      title={t.title}
                      onClick={() => openDrawer(t.id)}
                    >
                      {t.title}
                    </button>
                  ))}
                  {list.length > 3 && (
                    <button
                      type="button"
                      className="cal-more"
                      onClick={() => useApp.setState({ calExpanded: expanded ? '' : iso })}
                    >
                      {expanded ? 'Show less' : `+${list.length - 3} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {unscheduled > 0 && (
          <p className="cal-note">
            {`${unscheduled} open task${unscheduled === 1 ? ' has' : 's have'} no due date and ${unscheduled === 1 ? 'is' : 'are'} not shown here.`}
          </p>
        )}
      </div>
    </>
  );
}
