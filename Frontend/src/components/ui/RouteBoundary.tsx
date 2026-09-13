import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence around the routed page.
 *
 * The case it exists for is unglamorous but real: a deploy replaces the hashed
 * chunk files, a visitor still has the old `index.html`, and the dynamic import
 * for the page they click 404s. Without a boundary that is a blank screen with a
 * console error and no explanation; with one they get a button that reloads
 * against the current build. It also keeps any future render error inside a page
 * from taking the whole app down.
 *
 * The error itself goes to the console, not into the UI — a stack trace is not
 * something to show a user, and it is the first thing whoever is debugging wants.
 */
export default class RouteBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DevVault] A page failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mx-auto mb-4">
            <FiAlertTriangle size={20} className="text-brass-400" />
          </div>
          <h2 className="font-display text-lg font-semibold">This page could not be loaded</h2>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            The most common reason is that DevVault was updated while this tab was open. Reloading
            fetches the current version; your notes and snippets are on the server and are not
            affected.
          </p>
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
