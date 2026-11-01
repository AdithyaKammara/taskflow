import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { restoreLastView } from './app/routes';
import { initSession } from './features/auth/session';
import './app/store'; // applies the saved theme and density before the first render
import './styles/index.css';

restoreLastView();
initSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
