import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Outlet, useLocation } from 'react-router';
import { PAGES } from '../../app/routes';
import { useApp } from '../../app/store';
import { CommandPalette } from '../../features/palette/CommandPalette';
import { useShortcuts } from '../../features/palette/useShortcuts';
import { TeamDialog } from '../../features/auth/TeamDialog';
import { Dialogs } from '../../features/settings/Dialogs';
import { TaskDrawer } from '../../features/tasks/TaskDrawer';
import { KEYS } from '../../lib/config';
import { writePref } from '../../lib/store/storage';
import { Toast } from '../Toast';
import { QuickHint } from './QuickHint';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';

const setNavOpen = (navOpen: boolean) => useApp.setState({ navOpen });

/** The app frame: sidebar (a drawer below 900px), top bar, the current page and the overlays. */
export function AppShell() {
  const navOpen = useApp((s) => s.navOpen);
  const me = useApp((s) => s.me);
  const [quick, setQuick] = useState('');
  const [quickError, setQuickError] = useState('');
  const menuRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const view = (PAGES.find((p) => p.path === pathname) ?? PAGES[0]).view;
  useShortcuts();

  // like v6's go(): "My tasks" is the list filtered to me; any page change clears the selection
  useEffect(() => {
    useApp.setState({ assignee: pathname === '/my-tasks' ? me : '', selected: new Set() });
    window.scrollTo(0, 0);
  }, [pathname, me]);

  useEffect(() => writePref(KEYS.view, view), [view]);

  // the open drawer closes on Escape (focus back on the menu button) and when the screen widens
  useEffect(() => {
    if (!navOpen) return;
    const wide = window.matchMedia('(min-width: 900px)');
    const close = () => setNavOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      flushSync(close); // the content stops being inert first, so the button can take focus
      menuRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    wide.addEventListener('change', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', close);
    };
  }, [navOpen]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="grid min-h-dvh tablet:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 tablet:hidden"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setNavOpen(false)}
          />
        )}
        <div className="flex min-w-0 flex-col" inert={navOpen}>
          <TopBar navOpen={navOpen} onMenu={() => setNavOpen(true)} menuRef={menuRef} />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-[max(48px,calc(24px+env(safe-area-inset-bottom)))] tablet:px-7"
          >
            <Toolbar
              quick={quick}
              setQuick={setQuick}
              setQuickError={setQuickError}
              calendar={pathname === '/calendar'}
            />
            <QuickHint text={quick} error={quickError} />
            <Outlet />
            <footer className="footer">
              TaskFlow · React and TypeScript, with optional Supabase accounts and live team sync ·{' '}
              <a href="https://github.com/AdithyaKammara" target="_blank" rel="noopener">
                GitHub
              </a>{' '}
              ·{' '}
              <a href="https://linkedin.com/in/adithyakammara" target="_blank" rel="noopener">
                LinkedIn
              </a>
            </footer>
          </main>
        </div>
      </div>
      <TaskDrawer />
      <Dialogs />
      <TeamDialog />
      <CommandPalette />
      <Toast />
    </>
  );
}
