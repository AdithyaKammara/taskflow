/** Hand-built SVG charts (no chart library), ported from v6 views/charts.js. */
import { STATUSES } from '../../lib/config';
import type { StatusId } from '../../lib/types';
import { fmtDate, fromISO } from '../../lib/utils/dates';

export function DonutChart({ counts, total }: { counts: Record<StatusId, number>; total: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  // each segment starts where the previous ones end
  const segs = STATUSES.filter((s) => counts[s.id]).map((s) => ({
    id: s.id,
    len: (counts[s.id] / total) * C,
  }));
  const starts = segs.map((_, i) => segs.slice(0, i).reduce((a, x) => a + x.len, 0));
  return (
    <svg
      viewBox="0 0 120 120"
      className="donut"
      role="img"
      aria-label={
        'Status breakdown: ' + STATUSES.map((s) => `${counts[s.id]} ${s.label}`).join(', ')
      }
    >
      <circle cx={60} cy={60} r={R} className="donut-track" />
      {segs.map(({ id, len }, i) => (
        <circle
          key={id}
          cx={60}
          cy={60}
          r={R}
          className={`donut-seg st-${id}`}
          transform="rotate(-90 60 60)"
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-starts[i]}
        />
      ))}
      <text x={60} y={62} textAnchor="middle" className="donut-num">
        {total}
      </text>
      <text x={60} y={76} textAnchor="middle" className="donut-sub">
        {total === 1 ? 'task' : 'tasks'}
      </text>
    </svg>
  );
}

/** Bar chart of tasks completed per day, with a y-axis and gridlines. */
export function TrendChart({ days, counts }: { days: string[]; counts: number[] }) {
  const n = days.length;
  const max = Math.max(2, ...counts);
  const tickStep = Math.max(1, Math.ceil(max / 4));
  const top = Math.ceil(max / tickStep) * tickStep;
  const [W, H, L, R, T, B] = [600, 220, 30, 8, 10, 30];
  const plotW = W - L - R;
  const plotH = H - T - B;
  const slot = plotW / n;
  const barW = Math.min(26, slot * 0.58);
  const labelEvery = n <= 14 ? 1 : n <= 21 ? 2 : 3;
  const total = counts.reduce((a, b) => a + b, 0);
  const shortDate = (iso: string) =>
    fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += tickStep) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="trend"
      role="img"
      aria-label={`${total} task${total === 1 ? '' : 's'} completed in the last ${n} days`}
    >
      {ticks.map((v) => {
        const y = T + plotH - (v / top) * plotH;
        return (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y} y2={y} className="grid" />
            <text x={L - 8} y={y + 3.5} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        );
      })}
      {counts.map((c, i) => {
        const h = Math.max((c / top) * plotH, 3);
        const x = L + i * slot + (slot - barW) / 2;
        return (
          <g key={days[i]}>
            <rect
              x={x}
              y={T + plotH - h}
              width={barW}
              height={h}
              rx={3}
              className={`bar-col${c ? '' : ' zero'}`}
            >
              <title>{`${c} completed · ${fmtDate(days[i])}`}</title>
            </rect>
            {(n - 1 - i) % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="axis">
                {shortDate(days[i])}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
