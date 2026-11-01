/** Command palette (Ctrl/Cmd + K): jump to screens, run actions, or search tasks. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { exportCSV, exportJSON, seedData } from '../../app/actions';
import {
  closeDialog,
  openDialog,
  openDrawer,
  redo,
  setProject,
  toggleDensity,
  togglePomo,
  toggleTheme,
  undo,
  useApp,
} from '../../app/store';
import { statusLabel } from '../../lib/model/meta';
import { Modal } from '../../components/shared';

interface Command {
  label: string;
  hint: string;
  run: () => void;
}

export const focusQuickAdd = () => document.getElementById('quickInput')?.focus();

function Palette() {
  const doc = useApp((s) => s.doc);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const commands: Command[] = [
    { label: 'Go to Dashboard', hint: 'View', run: () => navigate('/') },
    { label: 'Go to My tasks', hint: 'View', run: () => navigate('/my-tasks') },
    { label: 'Go to All tasks', hint: 'View', run: () => navigate('/tasks') },
    { label: 'Go to Board', hint: 'View', run: () => navigate('/board') },
    { label: 'Go to Calendar', hint: 'View', run: () => navigate('/calendar') },
    { label: 'Create new task', hint: 'Focus quick add', run: focusQuickAdd },
    { label: 'Start / Pause 25m Focus Timer', hint: 'Shortcut: F', run: togglePomo },
    { label: 'What should I do next?', hint: 'Suggestion', run: () => openDialog('next') },
    { label: 'Keyboard Shortcuts Cheat-Sheet', hint: 'Shortcut: ?', run: () => openDialog('help') },
    { label: 'Undo', hint: 'Ctrl Z', run: undo },
    { label: 'Redo', hint: 'Ctrl Shift Z', run: redo },
    { label: 'Toggle light / dark theme', hint: 'Appearance', run: toggleTheme },
    { label: 'Toggle compact density', hint: 'Appearance', run: toggleDensity },
    { label: 'Export JSON backup', hint: 'Data', run: exportJSON },
    { label: 'Export CSV', hint: 'Data', run: exportCSV },
    { label: 'Add sample data', hint: 'Data', run: seedData },
    { label: 'Open settings', hint: 'App', run: () => openDialog('settings') },
    ...doc.projects.map((p) => ({
      label: `Open project: ${p.name}`,
      hint: 'Project',
      run: () => setProject(p.id),
    })),
    ...doc.tasks.map((t) => ({
      label: t.title,
      hint: `Task · ${statusLabel(t.status)}`,
      run: () => openDrawer(t.id),
    })),
  ];

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = commands
    .filter((c) => words.every((w) => c.label.toLowerCase().includes(w)))
    .slice(0, 9);
  const active = Math.min(index, Math.max(items.length - 1, 0));

  const run = (i: number) => {
    const c = items[i];
    if (!c) return;
    closeDialog();
    c.run();
  };

  return (
    <>
      <input
        className="p-input"
        type="text"
        autoComplete="off"
        placeholder="Type a command or search tasks…"
        role="combobox"
        aria-expanded="true"
        aria-controls="paletteList"
        aria-autocomplete="list"
        aria-label="Command palette"
        aria-activedescendant={items.length ? `pi-${active}` : ''}
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            setIndex(next);
            document.getElementById(`pi-${next}`)?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(active);
          }
        }}
      />
      <ul id="paletteList" className="p-list" role="listbox" aria-label="Results">
        {items.length ? (
          items.map((c, i) => (
            <li
              key={`${c.hint}:${c.label}:${i}`}
              id={`pi-${i}`}
              role="option"
              className="p-item"
              aria-selected={i === active}
              onClick={() => run(i)}
            >
              <span>{c.label}</span>
              <span className="muted">{c.hint}</span>
            </li>
          ))
        ) : (
          <li className="p-empty">No matches</li>
        )}
      </ul>
    </>
  );
}

export function CommandPalette() {
  const open = useApp((s) => s.dialog === 'palette');
  return (
    <Modal open={open} onClose={closeDialog} className="palette" aria-label="Command palette">
      <Palette />
    </Modal>
  );
}
