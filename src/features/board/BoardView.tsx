/** Kanban board: one column per status, drag-and-drop with the mouse, a status dropdown on every card. */
import { useEffect, useRef, useState } from 'react';
import { setStatus } from '../../app/actions';
import { openDrawer } from '../../app/store';
import { useView } from '../../app/useView';
import { STATUSES } from '../../lib/config';
import { SORTS, filteredTasks, projectOf } from '../../lib/model/selectors';
import type { Doc, StatusId, Task } from '../../lib/types';
import { Filters, PageHead } from '../../components/layout/PageHead';
import { Avatar, Bar, DueBadge, PriorityBadge, ProjectChip } from '../../components/shared';
import { StatusSelect } from '../tasks/StatusSelect';

interface CardProps {
  t: Task;
  doc: Doc;
  dragging: boolean;
  onDrag: (id: string | null) => void;
}

function BoardCard({ t, doc, dragging, onDrag }: CardProps) {
  const n = t.subtasks.length;
  const d = t.subtasks.filter((s) => s.done).length;
  return (
    <li
      className={`card task-card${t.status === 'done' ? ' is-done' : ''}${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', t.id);
        onDrag(t.id);
      }}
      onDragEnd={() => onDrag(null)}
    >
      <div className="meta">
        <ProjectChip project={projectOf(doc, t)} />
      </div>
      <button type="button" className="title-btn" onClick={() => openDrawer(t.id)}>
        {t.title}
      </button>
      {t.tags.length > 0 && (
        <div className="meta">
          {t.tags.map((g) => (
            <span key={g} className="tag">{`#${g}`}</span>
          ))}
        </div>
      )}
      {n > 0 && (
        <div className="sub-line">
          <Bar pct={Math.round((d / n) * 100)} />
          <span className="muted">{`${d}/${n}`}</span>
        </div>
      )}
      <div className="card-foot">
        <PriorityBadge task={t} />
        <DueBadge task={t} />
        <span className="spacer" />
        <Avatar id={t.assignee} />
      </div>
      <StatusSelect task={t} label={`Move "${t.title}" to`} />
    </li>
  );
}

const INTERACTIVE = '.task-card, button, select, input, textarea, a';

/** Lets mouse users pan the board sideways by dragging its background (touch users just swipe). */
function usePanning(board: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const b = board.current;
    if (!b) return;
    let startX = 0;
    let startLeft = 0;
    let panning = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if ((e.target as Element).closest(INTERACTIVE) || b.scrollWidth <= b.clientWidth) return;
      panning = true;
      startX = e.clientX;
      startLeft = b.scrollLeft;
      b.classList.add('panning');
    };
    const move = (e: PointerEvent) => {
      if (panning) b.scrollLeft = startLeft - (e.clientX - startX);
    };
    const stop = () => {
      panning = false;
      b.classList.remove('panning');
    };
    b.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      b.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [board]);
}

export function BoardView() {
  const view = useView();
  const tasks = filteredTasks(view.doc, view).sort(SORTS.due);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<StatusId | null>(null);
  const board = useRef<HTMLDivElement>(null);
  usePanning(board);
  // the dragged card's id, readable at once by the drop handlers; the state only styles the card
  const dragging = useRef<string | null>(null);
  const drag = (id: string | null) => {
    dragging.current = id;
    setDragId(id);
    if (!id) setOver(null);
  };

  return (
    <>
      <PageHead title="Board" />
      <Filters />
      <div className="board" ref={board}>
        {STATUSES.map((s) => {
          const col = tasks.filter((t) => t.status === s.id);
          return (
            <section
              key={s.id}
              className={`column dropzone${over === s.id ? ' drag-over' : ''}`}
              aria-labelledby={`col-${s.id}`}
              onDragOver={(e) => {
                if (!dragging.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOver(s.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                const id = dragging.current;
                if (!id) return;
                e.preventDefault();
                setStatus(id, s.id);
                drag(null);
              }}
            >
              <h2 className="col-title" id={`col-${s.id}`}>
                <i className={`status-dot st-${s.id}`} />
                {s.label}
                <span className="count">{col.length}</span>
              </h2>
              <ul className="cards">
                {col.length ? (
                  col.map((t) => (
                    <BoardCard
                      key={t.id}
                      t={t}
                      doc={view.doc}
                      dragging={dragId === t.id}
                      onDrag={drag}
                    />
                  ))
                ) : (
                  <li className="drop-hint">Drop tasks here</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
