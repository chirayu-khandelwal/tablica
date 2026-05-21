import React from 'react';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => Promise<void>;
  loading: boolean;
  variant: 'primary' | 'secondary' | 'outline';
  compact?: boolean;
}

export default function ActionButton({
  icon,
  label,
  description,
  onClick,
  loading,
  variant,
  compact = false,
}: ActionButtonProps) {
  const baseClasses = `
    relative flex items-center gap-3 rounded-xl transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2
    active:scale-[0.98]
  `;

  const variantClasses = {
    primary: `
      bg-gradient-brand text-white
      shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30
      focus:ring-brand-500 focus:ring-offset-0
      hover:scale-[1.02]
      dark:shadow-brand-500/10 dark:hover:shadow-brand-500/20
    `,
    secondary: `
      bg-brand-500/10 text-brand-600 dark:text-brand-400
      border border-brand-500/20
      hover:bg-brand-500/20 hover:border-brand-500/30
      focus:ring-brand-500 focus:ring-offset-0
      dark:bg-brand-500/5 dark:border-brand-500/10
    `,
    outline: `
      bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-100
      border border-gray-200 dark:border-dark-600
      hover:bg-gray-50 hover:border-gray-300
      dark:hover:bg-dark-700 dark:hover:border-dark-500
      focus:ring-brand-500 focus:ring-offset-0
    `,
  };

  const iconWrapper = loading ? (
    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  ) : (
    <div className="flex-shrink-0 w-5 h-5 text-current opacity-80 group-hover:opacity-100 transition-opacity">
      {icon}
    </div>
  );

  const chevron = (
    <svg className={`w-4 h-4 text-current opacity-40 transition-all group-hover:opacity-70 group-hover:translate-x-0.5 ${loading ? 'opacity-0' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  if (compact) {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        className={`${baseClasses} ${variantClasses[variant]} flex-col p-3 w-full group`}
      >
        {iconWrapper}
        <div className="text-left w-full">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs opacity-60 mt-0.5">{description}</div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${baseClasses} ${variantClasses[variant]} p-3 w-full group`}
    >
      {iconWrapper}
      <div className="text-left flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs opacity-60 mt-0.5">{description}</div>
      </div>
      {chevron}
    </button>
  );
}
