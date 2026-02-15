import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home, Plus, Settings } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import OnboardingPage from '@/pages/OnboardingPage';
import HomePage from '@/pages/HomePage';
import AddPlantPage from '@/pages/AddPlantPage';
import PlantDetailPage from '@/pages/PlantDetailPage';
import SettingsPage from '@/pages/SettingsPage';

/**
 * App - Root component with conditional rendering + routing.
 *
 * ONBOARDING GATE PATTERN:
 * Before showing the main app, we check if the user has completed
 * the onboarding (location setup). This is a common pattern in mobile
 * apps where first-time users see a setup wizard before the main UI.
 *
 * How it works:
 *   1. useUserSettings reads from IndexedDB (reactive via useLiveQuery)
 *   2. While loading → show a simple loading screen
 *   3. If onboarding NOT completed → show OnboardingPage (no routes, no nav)
 *   4. If onboarding completed → show the normal app with routing + nav
 *
 * WHY NOT A ROUTE?
 * The onboarding is NOT a route (like /onboarding) because:
 *   - Users could bookmark it and get confused later
 *   - The URL bar would show /onboarding on fresh installs
 *   - It's simpler: either you see the onboarding OR the app, never both
 *
 * REACTIVITY:
 * When the onboarding saves settings to IndexedDB, useUserSettings
 * automatically re-renders this component (thanks to useLiveQuery).
 * The transition from onboarding to main app happens seamlessly
 * without manual state updates or page reloads.
 *
 * ROUTING CONCEPTS:
 * - BrowserRouter: Wraps the app to enable URL-based navigation
 * - Routes: Container for all route definitions
 * - Route: Maps a URL path to a component
 * - Link: Navigation without page reload (unlike <a> tags)
 */
const App: React.FC = () => {
  const { isLoading, isOnboardingCompleted } = useUserSettings();

  // Start the notification scheduler (runs in background while app is open)
  // The hook handles its own lifecycle — starts on mount, stops on unmount.
  // Checks every minute if it's time to send a watering reminder notification.
  useNotificationScheduler();

  // ─── Loading state ───
  // Show a minimal loading screen while IndexedDB is being read.
  // This prevents a flash of the onboarding screen for returning users.
  if (isLoading) {
    return (
      <div className="app" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
      }}>
        <span style={{ fontSize: '2.5rem' }}>🌱</span>
      </div>
    );
  }

  // ─── Onboarding ───
  // First-time users see the location setup screen.
  // No routing, no bottom nav — just the onboarding.
  if (!isOnboardingCompleted) {
    return <OnboardingPage />;
  }

  // ─── Main app ───
  return (
    <BrowserRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/add" element={<AddPlantPage />} />
            <Route path="/plant/:id" element={<PlantDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        {/* Bottom navigation bar - common pattern in mobile apps */}
        <nav className="app-nav">
          <Link to="/" className="nav-link">
            <Home size={24} />
            <span>Jardín</span>
          </Link>
          <Link to="/add" className="nav-link">
            <Plus size={24} />
            <span>Agregar</span>
          </Link>
          <Link to="/settings" className="nav-link">
            <Settings size={24} />
            <span>Ajustes</span>
          </Link>
        </nav>
      </div>
    </BrowserRouter>
  );
};

export default App;
