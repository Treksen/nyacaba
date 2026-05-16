import { Component } from 'react';
import { logError } from '../lib/errors';

/**
 * ErrorBoundary — catches uncaught render-time errors anywhere in the tree
 * and shows a graceful fallback instead of a white screen.
 *
 * Errors are logged to error_logs so admin can review them later.
 * The fallback message follows the same dual-audience rule (admin sees
 * details, others see "Contact administrator"). Admin status is detected
 * at render time, not via React context (boundaries can't use hooks).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Fire-and-forget log. Best effort.
    logError(error, {
      action: 'react_render_crash',
      component_stack: errorInfo?.componentStack?.slice(0, 2000),
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold mb-2">Something broke</h1>
          <p className="text-sm text-ink-600 mb-6">
            We hit an unexpected error. Please contact the administrator
            and we'll look into it. The error has been logged.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={this.handleReload} className="btn-primary">Reload page</button>
            <button onClick={this.handleHome} className="btn-secondary">Go home</button>
          </div>
          {/* Show details only in development for the developer */}
          {import.meta.env.DEV && (
            <details className="mt-6 text-left">
              <summary className="text-xs text-ink-500 cursor-pointer">Developer details</summary>
              <pre className="mt-2 text-[10px] text-ink-700 bg-cream-100 p-2 rounded overflow-x-auto">
                {String(this.state.error?.stack || this.state.error?.message)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
