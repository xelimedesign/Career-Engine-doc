import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-rose-200 rounded-lg p-6 space-y-3">
            <h1 className="text-base font-semibold text-slate-900">
              Something went wrong while loading your workspace
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              {this.state.errorMessage || 'An unexpected application error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
            >
              Reload Career Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
