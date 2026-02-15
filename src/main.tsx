import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import App from './App.tsx';
import './index.css';

/**
 * Entry point - renders the app wrapped in safety layers.
 *
 * LAYER ORDER (outermost → innermost):
 *   StrictMode → catches React anti-patterns in development
 *   ErrorBoundary → catches runtime errors (e.g., IndexedDB crashes)
 *   App → the actual application
 *
 * WHY ErrorBoundary HERE?
 * If IndexedDB fails to open on Safari/iPhone, Dexie throws during the
 * first render. Without a boundary, React shows a blank white page.
 * The ErrorBoundary catches this and shows a "Reiniciar app" button
 * that clears the corrupt database and reloads.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
