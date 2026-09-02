import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    console.error('ErrorBoundary caught error:', error);
  }

  handleRestart = (): void => {
    if (window.electronAPI) {
      window.electronAPI.restartApp?.();
    } else {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-600 text-sm mb-4">
              An unexpected error occurred. Please restart the app to continue.
            </p>
            {this.state.error && (
              <details className="mb-4 text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-32 overflow-auto">
                <summary>Error details</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words">{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="flex justify-end">
              <button
                onClick={this.handleRestart}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
