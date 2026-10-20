export interface Site {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  role: string;
  nfc_tag_uid: string | null;
  daily_wage: number;
  site_id: string | null;
  active: boolean;
  created_at: string;
  aadhaar_number: string | null;
  id_photo_url: string | null;
  age: number | null;
  profile_photo_url: string | null;
  user_id?: string | null;
  thekedar_id?: string | null;
  invite_code?: string | null;
}

export interface WorkerInput {
  name: string;
  phone: string;
  role: string;
  daily_wage: number;
  age?: number | null;
  profile_photo_url?: string | null;
  user_id?: string | null;
  thekedar_id?: string | null;
}

export interface Attendance {
  id: string;
  worker_id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  status: 'present' | 'late';
  overtime_hours: number;
  half_day: boolean;
  duty_multiplier: number;
  site_id: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
}

export interface AttendanceWithWorker extends Attendance {
  worker: Pick<Worker, 'id' | 'name' | 'role' | 'phone'>;
}

export interface Advance {
  id: string;
  worker_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
  status: 'pending' | 'verified';
  given_by: string | null;
  verified_at: string | null;
}

export interface PayrollRow {
  worker: Pick<Worker, 'id' | 'name' | 'role' | 'daily_wage' | 'phone'>;
  totalDays: number;
  totalWage: number;
  overtimePay: number;
  advancesCut: number;
  finalPayout: number;
}

export type AttendanceStatus = 'present' | 'late';

export type DutyMultiplier = 0 | 0.5 | 1 | 1.5 | 2;

export interface DutyType {
  value: DutyMultiplier;
  labelKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  solidBgClass: string;
}

export const DUTY_TYPES: DutyType[] = [
  { value: 0,   labelKey: 'duty_0',   color: 'red',    bgClass: 'bg-red-50',    textClass: 'text-red-700',    borderClass: 'border-red-500',    solidBgClass: 'bg-red-500' },
  { value: 0.5, labelKey: 'duty_0_5', color: 'orange', bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-500', solidBgClass: 'bg-orange-500' },
  { value: 1,   labelKey: 'duty_1',   color: 'green',  bgClass: 'bg-green-50',  textClass: 'text-green-700',  borderClass: 'border-green-500',  solidBgClass: 'bg-green-500' },
  { value: 1.5, labelKey: 'duty_1_5', color: 'blue',   bgClass: 'bg-blue-50',   textClass: 'text-blue-700',   borderClass: 'border-blue-500',   solidBgClass: 'bg-blue-500' },
  { value: 2,   labelKey: 'duty_2',   color: 'purple', bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-500', solidBgClass: 'bg-purple-500' },
];

export function getDutyType(multiplier: number): DutyType {
  return DUTY_TYPES.find((d) => d.value === multiplier) ?? DUTY_TYPES[2];
}

export type UserRole = 'thekedar' | 'labour' | 'gatekeeper';

export interface UserProfile {
  id: string;
  phone: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface GatePass {
  id: string;
  thekedar_id: string;
  worker_ids: string[];
  entry_time: string;
  created_at: string;
}

export interface DashboardStats {
  totalPresentToday: number;
  totalAbsentToday: number;
  newWorkersToday: number;
  weeklyPayout: number;
  attendanceRate: number;
  pendingAdvances: number;
  activeWorkers: number;
}
