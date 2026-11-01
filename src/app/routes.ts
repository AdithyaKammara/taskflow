/** The app's pages, in sidebar order. `view` is the v6 view id, kept for the saved-view preference. */
import {
  CalendarDays,
  CircleCheck,
  LayoutDashboard,
  ListTodo,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';
import { KEYS, type View } from '../lib/config';
import { readPref } from '../lib/store/storage';

export interface Page {
  path: string;
  view: View;
  label: string;
  icon: LucideIcon;
}

export const PAGES: Page[] = [
  { path: '/', view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/my-tasks', view: 'list', label: 'My tasks', icon: CircleCheck },
  { path: '/tasks', view: 'list', label: 'All tasks', icon: ListTodo },
  { path: '/board', view: 'board', label: 'Board', icon: SquareKanban },
  { path: '/calendar', view: 'calendar', label: 'Calendar', icon: CalendarDays },
];

/** Router basename: Vite's base without the trailing slash ('/taskflow'). */
export const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Like v6, opening the app goes back to the view used last. Only from the bare app address: an
 * invite link (?invite=) or a Supabase sign-in redirect (#access_token=) is left untouched.
 */
export function restoreLastView() {
  if (location.pathname.replace(/\/$/, '') !== BASENAME || location.search || location.hash) return;
  const view = readPref(KEYS.view);
  const page = PAGES.find((p) => p.view === view && p.path !== '/my-tasks');
  if (page && page.path !== '/') history.replaceState(null, '', BASENAME + page.path);
}
