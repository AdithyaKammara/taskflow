/**
 * The task detail panel (a right-hand <dialog>): fields, subtasks, comments and activity log.
 * Text fields save when they lose focus (or on Enter), like v6's change events, so each edit is one
 * undo step and one activity-log entry. They are keyed on the saved value, so undo, redo or a change
 * from another tab shows up in them.
 */
import { X } from 'lucide-react';
import type { KeyboardEvent, SubmitEvent } from 'react';
import { addComment, addSubtask, deleteTask, editTask, setStatus } from '../../app/actions';
import { closeDrawer, useApp } from '../../app/store';
import { MAX_DESC, MAX_TITLE, PRIORITIES, STATUSES } from '../../lib/config';
import { member, nameOf } from '../../lib/model/meta';
import { cleanTags } from '../../lib/model/sanitize';
import type { Priority, StatusId, Task } from '../../lib/types';
import { ago, fmtDate, isValidISO } from '../../lib/utils/dates';
import { cap, clean, truncate } from '../../lib/utils/text';
import { Avatar, Bar, Icon, Modal } from '../../components/shared';

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur();
};

/** Submit handler for the one-field subtask and comment forms: hands over the text, then clears it. */
const inlineSubmit = (fn: (text: string) => void) => (e: SubmitEvent<HTMLFormElement>) => {
  e.preventDefault();
  const input = e.currentTarget.elements.namedItem('text') as HTMLInputElement;
  fn(input.value);
  input.value = '';
  input.focus();
};

function Subtasks({ t }: { t: Task }) {
  const n = t.subtasks.length;
  const done = t.subtasks.filter((s) => s.done).length;
  return (
    <section className="dsec">
      <h3>
        Subtasks<span className="count">{n ? `${done}/${n}` : '0'}</span>
      </h3>
      {n > 0 && <Bar pct={Math.round((done / n) * 100)} />}
      {n > 0 && (
        <ul className="sub-list">
          {t.subtasks.map((s) => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <label className="sub-item">
                <input
                  type="checkbox"
                  className="check"
                  checked={s.done}
                  onChange={(e) =>
                    editTask(
                      t.id,
                      (x) => {
                        x.subtasks.find((y) => y.id === s.id)!.done = e.target.checked;
                      },
                      `Subtask ${e.target.checked ? 'completed' : 'reopened'}: ${truncate(s.text, 40)}`
                    )
                  }
                />
                <span>{s.text}</span>
              </label>
              <button
                type="button"
                className="icon-btn sm"
                aria-label={`Delete subtask "${s.text}"`}
                onClick={() =>
                  editTask(
                    t.id,
                    (x) => {
                      x.subtasks = x.subtasks.filter((y) => y.id !== s.id);
                    },
                    `Subtask removed: ${truncate(s.text, 40)}`
                  )
                }
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="inline-form" onSubmit={inlineSubmit((text) => addSubtask(t.id, text))}>
        <input
          className="field"
          name="text"
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="Add a subtask"
          aria-label="New subtask"
        />
        <button className="btn" type="submit">
          Add
        </button>
      </form>
    </section>
  );
}

function Comments({ t }: { t: Task }) {
  return (
    <section className="dsec">
      <h3>
        Comments<span className="count">{t.comments.length}</span>
      </h3>
      {t.comments.length > 0 && (
        <ul className="comments">
          {t.comments.map((c) => {
            const m = member(c.author) || { id: '', name: 'Former member' };
            return (
              <li key={c.id}>
                <Avatar id={m.id} />
                <div>
                  <p className="c-head">
                    <strong>{m.name}</strong>
                    <span className="muted">{` · ${ago(c.at)}`}</span>
                  </p>
                  <p className="c-text">{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="inline-form" onSubmit={inlineSubmit((text) => addComment(t.id, text))}>
        <input
          className="field"
          name="text"
          type="text"
          maxLength={500}
          autoComplete="off"
          placeholder="Write a comment…"
          aria-label="New comment"
        />
        <button className="btn btn-primary" type="submit">
          Post
        </button>
      </form>
    </section>
  );
}

function Activity({ t }: { t: Task }) {
  return (
    <section className="dsec">
      <h3>Activity</h3>
      <ul className="log">
        {t.log
          .slice()
          .reverse()
          .slice(0, 15)
          .map((l, i) => (
            <li key={`${l.at}-${i}`}>
              <span>{l.text}</span>
              <span>{ago(l.at)}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

function DrawerBody({ t }: { t: Task }) {
  const projects = useApp((s) => s.doc.projects);
  const team = useApp((s) => s.team);
  const tagText = t.tags.map((g) => '#' + g).join(' ');

  return (
    <div className="drawer-inner">
      <header className="drawer-head">
        <span className="muted">{`Created ${ago(t.createdAt)}`}</span>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={closeDrawer}>
          <Icon icon={X} />
        </button>
      </header>
      <div className="drawer-body">
        <input
          key={`title:${t.title}`}
          className="d-title"
          defaultValue={t.title}
          maxLength={MAX_TITLE}
          aria-label="Task title"
          onKeyDown={blurOnEnter}
          onBlur={(e) => {
            const title = clean(e.target.value, MAX_TITLE);
            if (title && title !== t.title)
              editTask(t.id, (x) => (x.title = title), 'Title edited');
            else e.target.value = t.title;
          }}
        />
        <div className="props">
          <label className="prop">
            <span className="prop-label">Status</span>
            <select
              className="field"
              value={t.status}
              onChange={(e) => setStatus(t.id, e.target.value as StatusId)}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="prop">
            <span className="prop-label">Priority</span>
            <select
              className="field"
              value={t.priority}
              onChange={(e) => {
                const v = e.target.value as Priority;
                if (PRIORITIES.includes(v) && v !== t.priority) {
                  editTask(
                    t.id,
                    (x) => (x.priority = v),
                    `Priority changed: ${cap(t.priority)} → ${cap(v)}`
                  );
                }
              }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {cap(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="prop">
            <span className="prop-label">Assignee</span>
            <select
              className="field"
              value={t.assignee}
              onChange={(e) => {
                const to = member(e.target.value) ? e.target.value : '';
                if (to === t.assignee) return;
                editTask(
                  t.id,
                  (x) => (x.assignee = to),
                  `Assignee changed: ${nameOf(t.assignee)} → ${nameOf(to)}`
                );
              }}
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="prop">
            <span className="prop-label">Project</span>
            <select
              className="field"
              value={t.project}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                if (p && p.id !== t.project) {
                  editTask(t.id, (x) => (x.project = p.id), `Moved to project ${p.name}`);
                }
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="prop">
            <span className="prop-label">Due date</span>
            <input
              className="field"
              type="date"
              value={t.due}
              onChange={(e) => {
                const due = isValidISO(e.target.value) ? e.target.value : '';
                if (due === t.due) return;
                editTask(
                  t.id,
                  (x) => (x.due = due),
                  due ? `Due date set to ${fmtDate(due)}` : 'Due date cleared'
                );
              }}
            />
          </label>
          <label className="prop">
            <span className="prop-label">Tags</span>
            <input
              key={`tags:${tagText}`}
              className="field"
              type="text"
              defaultValue={tagText}
              placeholder="#design #q4"
              onKeyDown={blurOnEnter}
              onBlur={(e) => {
                const tags = cleanTags(e.target.value.split(/[\s,]+/));
                if (tags.join() !== t.tags.join())
                  editTask(t.id, (x) => (x.tags = tags), 'Tags updated');
                else e.target.value = tagText;
              }}
            />
          </label>
        </div>
        <label className="prop prop-block">
          <span className="prop-label">Description</span>
          <textarea
            key={`desc:${t.description}`}
            className="field"
            rows={4}
            maxLength={MAX_DESC}
            placeholder="Add context, links or acceptance criteria…"
            defaultValue={t.description}
            onBlur={(e) => {
              const v = e.target.value.slice(0, MAX_DESC);
              if (v !== t.description) {
                editTask(t.id, (x) => (x.description = v), 'Description updated');
              }
            }}
          />
        </label>
        <Subtasks t={t} />
        <Comments t={t} />
        <Activity t={t} />
      </div>
      <footer className="drawer-foot">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            closeDrawer();
            deleteTask(t.id);
          }}
        >
          Delete task
        </button>
      </footer>
    </div>
  );
}

export function TaskDrawer() {
  const t = useApp((s) => s.doc.tasks.find((x) => x.id === s.drawerId));
  return (
    <Modal open={!!t} onClose={closeDrawer} className="drawer" aria-label="Task details">
      {t && <DrawerBody t={t} />}
    </Modal>
  );
}
