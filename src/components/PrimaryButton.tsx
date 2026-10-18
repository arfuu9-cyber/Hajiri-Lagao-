import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Languages } from 'lucide-react';
import { useLang } from '@/context/LangContext';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'danger';
}

export function PrimaryButton({
  children,
  loading = false,
  fullWidth = false,
  variant = 'primary',
  disabled,
  className = '',
  ...rest
}: PrimaryButtonProps) {
  const variantClasses = {
    primary: 'bg-navy-700 hover:bg-navy-800 active:bg-navy-900',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800',
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4
        text-base font-semibold text-white transition-all
        ${variantClasses[variant]}
        disabled:bg-gray-300 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:ring-offset-2
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <svg
          className="animate-spin h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-200 hover:bg-navy-800 transition-colors"
      title="Switch language"
    >
      <Languages className="h-4 w-4" />
      <span>{lang === 'en' ? 'हिं' : 'Aa'}</span>
    </button>
  );
}
