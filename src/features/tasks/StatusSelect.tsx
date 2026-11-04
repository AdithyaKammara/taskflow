import { setStatus } from '../../app/actions';
import { STATUSES } from '../../lib/config';
import { statusLabel } from '../../lib/model/meta';
import type { StatusId, Task } from '../../lib/types';

/** The coloured dot inside a status pill; "In progress" pulses to show work is live. */
const StatusIndicator = () => <span className="status-indicator" aria-hidden="true" />;

/** A read-only status pill: tinted background, thin border, dot and label. */
export function StatusBadge({ status }: { status: StatusId }) {
  return (
    <span className={`status st-${status}`}>
      <StatusIndicator />
      {statusLabel(status)}
    </span>
  );
}

/** The per-task status pill on list rows; it is also the dropdown that changes the status. */
export function StatusSelect({ task: t, label }: { task: Task; label: string }) {
  return (
    <span className={`status status-control st-${t.status}`}>
      <StatusIndicator />
      <select
        aria-label={label}
        value={t.status}
        onChange={(e) => setStatus(t.id, e.target.value as StatusId)}
      >
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  );
}
