/**
 * Kanban board: one column per status.
 *
 * Dragging is built on pointer events rather than HTML drag-and-drop, so the gesture can be shaped:
 * the card lifts out into a tilted overlay that follows the pointer, the gap it left closes, a gap
 * opens where it will land, and the other cards slide (FLIP) instead of jumping. Cards are sorted by
 * due date, so the gap opens at the card's real landing spot, not under the pointer.
 *
 * Mouse: press and move. Touch: press and hold, then move (a quick swipe still scrolls).
 * Keyboard: Space picks a card up, ←/→ carry it between columns, Space drops, Escape puts it back,
 * Enter opens it, and the arrow keys move between cards. Every move is announced.
 */
import { Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { quickAdd, setStatus } from '../../app/actions';
import { openDrawer } from '../../app/store';
import { useView } from '../../app/useView';
import { Filters } from '../../components/layout/Toolbar';
import { STATUSES, STATUS_IDS } from '../../lib/config';
import { statusLabel } from '../../lib/model/meta';
import { parseQuickAdd } from '../../lib/model/parser';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { StatusId, Task } from '../../lib/types';
import { CardFace } from './BoardCard';

interface Drag {
  id: string;
  from: StatusId;
  w: number;
  h: number;
  /** Where in the card the pointer took hold. */
  dx: number;
  dy: number;
}

interface Press {
  id: string;
  from: StatusId;
  x: number;
  y: number;
  rect: DOMRect;
  touch: boolean;
  timer: number;
}

const HOLD_MS = 260; // touch: how long to hold before the card lifts
const LIFT = 'scale(1.03) rotate(1.6deg)';
const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * FLIP: after each layout change, every [data-flip] element that moved is animated from where it
 * was to where it is. Positions are kept relative to the board (plus its horizontal scroll), so
 * scrolling the page or the board never reads as movement.
 */
function useFlip(root: RefObject<HTMLElement | null>, layoutKey: string) {
  const prev = useRef(new Map<string, { x: number; y: number }>());
  useEffect(() => {
    const reset = () => prev.current.clear();
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const animate = !reducedMotion();
    const next = new Map<string, { x: number; y: number }>();
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((node) => {
      const r = node.getBoundingClientRect();
      const pos = { x: r.left - base.left + el.scrollLeft, y: r.top - base.top };
      const old = prev.current.get(node.dataset.flip!);
      const dx = old ? old.x - pos.x : 0;
      const dy = old ? old.y - pos.y : 0;
      if (animate && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 320,
          easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
        });
      }
      next.set(node.dataset.flip!, pos);
    });
    prev.current = next;
  }, [root, layoutKey]);
}

/** Whether the board has columns hidden past its left or right edge, for the fades and the rail. */
function useEdges(board: RefObject<HTMLElement | null>) {
  const [g, setG] = useState({ start: true, end: true, ratio: 1, offset: 0 });
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setG({
        start: el.scrollLeft < 8,
        end: el.scrollLeft >= max - 8,
        ratio: el.clientWidth / el.scrollWidth,
        offset: max > 0 ? el.scrollLeft / max : 0,
      });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    [...el.children].forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [board]);
  return g;
}

/**
 * The board's own scrollbar: always shown while there is more board to see (overlay scrollbars
 * stay hidden until you scroll, which is too late), and draggable. Mouse only; touch swipes.
 */
function ScrollRail({
  ratio,
  offset,
  onSeek,
}: {
  ratio: number;
  offset: number;
  /** Scroll the board to this fraction of the way along (0 to 1). */
  onSeek: (fraction: number) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const scrollTo = (clientX: number) => {
    const r = rail.current!.getBoundingClientRect();
    const thumb = r.width * ratio;
    onSeek(Math.max(0, Math.min(1, (clientX - r.left - thumb / 2) / (r.width - thumb))));
  };
  if (ratio >= 0.999) return null;
  return (
    <div
      ref={rail}
      aria-hidden="true"
      className={`kb-rail${held ? ' held' : ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
        scrollTo(e.clientX);
      }}
      onPointerMove={(e) => held && scrollTo(e.clientX)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
    >
      <div style={{ width: `${ratio * 100}%`, marginLeft: `${offset * (100 - ratio * 100)}%` }} />
    </div>
  );
}

/** "Add task" at the foot of a column: a quick-add field (same syntax) that files into this column. */
function ColumnAdd({ status }: { status: StatusId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const label = statusLabel(status);
  if (!open) {
    return (
      <button type="button" className="kb-add" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" size={14} />
        Add task
        <span className="sr-only">{` to ${label}`}</span>
      </button>
    );
  }
  const close = () => {
    setOpen(false);
    setText('');
    setError('');
  };
  return (
    <form
      className="kb-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        const err = quickAdd(parseQuickAdd(text), status);
        setError(err);
        if (!err) setText('');
      }}
    >
      <input
        autoFocus // opened by the button just pressed
        className="field"
        value={text}
        aria-label={`New task in ${label}`}
        aria-invalid={!!error}
        aria-describedby={error ? `add-err-${status}` : undefined}
        placeholder="Title, tomorrow, @name, #tag"
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
        <p className="kb-add-error" id={`add-err-${status}`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function BoardView() {
  const view = useView();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<StatusId | null>(null);
  const [grab, setGrab] = useState<{ id: string; origin: StatusId; at: StatusId } | null>(null);
  const [say, setSay] = useState('');

  const board = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const cols = useRef(new Map<StatusId, HTMLElement>());
  const pressRef = useRef<Press | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const targetRef = useRef<StatusId | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const settling = useRef(false);
  const skipClick = useRef(false);
  const unlisten = useRef<() => void>(() => {});

  // the card being carried is shown in the column it would land in
  const carriedId = drag?.id ?? grab?.id;
  const carriedTo = drag ? target : grab?.at;
  const tasks = filteredTasks(view.doc, view)
    .map((t) => (t.id === carriedId && carriedTo ? { ...t, status: carriedTo } : t))
    .sort(SORTS.due);
  const byCol = STATUSES.map((s) => ({ ...s, tasks: tasks.filter((t) => t.status === s.id) }));
  const title = (id: string) => view.doc.tasks.find((t) => t.id === id)?.title ?? '';

  useFlip(board, byCol.map((c) => c.tasks.map((t) => t.id).join()).join('|') + (drag ? '+' : ''));
  const edges = useEdges(board);
  useEffect(() => () => unlisten.current(), []);

  // ---------- pointer drag ----------

  const placeOverlay = () => {
    const d = dragRef.current;
    if (d && overlay.current) {
      overlay.current.style.transform = `translate(${pointer.current.x - d.dx}px, ${pointer.current.y - d.dy}px)`;
    }
  };

  const aim = (x: number) => {
    let inside: StatusId | null = null;
    let nearest: StatusId | null = null;
    let best = Infinity;
    cols.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right) inside = id;
      const dist = Math.abs(x - (r.left + r.width / 2));
      if (dist < best) [best, nearest] = [dist, id];
    });
    const next = inside ?? nearest;
    if (next && next !== targetRef.current) {
      targetRef.current = next;
      setTarget(next);
    }
  };

  /** Each frame while carrying: scroll the board or the page when the pointer nears an edge. */
  const tick = () => {
    if (!dragRef.current) return;
    const { x, y } = pointer.current;
    const b = board.current!;
    const r = b.getBoundingClientRect();
    const edge = 64;
    const vx = x < r.left + edge ? -14 : x > r.right - edge ? 14 : 0;
    const vy = y < 72 ? -12 : y > window.innerHeight - 72 ? 12 : 0;
    if (vx && b.scrollWidth > b.clientWidth) b.scrollLeft += vx;
    if (vy) window.scrollBy(0, vy);
    if (vx || vy) aim(x);
    requestAnimationFrame(tick);
  };

  const begin = () => {
    const p = pressRef.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    const d: Drag = {
      id: p.id,
      from: p.from,
      w: p.rect.width,
      h: p.rect.height,
      dx: p.x - p.rect.left,
      dy: p.y - p.rect.top,
    };
    dragRef.current = d;
    targetRef.current = p.from;
    setDrag(d);
    setTarget(p.from);
    setGrab(null);
    if (p.touch) navigator.vibrate?.(8);
    setSay(`Picked up ${title(p.id)}.`);
    requestAnimationFrame(tick);
  };

  const finish = () => {
    const d = dragRef.current;
    const to = targetRef.current;
    if (d && to && to !== d.from) {
      setStatus(d.id, to);
      setSay(`Moved ${title(d.id)} to ${statusLabel(to)}.`);
    } else if (d) {
      setSay(`${title(d.id)} stays in ${statusLabel(d.from)}.`);
    }
    dragRef.current = null;
    targetRef.current = null;
    settling.current = false;
    setDrag(null);
    setTarget(null);
  };

  /** Fly the overlay into the gap, settle it flat, then drop the card in for real. */
  const drop = () => {
    const card = overlay.current;
    const gap = board.current?.querySelector<HTMLElement>('[data-gap]');
    if (!card || !gap || reducedMotion()) return finish();
    settling.current = true;
    const r = gap.getBoundingClientRect();
    const fly = card.animate(
      [{ transform: card.style.transform }, { transform: `translate(${r.left}px, ${r.top}px)` }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', fill: 'forwards' }
    );
    card.firstElementChild?.animate([{ transform: LIFT }, { transform: 'none' }], {
      duration: 220,
      easing: 'ease-out',
      fill: 'forwards',
    });
    fly.onfinish = finish;
  };

  /** Put the card back: aim at its own column, then settle into the gap that opens there. */
  const cancel = () => {
    const d = dragRef.current;
    if (!d) return;
    targetRef.current = d.from;
    setTarget(d.from);
    requestAnimationFrame(() => requestAnimationFrame(drop));
  };

  const release = () => {
    const p = pressRef.current;
    if (p) window.clearTimeout(p.timer);
    pressRef.current = null;
    unlisten.current();
    unlisten.current = () => {};
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, t: Task) => {
    if (e.button !== 0 || dragRef.current || settling.current || grab) return;
    const p: Press = {
      id: t.id,
      from: t.status,
      x: e.clientX,
      y: e.clientY,
      rect: e.currentTarget.getBoundingClientRect(),
      touch: e.pointerType !== 'mouse',
      timer: 0,
    };
    pressRef.current = p;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (p.touch) p.timer = window.setTimeout(begin, HOLD_MS);

    const move = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY };
      if (!dragRef.current) {
        const dist = Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
        if (p.touch && dist > 8)
          release(); // a swipe: let the page scroll
        else if (!p.touch && dist > 4) begin();
        if (!dragRef.current) return;
      }
      placeOverlay();
      aim(ev.clientX);
    };
    const up = () => {
      if (dragRef.current) {
        skipClick.current = true;
        setTimeout(() => (skipClick.current = false));
        drop();
      }
      release();
    };
    const lost = () => {
      if (dragRef.current) cancel();
      release();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && dragRef.current) {
        ev.preventDefault();
        ev.stopPropagation();
        lost();
      }
    };
    // once a touch drag has begun, the finger moves the card, not the page
    const noScroll = (ev: TouchEvent) => dragRef.current && ev.cancelable && ev.preventDefault();
    const noMenu = (ev: Event) => p.touch && ev.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', lost);
    window.addEventListener('keydown', key, true);
    window.addEventListener('touchmove', noScroll, { passive: false });
    window.addEventListener('contextmenu', noMenu);
    unlisten.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', lost);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('touchmove', noScroll);
      window.removeEventListener('contextmenu', noMenu);
    };
  };

  // the lifted card appears under the pointer and tilts up off the board
  const dragId = drag?.id;
  useLayoutEffect(() => {
    const el = overlay.current;
    if (!dragId || !el) return;
    placeOverlay();
    if (!reducedMotion()) {
      el.firstElementChild?.animate([{ transform: 'none' }, { transform: LIFT }], {
        duration: 280,
        easing: SPRING,
        fill: 'forwards',
      });
    }
  }, [dragId]);

  // ---------- keyboard ----------

  // a keyboard move re-mounts the card in another column: keep focus on it
  useLayoutEffect(() => {
    if (!grab) return;
    const el = board.current?.querySelector<HTMLElement>(`[data-card="${grab.id}"]`);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [grab]);

  // clicking anywhere else while carrying by keyboard puts the card back
  useEffect(() => {
    if (!grab) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(`[data-card="${grab.id}"]`)) setGrab(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [grab]);

  /** Arrow keys between cards: up/down in a column, left/right to the same row next door. */
  const moveFocus = (from: HTMLElement, key: string) => {
    const colEls = [...cols.current.values()];
    const cards = (c: Element) => [...c.querySelectorAll<HTMLElement>('[data-card]')];
    const col = from.closest('section')!;
    const list = cards(col);
    const i = list.indexOf(from);
    if (key === 'ArrowUp') list[i - 1]?.focus();
    else if (key === 'ArrowDown') list[i + 1]?.focus();
    else {
      let c = colEls.indexOf(col);
      const step = key === 'ArrowLeft' ? -1 : 1;
      // skip empty columns
      for (c += step; c >= 0 && c < colEls.length; c += step) {
        const next = cards(colEls[c]);
        if (next.length) return next[Math.min(i, next.length - 1)].focus();
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>, t: Task) => {
    if (drag) return;
    const k = e.key;
    if (grab?.id === t.id) {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (grab.at !== grab.origin) setStatus(t.id, grab.at);
        setSay(`Dropped ${t.title} in ${statusLabel(grab.at)}.`);
        setGrab(null);
      } else if (k === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSay(`Cancelled. ${t.title} is back in ${statusLabel(grab.origin)}.`);
        setGrab(null);
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        const at = STATUS_IDS[STATUS_IDS.indexOf(grab.at) + (k === 'ArrowLeft' ? -1 : 1)];
        if (!at) return;
        setGrab({ ...grab, at });
        setSay(`${t.title}: ${statusLabel(at)}. Space to drop, Escape to cancel.`);
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
      }
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      setGrab({ id: t.id, origin: t.status, at: t.status });
      setSay(`Picked up ${t.title}. Left and right arrows move it between columns.`);
    } else if (k === 'Enter') {
      e.preventDefault();
      openDrawer(t.id);
    } else if (k.startsWith('Arrow')) {
      e.preventDefault();
      moveFocus(e.currentTarget, k);
    }
  };

  // ---------- render ----------

  const carried = drag && view.doc.tasks.find((t) => t.id === drag.id);
  const fade = '28px';
  const mask =
    edges.start && edges.end
      ? undefined
      : `linear-gradient(to right, transparent, #000 ${edges.start ? '0px' : fade}, #000 calc(100% - ${edges.end ? '0px' : fade}), transparent)`;

  return (
    <>
      <Filters />
      <p id="kb-help" className="sr-only">
        Space to pick up and move between columns with the arrow keys. Enter opens the task.
      </p>
      <div
        ref={board}
        className={`kb-board${drag ? ' is-dragging' : ''}`}
        role="group"
        aria-label="Board"
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        {byCol.map((col) => (
          <section
            key={col.id}
            ref={(el) => {
              if (el) cols.current.set(col.id, el);
              else cols.current.delete(col.id);
            }}
            className={`kb-col${drag && target === col.id ? ' is-target' : ''}`}
            aria-labelledby={`col-${col.id}`}
          >
            <h2 className="kb-col-head" id={`col-${col.id}`}>
              <i aria-hidden="true" className={`kb-col-dot st-${col.id}`} />
              {col.label}
              <span key={col.tasks.length} className="kb-count">
                {col.tasks.length}
                <span className="sr-only"> tasks</span>
              </span>
            </h2>

            <ul className="kb-list">
              {col.tasks.map((t) =>
                t.id === drag?.id ? (
                  <li
                    key={`gap-${col.id}`}
                    data-gap
                    aria-hidden="true"
                    className="kb-gap"
                    style={{ height: drag.h }}
                  />
                ) : (
                  <li key={t.id} data-flip={t.id}>
                    <div
                      data-card={t.id}
                      role="button"
                      tabIndex={0}
                      aria-roledescription="draggable task"
                      aria-describedby="kb-help"
                      className={`kb-card${t.status === 'done' ? ' is-done' : ''}${grab?.id === t.id ? ' is-grabbed' : ''}`}
                      onPointerDown={(e) => onPointerDown(e, t)}
                      onClick={() => !skipClick.current && !grab && openDrawer(t.id)}
                      onKeyDown={(e) => onKeyDown(e, t)}
                      onBlur={(e) => {
                        if (grab?.id === t.id && e.relatedTarget) setGrab(null);
                      }}
                    >
                      <CardFace t={t} project={projectOf(view.doc, t)} />
                    </div>
                  </li>
                )
              )}
              {col.tasks.length === 0 && <li className="kb-empty">No tasks</li>}
            </ul>

            <ColumnAdd status={col.id} />
          </section>
        ))}
      </div>
      <ScrollRail
        ratio={edges.ratio}
        offset={edges.offset}
        onSeek={(f) => {
          const b = board.current!;
          b.scrollLeft = f * (b.scrollWidth - b.clientWidth);
        }}
      />

      {drag && carried && (
        <div ref={overlay} className="kb-float" style={{ width: drag.w }} aria-hidden="true">
          <div className={`kb-card is-floating${carried.status === 'done' ? ' is-done' : ''}`}>
            <CardFace t={carried} project={projectOf(view.doc, carried)} />
          </div>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {say}
      </p>
    </>
  );
}
