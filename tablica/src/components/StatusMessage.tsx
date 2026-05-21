import React from 'react';

interface StatusMessageProps {
  status: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;
}

export default function StatusMessage({ status }: StatusMessageProps) {
  if (!status) return null;

  const variantClasses = {
    success: 'bg-green-500/10 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    error: 'bg-red-500/10 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    info: 'bg-brand-500/10 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-500/20',
  };

  const icons = {
    success: (
      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`
        flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm
        animate-slide-up
        ${variantClasses[status.type]}
      `}
    >
      <span className="flex-shrink-0">{icons[status.type]}</span>
      <span className="flex-1 font-medium">{status.message}</span>
    </div>
  );
}
