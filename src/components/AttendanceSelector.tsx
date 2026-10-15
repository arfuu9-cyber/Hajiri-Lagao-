import { DUTY_TYPES, type DutyMultiplier } from '@/types/database';
import { useLang } from '@/context/LangContext';

interface AttendanceSelectorProps {
  value: DutyMultiplier | null;
  onChange: (value: DutyMultiplier) => void;
  compact?: boolean;
}

export function AttendanceSelector({ value, onChange, compact = false }: AttendanceSelectorProps) {
  const { t } = useLang();

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid grid-cols-5 gap-2'}>
      {DUTY_TYPES.map((duty) => {
        const isSelected = value === duty.value;
        return (
          <button
            key={duty.value}
            type="button"
            onClick={() => onChange(duty.value)}
            className={`
              ${compact ? 'rounded-lg px-3 py-2 text-xs' : 'rounded-xl py-3 px-1'}
              flex flex-col items-center justify-center gap-1 font-bold transition-all
              ${isSelected
                ? `${duty.solidBgClass} text-white shadow-md scale-105 border-2 ${duty.borderClass}`
                : `${duty.bgClass} ${duty.textClass} border-2 border-transparent hover:border-2 hover:${duty.borderClass}`
              }
            `}
          >
            <span className={compact ? 'text-base' : 'text-2xl'}>
              {duty.value === 0 ? '0' : duty.value}
            </span>
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium leading-tight text-center`}>
              {t(duty.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DutyBadge({ multiplier, size = 'sm' }: { multiplier: number; size?: 'sm' | 'md' }) {
  const { t } = useLang();
  const duty = DUTY_TYPES.find((d) => d.value === multiplier) ?? DUTY_TYPES[2];

  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${sizeClass} ${duty.bgClass} ${duty.textClass}`}>
      <span className={`h-2 w-2 rounded-full ${duty.solidBgClass}`} />
      {t(duty.labelKey)}
    </span>
  );
}
