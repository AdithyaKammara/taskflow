/** Hand-built SVG charts (no chart library). */
import { useId, useState } from 'react';
import { STATUSES } from '../../lib/config';
import type { StatusId } from '../../lib/types';
import { fmtDate, fromISO } from '../../lib/utils/dates';

/** Ring of task counts per status. */
export function DonutChart({ counts, total }: { counts: Record<StatusId, number>; total: number }) {
  const R = 46;
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
      role="img"
      aria-label={
        'Status breakdown: ' + STATUSES.map((s) => `${counts[s.id]} ${s.label}`).join(', ')
      }
    >
      <circle cx={60} cy={60} r={R} className="track" />
      {segs.map(({ id, len }, i) => (
        <circle
          key={id}
          cx={60}
          cy={60}
          r={R}
          className={`seg st-${id}`}
          transform="rotate(-90 60 60)"
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-starts[i]}
        />
      ))}
      <text x={60} y={62} textAnchor="middle" className="total">
        {total}
      </text>
      <text x={60} y={78} textAnchor="middle" className="unit">
        {total === 1 ? 'task' : 'tasks'}
      </text>
    </svg>
  );
}

/** Tasks completed per day as an area line, with a tooltip for the day under the pointer. */
export function TrendChart({ days, counts }: { days: string[]; counts: number[] }) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const max = Math.max(2, ...counts);
  const tickStep = Math.max(1, Math.ceil(max / 4));
  const top = Math.ceil(max / tickStep) * tickStep;
  const [W, H, L, R, T, B] = [640, 240, 30, 12, 14, 30];
  const plotW = W - L - R;
  const plotH = H - T - B;
  const x = (i: number) => L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : 5;
  const total = counts.reduce((a, b) => a + b, 0);
  const label = (iso: string) =>
    n <= 7
      ? fromISO(iso).toLocaleDateString('en-GB', { weekday: 'short' })
      : fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += tickStep) ticks.push(v);
  const line = counts.map((c, i) => `${i ? 'L' : 'M'}${x(i)},${y(c)}`).join(' ');
  const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const slot = plotW / Math.max(1, n - 1);

  return (
    <div className="db-chart" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${total} task${total === 1 ? '' : 's'} completed in the last ${n} days`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={L - 10} y={y(v) + 4} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradient})`} />
        <path d={line} className="line" />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + plotH} className="guide" />
        )}
        {counts.map((c, i) => (
          <circle
            key={days[i]}
            cx={x(i)}
            cy={y(c)}
            r={hover === i ? 5 : 3.5}
            className={`point${hover === i ? ' on' : ''}`}
          />
        ))}
        {days.map((d, i) =>
          (n - 1 - i) % labelEvery === 0 ? (
            <text key={d} x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {label(d)}
            </text>
          ) : null
        )}
        {/* invisible hover strips, one per day */}
        {days.map((d, i) => (
          <rect
            key={`hit-${d}`}
            x={x(i) - slot / 2}
            y={T}
            width={slot}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="db-tip"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(counts[hover]) / H) * 100}%` }}
        >
          <div>{fmtDate(days[hover])}</div>
          <strong>{counts[hover]}</strong>
          {counts[hover] === 1 ? 'task completed' : 'tasks completed'}
        </div>
      )}
      <p className="db-legend">
        <i aria-hidden="true" />
        Tasks completed
      </p>
    </div>
  );
}
