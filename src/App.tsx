import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Plus, Settings } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { ToastProvider } from '@/contexts/ToastContext';
import SplashScreen from '@/components/common/SplashScreen';
import OnboardingPage from '@/pages/OnboardingPage';
import HomePage from '@/pages/HomePage';
import AddPlantPage from '@/pages/AddPlantPage';
import PlantDetailPage from '@/pages/PlantDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import './App.css';

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
 *   2. While loading → show animated SplashScreen
 *   3. If onboarding NOT completed → show OnboardingPage (no routes, no nav)
 *   4. If onboarding completed → show the normal app with routing + nav
 *
 * TOAST NOTIFICATIONS:
 * The ToastProvider wraps the app to enable toast notifications
 * from any component using the useToast() hook.
 */

/**
 * NavLink - Navigation link with active state styling.
 */
const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({
  to,
  icon,
  label,
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} className={`nav-link ${isActive ? 'nav-link-active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
};

/**
 * AppContent - Main app content with routing and navigation.
 * Separated to use useLocation hook (requires BrowserRouter context).
 */
const AppContent: React.FC = () => {
  return (
    <div className="app">
      <main className="app-main">
        <div className="page-transition">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/add" element={<AddPlantPage />} />
            <Route path="/plant/:id" element={<PlantDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      {/* Bottom navigation bar - common pattern in mobile apps */}
      <nav className="app-nav">
        <NavLink to="/" icon={<Home size={24} />} label="Jardín" />
        <NavLink to="/add" icon={<Plus size={24} />} label="Agregar" />
        <NavLink to="/settings" icon={<Settings size={24} />} label="Ajustes" />
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  const { isLoading, isOnboardingCompleted } = useUserSettings();

  // Start the notification scheduler (runs in background while app is open)
  // The hook handles its own lifecycle — starts on mount, stops on unmount.
  // Checks every minute if it's time to send a watering reminder notification.
  useNotificationScheduler();

  // ─── Loading state ───
  // Show animated splash screen while IndexedDB is being read.
  // This creates a polished first impression.
  if (isLoading) {
    return <SplashScreen />;
  }

  // ─── Onboarding ───
  // First-time users see the location setup screen.
  // No routing, no bottom nav — just the onboarding.
  if (!isOnboardingCompleted) {
    return (
      <ToastProvider>
        <OnboardingPage />
      </ToastProvider>
    );
  }

  // ─── Main app ───
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
