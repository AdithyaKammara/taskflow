import { setStatus } from '../../app/actions';
import { STATUSES } from '../../lib/config';
import type { StatusId, Task } from '../../lib/types';

/** The per-task status dropdown on list rows and board cards (also the keyboard way to move cards). */
export function StatusSelect({ task: t, label }: { task: Task; label: string }) {
  return (
    <select
      className={`field status-select st-${t.status}`}
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
  );
}
