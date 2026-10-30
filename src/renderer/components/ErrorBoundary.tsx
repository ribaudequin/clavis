import React from 'react';
import { t } from '../../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** True from the click until the restart settles either way; keeps Restart from firing twice. */
  restarting: boolean;
  /** True once a restart attempt failed, so the crash screen can say so instead of going silent. */
  restartFailed: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private summaryRef: React.RefObject<HTMLElement | null> = React.createRef<HTMLElement>();
  /** The state flag drives the UI; this one closes the gap between the click and the re-render. */
  private restartInFlight = false;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, restarting: false, restartFailed: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    console.error('ErrorBoundary caught error:', error);
    // Focus the details toggle rather than Restart: a crash screen is exactly when someone
    // reflexively hits Enter, and Enter on Restart relaunches the app. Restart stays one Tab
    // away. DESIGN.md rule 9 — focus goes where a stray Enter lands safely.
    this.summaryRef.current?.focus();
  }

  handleRestart = async (): Promise<void> => {
    if (this.restartInFlight) return;
    const api = window.electronAPI;
    const restart = api?.restartApp;
    if (typeof restart !== 'function') {
      // No bridge to ask: the only way left to recover is a plain reload.
      window.location.reload();
      return;
    }
    this.restartInFlight = true;
    this.setState({ restarting: true, restartFailed: false });
    try {
      const result = await restart();
      // A failure reaches the renderer twice over: the main process answers WRITE_FAILED as a
      // value, and a torn-down channel rejects outright. Both are the same thing to the user,
      // so both end in the message. Success leaves the app to quit — the main process relaunches
      // it, so nothing here resets the boundary.
      if (result && !result.ok) this.failRestart();
    } catch {
      this.failRestart();
    }
  };

  private failRestart(): void {
    this.restartInFlight = false;
    this.setState({ restarting: false, restartFailed: true });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-gray-50 flex items-center justify-center"
          role="alert"
          aria-live="assertive"
          aria-label={t('label.error_title')}
        >
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">{t('label.error_title')}</h1>
            <p className="text-gray-600 text-sm mb-4">
              {t('msg.error_restart_hint')}
            </p>
            {this.state.error && (
              <details className="mb-4 text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-32 overflow-auto">
                <summary ref={this.summaryRef}>{t('label.error_details')}</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words">{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="flex justify-end">
              {this.state.restartFailed && (
                <p role="alert" className="mr-auto self-center text-sm text-red-700">
                  {t('error.write_failed')}
                </p>
              )}
              <button
                onClick={this.handleRestart}
                disabled={this.state.restarting}
                aria-busy={this.state.restarting}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('btn.restart')}
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
