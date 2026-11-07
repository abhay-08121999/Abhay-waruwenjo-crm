import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Top-level safety net. Without it, any uncaught render error in any module
 * unmounts the whole React tree, which shows as a blank white screen.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CRM render crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center">
          <h2 className="text-xl font-black text-slate-900">Something went wrong</h2>
          <p className="mt-3 text-sm text-slate-500">
            This page hit an unexpected error. Your data is safe. Reload to continue.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-100 p-3 text-left text-xs text-slate-600">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-teal-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}