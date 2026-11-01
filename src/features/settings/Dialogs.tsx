/** Modal dialogs: settings, keyboard help, "What next?" and new project (ported from v6 ui/dialogs.js). */
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  addProject,
  exportCSV,
  exportJSON,
  importJSON,
  replaceDoc,
  seedData,
} from '../../app/actions';
import {
  closeDialog,
  openDrawer,
  setDensity,
  toggleTheme,
  useApp,
  type DialogName,
} from '../../app/store';
import { PROJECT_COLORS } from '../../lib/config';
import { normalize } from '../../lib/model/sanitize';
import { rankNext } from '../../lib/model/selectors';
import { cap, clean } from '../../lib/utils/text';
import { Icon, Modal } from '../../components/shared';

function Dialog({
  name,
  title,
  closeLabel = 'Close',
  children,
}: {
  name: DialogName;
  title: string;
  closeLabel?: string;
  children: ReactNode;
}) {
  const open = useApp((s) => s.dialog === name);
  const id = `${name}Title`;
  return (
    <Modal open={open} onClose={closeDialog} className="modal" aria-labelledby={id}>
      <div className="dlg-inner">
        <div className="dlg-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" type="button" aria-label={closeLabel} onClick={closeDialog}>
            <Icon icon={X} />
          </button>
        </div>
        {children}
      </div>
    </Modal>
  );
}

/** "Reset all data" asks for a second click within 4 seconds. */
function ResetButton() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className="btn danger"
      type="button"
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        closeDialog();
        replaceDoc(normalize({}), 'All data cleared');
      }}
    >
      {armed ? 'Click again to confirm' : 'Reset all data'}
    </button>
  );
}

function SettingsDialog() {
  const density = useApp((s) => s.density);
  const file = useRef<HTMLInputElement>(null);
  return (
    <Dialog name="settings" title="Settings" closeLabel="Close settings">
      <div className="set-group">
        <p className="set-label">Appearance</p>
        <div className="set-row">
          <button className="btn" type="button" onClick={toggleTheme}>
            Toggle light / dark
          </button>
          <div className="seg" role="group" aria-label="Density">
            {(['comfortable', 'compact'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                onClick={() => setDensity(d)}
              >
                {cap(d)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="set-group">
        <p className="set-label">Data</p>
        <div className="set-row">
          <button className="btn" type="button" onClick={exportJSON}>
            Export JSON backup
          </button>
          <button className="btn" type="button" onClick={() => file.current?.click()}>
            Import JSON
          </button>
          <button className="btn" type="button" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
        <div className="set-row">
          <button
            className="btn"
            type="button"
            onClick={() => {
              closeDialog();
              seedData();
            }}
          >
            Add sample data
          </button>
          <ResetButton />
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f && (await importJSON(f))) closeDialog();
          }}
        />
      </div>
      <div className="set-group">
        <p className="set-label">Keyboard shortcuts</p>
        <p className="muted">
          <kbd>Ctrl</kbd> + <kbd>K</kbd> command palette · <kbd>N</kbd> new task · <kbd>/</kbd>{' '}
          filter · <kbd>F</kbd> focus timer · <kbd>?</kbd> all shortcuts
        </p>
      </div>
    </Dialog>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ['Command Palette', ['Ctrl', 'K']],
  ['Quick Add Task', ['N']],
  ['Filter / Search Tasks', ['/']],
  ['Start / Pause Focus Timer', ['F']],
  ['Undo Last Action', ['Ctrl', 'Z']],
  ['Redo Action', ['Ctrl', 'Shift', 'Z']],
  ['Show Shortcuts', ['?']],
  ['Close Panels / Dialogs', ['Esc']],
];

function HelpDialog() {
  return (
    <Dialog name="help" title="Keyboard Shortcuts" closeLabel="Close shortcuts">
      <div className="kbd-grid">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="kbd-row">
            <span>{label}</span>
            <span>
              {keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && ' + '}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function NextDialog() {
  const doc = useApp((s) => s.doc);
  const project = useApp((s) => s.project);
  const proj = doc.projects.find((p) => p.id === project);
  const top = rankNext(doc, { project });
  return (
    <Dialog name="next" title="What should I do next?">
      <p className="muted">
        {`Open tasks assigned to you or unassigned, ${proj ? 'in ' + proj.name : 'across all projects'}. Ranked by due date, priority, status and progress.`}
      </p>
      <ol className="next-list">
        {top.length ? (
          top.map((r, i) => (
            <li key={r.t.id} className="card next-item">
              <span className="next-rank">{i + 1}</span>
              <div>
                <strong>{r.t.title}</strong>
                <p className="muted">{cap(r.why.join(', ') || 'next in line')}</p>
              </div>
              <button type="button" className="btn" onClick={() => openDrawer(r.t.id)}>
                Open
              </button>
            </li>
          ))
        ) : (
          <li className="muted">Nothing open to suggest. Add a task or switch to All projects.</li>
        )}
      </ol>
    </Dialog>
  );
}

function ProjectDialog() {
  const [error, setError] = useState('');
  return (
    <Dialog name="project" title="New project">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const name = clean((form.elements.namedItem('name') as HTMLInputElement).value, 40);
          if (!name) {
            setError('Give the project a name.');
            (form.elements.namedItem('name') as HTMLInputElement).focus();
            return;
          }
          const color = (form.elements.namedItem('color') as RadioNodeList).value;
          setError('');
          closeDialog();
          addProject(name, color);
        }}
      >
        <label className="prop block">
          <span className="prop-label">Project name</span>
          <input
            className="field"
            name="name"
            type="text"
            maxLength={40}
            autoComplete="off"
            placeholder="e.g. Customer Portal"
            autoFocus
          />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="prop block">
          <span className="prop-label">Colour</span>
          <div className="swatches">
            {PROJECT_COLORS.map((c, i) => (
              <label key={c} className="swatch" style={{ background: c }} title={c}>
                <input
                  type="radio"
                  name="color"
                  value={c}
                  defaultChecked={i === 0}
                  aria-label={`Colour ${c}`}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="set-row">
          <button className="btn btn-primary" type="submit">
            Create project
          </button>
          <button className="btn" type="button" onClick={closeDialog}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function Dialogs() {
  return (
    <>
      <SettingsDialog />
      <HelpDialog />
      <NextDialog />
      <ProjectDialog />
    </>
  );
}
