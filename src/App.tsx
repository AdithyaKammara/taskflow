import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { BASENAME } from './app/routes';
import { AppShell } from './components/layout/AppShell';
import { Toast } from './components/Toast';
import { AuthScreen } from './features/auth/AuthScreen';
import { useSession } from './features/auth/session';
import { BoardView } from './features/board/BoardView';
import { CalendarView } from './features/calendar/CalendarView';
import { Dashboard } from './features/dashboard/Dashboard';
import { ListView } from './features/tasks/ListView';

export function App() {
  // cloud mode without a signed-in workspace: the sign-in card replaces the app
  const signedOut = useSession((s) => s.status === 'auth');
  return (
    <BrowserRouter basename={BASENAME}>
      {signedOut ? (
        <>
          <AuthScreen />
          <Toast />
        </>
      ) : (
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="my-tasks" element={<ListView title="My tasks" />} />
            <Route path="tasks" element={<ListView title="Tasks" />} />
            <Route path="board" element={<BoardView />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}
