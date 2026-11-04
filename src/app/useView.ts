import { useShallow } from 'zustand/react/shallow';
import { useApp } from './store';

/**
 * The document plus the filter settings: what every task view reads (and nothing else). The team
 * and "me" are included so views re-render when workspace members change, since the selectors
 * read them.
 */
export const useView = () =>
  useApp(
    useShallow((s) => ({
      doc: s.doc,
      team: s.team,
      me: s.me,
      project: s.project,
      statuses: s.statuses,
      priorities: s.priorities,
      assignees: s.assignees,
      dueFrom: s.dueFrom,
      dueTo: s.dueTo,
      search: s.search,
      quickChip: s.quickChip,
    }))
  );
