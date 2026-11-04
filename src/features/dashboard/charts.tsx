/** Hand-built SVG charts (no chart library). */
import { useId, useState } from 'react';
import { STATUSES } from '../../lib/config';
import type { StatusId } from '../../lib/types';
import { fmtDate, fromISO } from '../../lib/utils/dates';

/** Polar point on the donut, angle in radians from 12 o'clock, clockwise. */
const polar = (r: number, a: number): [number, number] => [
  60 + r * Math.sin(a),
  60 - r * Math.cos(a),
];

/**
 * One rounded ring segment from angle a0 to a1. The shape is drawn inset by half the corner
 * stroke, then stroked in its own colour with round joins, which rounds the corners.
 */
function segmentPath(a0: number, a1: number, ro: number, ri: number) {
  const [x0, y0] = polar(ro, a0);
  const [x1, y1] = polar(ro, a1);
  const [x2, y2] = polar(ri, a1);
  const [x3, y3] = polar(ri, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${ro} ${ro} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${large} 0 ${x3} ${y3}Z`;
}

const RING = { outer: 56, inner: 37, corner: 4, gap: 0.06 };

/**
 * Ring of task counts per status, with the completion rate in the middle. `active` / `onActive`
 * link a segment to its legend row, so hovering either highlights both.
 */
export function DonutChart({
  counts,
  total,
  active,
  onActive,
}: {
  counts: Record<StatusId, number>;
  total: number;
  active: StatusId | null;
  onActive: (id: StatusId | null) => void;
}) {
  const done = total ? Math.round((counts.done / total) * 100) : 0;
  const present = STATUSES.filter((s) => counts[s.id]);
  const half = RING.corner / 2;
  const ro = RING.outer - half;
  const ri = RING.inner + half;
  const gap = present.length > 1 ? RING.gap : 0;
  const sweeps = present.map((s) => (counts[s.id] / total) * 2 * Math.PI);
  const segs = present.map((s, i) => {
    const start = sweeps.slice(0, i).reduce((x, y) => x + y, 0);
    const a0 = start + gap / 2 + half / ro;
    const a1 = start + sweeps[i] - gap / 2 - half / ro;
    return { ...s, a0, a1 };
  });
  const tip = segs.find((x) => x.id === active);
  // the tooltip follows the pointer up and down but stays over the ring, clear of the legend
  const [pointerY, setPointerY] = useState(0);

  return (
    <div
      className="db-ring"
      onMouseLeave={() => onActive(null)}
      onMouseMove={(e) => setPointerY(e.clientY - e.currentTarget.getBoundingClientRect().top)}
    >
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Status breakdown: ${done}% completed. ${STATUSES.map((s) => `${counts[s.id]} ${s.label}`).join(', ')}`}
      >
        {present.length === 0 && (
          <circle cx={60} cy={60} r={(RING.outer + RING.inner) / 2} className="track" />
        )}
        {present.length === 1 ? (
          <circle
            cx={60}
            cy={60}
            r={(RING.outer + RING.inner) / 2}
            className={`seg ring st-${present[0].id}`}
            onMouseEnter={() => onActive(present[0].id)}
          />
        ) : (
          segs.map((x) => (
            <path
              key={x.id}
              d={segmentPath(x.a0, Math.max(x.a1, x.a0 + 0.001), ro, ri)}
              className={`seg st-${x.id}${active === x.id ? ' on' : ''}${active && active !== x.id ? ' dim' : ''}`}
              onMouseEnter={() => onActive(x.id)}
            />
          ))
        )}
        <text x={60} y={60} textAnchor="middle" dominantBaseline="middle" className="total">
          {done}%
        </text>
        <text x={60} y={75} textAnchor="middle" className="unit">
          Completed
        </text>
      </svg>
      {tip && (
        <div className="db-tip db-ring-tip" style={{ top: pointerY }}>
          <span className={`swatch st-${tip.id}`} aria-hidden="true" />
          <span>{tip.label}</span>
          <strong>{counts[tip.id].toLocaleString()}</strong>
        </div>
      )}
    </div>
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
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
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
