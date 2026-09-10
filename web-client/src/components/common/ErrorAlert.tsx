import React from 'react';
import { AlertCircle, AlertTriangle, X, WifiOff } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  errors?: string[];
  severity?: 'error' | 'warning';
  onDismiss?: () => void;
  isNetworkError?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  errors = [],
  severity = 'error',
  onDismiss,
  isNetworkError = false,
}) => {
  const isWarning = severity === 'warning';

  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 mb-4 transition-all duration-200 ${
        isWarning
          ? 'bg-amber-950/40 border-amber-800 text-amber-200'
          : 'bg-rose-950/40 border-rose-800 text-rose-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isNetworkError ? (
            <WifiOff className="w-5 h-5 text-rose-400" />
          ) : isWarning ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
        </div>

        <div className="flex-1 text-sm">
          <p className="font-semibold">{message}</p>
          {errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-xs opacity-90">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
