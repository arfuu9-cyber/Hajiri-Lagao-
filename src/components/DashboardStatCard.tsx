import type { LucideIcon } from 'lucide-react';

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
  accentColor?: string;
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  loading = false,
  onClick,
  accentColor = 'bg-navy-50',
}: DashboardStatCardProps) {
  const content = (
    <>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accentColor} mb-3 transition-transform duration-300 ${onClick ? 'group-hover:scale-110' : ''}`}>
        <Icon className={`h-6 w-6 ${accentColor === 'bg-navy-50' ? 'text-navy-600' : accentColor.replace('bg-', 'text-').replace('-50', '-600')}`} />
      </div>
      {loading ? (
        <div className="h-8 w-12 animate-pulse rounded bg-gray-200" />
      ) : (
        <span className="text-3xl font-bold text-gray-900">{value}</span>
      )}
      <span className="mt-1 text-sm text-gray-500 text-center">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        className="group flex flex-col items-center justify-center rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-navy-300 active:scale-95 transition-all duration-200 w-full disabled:opacity-60"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      {content}
    </div>
  );
}
