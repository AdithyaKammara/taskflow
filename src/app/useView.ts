import { useShallow } from 'zustand/react/shallow';
import { useApp } from './store';

/**
 * The document plus the filter settings: what every task view reads (and nothing else). The team
 * and "me" are included so views re-render when workspace members change, since the selectors
 * read them.
 */
export const useView = () =>
  useApp(
    useShallow(({ doc, team, me, project, assignee, priority, search, quickChip }) => ({
      doc,
      team,
      me,
      project,
      assignee,
      priority,
      search,
      quickChip,
    }))
  );
