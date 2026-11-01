/** Global keyboard shortcuts: Ctrl/Cmd+K, Ctrl/Cmd+Z / Shift+Z / Y, and N, /, F, ? (v6 ui/shortcuts.js). */
import { useEffect } from 'react';
import { openDialog, redo, togglePomo, undo } from '../../app/store';
import { focusQuickAdd } from './CommandPalette';

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'k') {
        e.preventDefault();
        openDialog('palette');
        return;
      }

      const target = e.target as Element;
      // fields you type into; checkboxes and radios are inputs too, but have no text to edit
      const textField = target.matches?.('textarea, input:not([type=checkbox], [type=radio])');
      // letters pick options in a focused <select>, so it counts as typing for the letter shortcuts
      const typing = textField || target.tagName === 'SELECT';

      if (mod && !e.altKey && (key === 'z' || key === 'y')) {
        // text fields keep their own undo; other controls have none, so the app's undo applies
        if (textField) return;
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }

      if (typing || mod || e.altKey || document.querySelector('dialog[open]')) return;

      if (e.key === '/') {
        e.preventDefault();
        const s = document.getElementById('searchInput');
        if (s) s.focus();
        else focusQuickAdd();
      } else if (key === 'n') {
        e.preventDefault();
        focusQuickAdd();
      } else if (key === 'f') {
        e.preventDefault();
        togglePomo();
      } else if (e.key === '?') {
        e.preventDefault();
        openDialog('help');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
