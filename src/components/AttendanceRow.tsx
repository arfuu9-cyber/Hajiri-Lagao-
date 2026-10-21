import { DutyBadge } from './AttendanceSelector';

interface AttendanceRowProps {
  name: string;
  role: string;
  phone: string;
  timeIn: string;
  status: 'present' | 'late';
  dutyMultiplier?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
}

export function AttendanceRow({ name, role, phone, timeIn, status, dutyMultiplier = 1, approvalStatus = 'approved', rejectionReason }: AttendanceRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-navy-50 py-3 last:border-0">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white ${approvalStatus === 'pending' ? 'bg-sky-600' : approvalStatus === 'rejected' ? 'bg-rose-500' : status === 'late' ? 'bg-saffron-500' : 'bg-green-500'}`}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-gray-900">{name}</p>
          {dutyMultiplier !== 1 && approvalStatus === 'approved' && <DutyBadge multiplier={dutyMultiplier} />}
          {approvalStatus !== 'approved' && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${approvalStatus === 'pending' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>{approvalStatus === 'pending' ? 'Approval pending' : 'Rejected'}</span>}
        </div>
        <p className="truncate text-sm text-gray-500">
          {role} · {phone}
        </p>
        {approvalStatus === 'rejected' && rejectionReason && <p className="mt-1 line-clamp-2 text-xs text-rose-600">Reason: {rejectionReason}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-navy-50 px-3 py-1 text-sm font-semibold text-navy-700">{timeIn}</span>
    </div>
  );
}
