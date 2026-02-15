import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

/**
 * ErrorBoundary - Catches JavaScript errors in child components.
 *
 * WHY WE NEED THIS:
 * If IndexedDB fails to open (common on Safari/iPhone when the DB
 * version changes), React would show a blank white page. This component
 * catches those errors and shows a helpful recovery screen instead.
 *
 * WHY A CLASS COMPONENT?
 * React doesn't have a hook equivalent for error boundaries (as of 2025).
 * This is the ONE place where we need a class component. The
 * getDerivedStateFromError + componentDidCatch lifecycle methods are
 * only available in class components.
 *
 * HOW IT WORKS:
 *   1. Wraps the entire app (in main.tsx)
 *   2. If any child throws during render, React calls getDerivedStateFromError
 *   3. We set hasError = true, which renders a recovery UI
 *   4. The "Reiniciar" button clears IndexedDB and reloads the page
 */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Error desconocido',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  /** Delete the IndexedDB database and reload the page */
  handleReset = async (): Promise<void> => {
    try {
      // Delete the Dexie database completely
      const deleteRequest = indexedDB.deleteDatabase('PlantCareDB');
      deleteRequest.onsuccess = () => {
        window.location.reload();
      };
      deleteRequest.onerror = () => {
        // If even deletion fails, just reload
        window.location.reload();
      };
    } catch {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>😵</span>
          <h1 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#666', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            La base de datos local puede estar dañada.
          </p>
          <p style={{
            color: '#999',
            fontSize: '0.75rem',
            marginBottom: '1.5rem',
            maxWidth: '300px',
            wordBreak: 'break-word',
          }}>
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              background: '#2d6a4f',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Reiniciar app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
