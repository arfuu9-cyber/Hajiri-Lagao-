import { DutyBadge } from './AttendanceSelector';

interface AttendanceRowProps {
  name: string;
  role: string;
  phone: string;
  timeIn: string;
  status: 'present' | 'late';
  dutyMultiplier?: number;
}

export function AttendanceRow({ name, role, phone, timeIn, status, dutyMultiplier = 1 }: AttendanceRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-navy-50 py-3 last:border-0">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white ${status === 'late' ? 'bg-saffron-500' : 'bg-green-500'}`}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-gray-900">{name}</p>
          {dutyMultiplier !== 1 && <DutyBadge multiplier={dutyMultiplier} />}
        </div>
        <p className="truncate text-sm text-gray-500">
          {role} · {phone}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-navy-50 px-3 py-1 text-sm font-semibold text-navy-700">{timeIn}</span>
    </div>
  );
}
