"use client";

interface RetryPromptProps {
  error: Error;
  retrying: boolean;
  retryCount: number;
  onRetry: () => void;
  onDismiss?: () => void;
}

export function RetryPrompt({
  error,
  retrying,
  retryCount,
  onRetry,
  onDismiss,
}: RetryPromptProps) {
  const isTimeoutError = error.message.includes('timeout');
  const isNetworkError = error.message.includes('network') || error.message.includes('Failed to fetch');

  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-400">
            {isTimeoutError ? 'Request Timeout' : isNetworkError ? 'Connection Error' : 'Request Failed'}
          </h3>
          <p className="mt-1 text-sm text-yellow-400/80">{error.message}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onRetry}
              disabled={retrying}
              className="rounded-lg bg-yellow-500/20 px-3 py-2 text-sm font-medium text-yellow-400 transition-colors hover:bg-yellow-500/30 disabled:opacity-50"
            >
              {retrying ? (
                <>
                  <svg className="inline h-4 w-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Retrying...
                </>
              ) : (
                <>
                  <svg className="inline h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </>
              )}
            </button>
            {retryCount > 0 && (
              <span className="text-xs text-yellow-400/60">
                Attempt {retryCount + 1}
              </span>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-auto text-yellow-400/60 hover:text-yellow-400 transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
