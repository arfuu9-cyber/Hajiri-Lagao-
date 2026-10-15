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
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 truncate">{name}</p>
          {dutyMultiplier !== 1 && <DutyBadge multiplier={dutyMultiplier} />}
        </div>
        <p className="text-sm text-gray-500">
          {role} · {phone}
        </p>
      </div>
      <span className="shrink-0 ml-3 text-sm font-medium text-gray-700">{timeIn}</span>
    </div>
  );
}
