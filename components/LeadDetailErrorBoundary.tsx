import React from 'react';

type Props = { children: React.ReactNode; onClose: () => void };
type State = { hasError: boolean };

export default class LeadDetailErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Patient lead detail render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">Unable to open lead details</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">This lead has incomplete data</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">The lead record could not be displayed safely. Close this message and try another lead, or refresh the leads list.</p>
            <button onClick={this.props.onClose} className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-teal-700">Close details</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
