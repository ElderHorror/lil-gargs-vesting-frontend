interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "Oops! Something went wrong", 
  message, 
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="mb-6">
        <img 
          src="/WhatsApp Image 2025-10-04 at 12.46.50 PM.jpeg" 
          alt="Lil Gargs" 
          className="w-32 h-32 rounded-full opacity-50"
        />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-3">
        {title}
      </h2>
      
      <p className="text-white/60 mb-6 max-w-md">
        {message}
      </p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
        >
          Try Again
        </button>
      )}
      
      <p className="text-xs text-white/40 mt-8">
        Lil Gargs Vesting • Need help? Contact support
      </p>
    </div>
  );
}
