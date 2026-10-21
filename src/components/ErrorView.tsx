import { AlertCircle } from 'lucide-react';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  detail?: string;
}

export function ErrorView({
  message = 'Something went wrong. Please try again.',
  onRetry,
  detail,
}: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-base font-semibold text-gray-900">{message}</p>
      {detail && <p className="mt-2 max-w-xs break-words text-xs text-gray-400">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
