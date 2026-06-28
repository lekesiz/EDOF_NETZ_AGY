'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] React error captured:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="max-w-md w-full rounded-2xl border border-red-900/30 bg-red-950/10 p-8 text-center backdrop-blur-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-950/50 border border-red-900/40">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-100">
              Une erreur est survenue
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Une erreur inattendue s'est produite lors de l'affichage de ce composant.
            </p>
            {this.state.error && (
              <pre className="mt-4 rounded-lg bg-black/40 border border-red-900/20 p-3 text-left text-xs font-mono text-red-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-850 hover:text-zinc-200 transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
