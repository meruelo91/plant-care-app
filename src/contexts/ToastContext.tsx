import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Toast, { type ToastType } from '@/components/common/Toast';

/**
 * ToastContext - Global toast notification system.
 *
 * WHY A CONTEXT?
 * Toast notifications can be triggered from anywhere in the app:
 *   - After marking a plant as watered
 *   - When adding a new plant
 *   - On API errors
 *
 * Using React Context, any component can show a toast without
 * prop drilling or complex state management.
 *
 * USAGE:
 * const { showToast } = useToast();
 * showToast('¡Planta regada!', 'success');
 */

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Render all active toasts - only the last one is visible */}
      {toasts.slice(-1).map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
};

/**
 * Hook to access the toast system from any component.
 *
 * @throws Error if used outside ToastProvider
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
