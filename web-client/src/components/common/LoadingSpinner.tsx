import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 gap-3 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-brand-500`} />
      {text && <p className="text-sm text-slate-400 font-medium animate-pulse">{text}</p>}
    </div>
  );
};
