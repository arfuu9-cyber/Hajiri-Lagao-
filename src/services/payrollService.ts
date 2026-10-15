import { supabase } from '@/services/supabase';
import type { Advance, PayrollRow, Worker } from '@/types/database';
import { getKolkataDateString } from '@/utils/date';

export interface PayrollRange {
  start: string;
  end: string;
}

const OVERTIME_RATE_PER_HOUR = 50;

export async function fetchPayroll(range: PayrollRange): Promise<PayrollRow[]> {
  const [{ data: workers, error: workerError }, { data: attendance, error: attendanceError }, { data: advances, error: advanceError }] = await Promise.all([
    supabase.from('workers').select('id, name, role, daily_wage').eq('active', true).order('name'),
    supabase.from('attendance').select('worker_id, date, status, half_day, duty_multiplier, overtime_hours').gte('date', range.start).lte('date', range.end),
    supabase.from('advances').select('worker_id, amount, date, note').eq('status', 'verified').gte('date', range.start).lte('date', range.end),
  ]);

  if (workerError) throw workerError;
  if (attendanceError) throw attendanceError;
  if (advanceError) throw advanceError;

  const attendanceByWorker = new Map<string, { days: number; otHours: number }>();
  (attendance ?? []).forEach((record) => {
    const existing = attendanceByWorker.get(record.worker_id) ?? { days: 0, otHours: 0 };
    const dayValue = Number(record.duty_multiplier ?? (record.half_day ? 0.5 : 1));
    existing.days += dayValue;
    existing.otHours += Number(record.overtime_hours ?? 0);
    attendanceByWorker.set(record.worker_id, existing);
  });

  const advancesByWorker = new Map<string, number>();
  (advances ?? []).forEach((advance) => {
    advancesByWorker.set(advance.worker_id, (advancesByWorker.get(advance.worker_id) ?? 0) + Number(advance.amount));
  });

  return ((workers ?? []) as Pick<Worker, 'id' | 'name' | 'role' | 'daily_wage'>[]).map((worker) => {
    const attendanceData = attendanceByWorker.get(worker.id) ?? { days: 0, otHours: 0 };
    const totalDays = attendanceData.days;
    const totalWage = totalDays * Number(worker.daily_wage);
    const overtimePay = attendanceData.otHours * OVERTIME_RATE_PER_HOUR;
    const advancesCut = advancesByWorker.get(worker.id) ?? 0;
    return {
      worker,
      totalDays,
      totalWage,
      overtimePay,
      advancesCut,
      finalPayout: Math.max(0, totalWage + overtimePay - advancesCut),
    };
  });
}

export async function createAdvance(input: {
  workerId: string;
  amount: number;
  date: string;
  note?: string;
  givenBy?: string;
}): Promise<Advance> {
  const { data, error } = await supabase
    .from('advances')
    .insert({
      worker_id: input.workerId,
      amount: input.amount,
      date: input.date,
      note: input.note?.trim() || null,
      given_by: input.givenBy ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface OtpResponse {
  success: boolean;
  maskedPhone: string;
  devOtp?: string;
  error?: string;
}

export async function sendAdvanceOtp(advanceId: string): Promise<OtpResponse> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advance-otp`;
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session?.access_token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'send_otp', advanceId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'OTP bhejna nahi hua' }));
    throw new Error(err.error || 'OTP bhejna nahi hua');
  }
  return response.json();
}

export async function resendAdvanceOtp(advanceId: string): Promise<OtpResponse> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advance-otp`;
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session?.access_token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'resend_otp', advanceId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'OTP dobara nahi bheja gaya' }));
    throw new Error(err.error || 'OTP dobara nahi bheja gaya');
  }
  return response.json();
}

export async function verifyAdvanceOtp(advanceId: string, otpCode: string): Promise<{ success: boolean }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advance-otp`;
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session?.access_token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'verify_otp', advanceId, otpCode }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'OTP verify nahi hua' }));
    throw new Error(err.error || 'OTP verify nahi hua');
  }
  return response.json();
}

export interface WorkerDetail {
  worker: Worker;
  advances: Advance[];
  attendance: { date: string; status: string; half_day: boolean; duty_multiplier: number; overtime_hours: number }[];
}

export async function fetchWorkerDetail(workerId: string): Promise<WorkerDetail> {
  const [{ data: worker, error: workerError }, { data: advances, error: advanceError }, { data: attendance, error: attendanceError }] = await Promise.all([
    supabase.from('workers').select('*').eq('id', workerId).single(),
    supabase.from('advances').select('id, worker_id, amount, date, note, created_at, status, given_by, verified_at').eq('worker_id', workerId).order('date', { ascending: false }),
    supabase.from('attendance').select('date, status, half_day, duty_multiplier, overtime_hours').eq('worker_id', workerId).order('date', { ascending: false }),
  ]);

  if (workerError) throw workerError;
  if (advanceError) throw advanceError;
  if (attendanceError) throw attendanceError;

  return {
    worker: worker as Worker,
    advances: (advances ?? []) as Advance[],
    attendance: (attendance ?? []) as { date: string; status: string; half_day: boolean; duty_multiplier: number; overtime_hours: number }[],
  };
}

export interface DashboardData {
  presentToday: number;
  absentToday: number;
  newWorkersToday: number;
  weeklyPayout: number;
  attendanceRate: number;
  pendingAdvances: number;
  activeWorkers: number;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const today = getKolkataDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const [{ data: activeWorkersList }, { count: presentCount }, { count: activeCount }, { count: newWorkersCount }, { data: weekAttendance }, { data: weekAdvances }, { data: workers }] = await Promise.all([
    supabase.from('workers').select('id').eq('active', true),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
    supabase.from('workers').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('workers').select('*', { count: 'exact', head: true }).gte('created_at', new Date(`${today}T00:00:00+05:30`).toISOString()),
    supabase.from('attendance').select('worker_id, half_day').gte('date', weekStart).lte('date', today),
    supabase.from('advances').select('amount').eq('status', 'verified').gte('date', weekStart).lte('date', today),
    supabase.from('workers').select('daily_wage').eq('active', true),
  ]);

  const activeWorkers = activeCount ?? 0;
  const presentToday = presentCount ?? 0;
  const absentToday = Math.max(0, activeWorkers - presentToday);
  const newWorkersToday = newWorkersCount ?? 0;

  const workerWageMap = new Map<string, number>();
  (workers ?? []).forEach((w: any) => {
    workerWageMap.set(w.id ?? '', Number(w.daily_wage ?? 0));
  });

  let weeklyPayout = 0;
  (weekAttendance ?? []).forEach((record: any) => {
    const dayValue = Number(record.duty_multiplier ?? (record.half_day ? 0.5 : 1));
    const wage = workerWageMap.get(record.worker_id) ?? 0;
    weeklyPayout += dayValue * wage;
  });

  let pendingAdvances = 0;
  (weekAdvances ?? []).forEach((a: any) => {
    pendingAdvances += Number(a.amount);
  });

  const attendanceRate = activeWorkers > 0 ? Math.round((presentToday / activeWorkers) * 100) : 0;

  return {
    presentToday,
    absentToday,
    newWorkersToday,
    weeklyPayout,
    attendanceRate,
    pendingAdvances,
    activeWorkers,
  };
}

export interface LabourDashboardData {
  myDaysThisWeek: number;
  myEarnings: number;
  myAdvances: number;
  myDailyWage: number;
}

export async function fetchLabourDashboardData(workerName: string): Promise<LabourDashboardData | null> {
  const { data: worker } = await supabase
    .from('workers')
    .select('id, daily_wage')
    .ilike('name', workerName.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!worker) return null;

  const today = getKolkataDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const [{ data: attendance }, { data: advances }] = await Promise.all([
    supabase.from('attendance')
      .select('duty_multiplier, half_day')
      .eq('worker_id', worker.id)
      .gte('date', weekStart)
      .lte('date', today),
    supabase.from('advances')
      .select('amount')
      .eq('worker_id', worker.id)
      .eq('status', 'verified')
      .gte('date', weekStart)
      .lte('date', today),
  ]);

  let myDaysThisWeek = 0;
  (attendance ?? []).forEach((r: any) => {
    myDaysThisWeek += Number(r.duty_multiplier ?? (r.half_day ? 0.5 : 1));
  });

  const dailyWage = Number(worker.daily_wage ?? 0);
  let myAdvances = 0;
  (advances ?? []).forEach((a: any) => {
    myAdvances += Number(a.amount);
  });

  return {
    myDaysThisWeek,
    myEarnings: myDaysThisWeek * dailyWage,
    myAdvances,
    myDailyWage: dailyWage,
  };
}

export async function fetchAbsentWorkers(): Promise<Worker[]> {
  const today = getKolkataDateString();
  const { data: attendance } = await supabase
    .from('attendance')
    .select('worker_id')
    .eq('date', today);

  const presentIds = new Set((attendance ?? []).map((r: any) => r.worker_id));

  const { data: workers, error } = await supabase
    .from('workers')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return (workers ?? []).filter((w: any) => !presentIds.has(w.id)) as Worker[];
}

export async function fetchRecentAdvances(limit: number = 10): Promise<(Advance & { worker: Pick<Worker, 'name' | 'role'> })[]> {
  const { data, error } = await supabase
    .from('advances')
    .select(`
      id,
      worker_id,
      amount,
      date,
      note,
      created_at,
      status,
      given_by,
      verified_at,
      worker:workers ( name, role )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    worker_id: row.worker_id,
    amount: Number(row.amount),
    date: row.date,
    note: row.note,
    created_at: row.created_at,
    status: row.status ?? 'pending',
    given_by: row.given_by ?? null,
    verified_at: row.verified_at ?? null,
    worker: row.worker,
  }));
}

export async function fetchWorkerAttendanceByMonth(workerId: string, year: number, month: number): Promise<{ date: string; status: string; half_day: boolean; overtime_hours: number }[]> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('attendance')
    .select('date, status, half_day, overtime_hours')
    .eq('worker_id', workerId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as { date: string; status: string; half_day: boolean; duty_multiplier: number; overtime_hours: number }[];
}

export function exportPayrollCSV(rows: PayrollRow[], range: PayrollRange): void {
  const headers = ['Worker Name', 'Role', 'Daily Wage', 'Total Days', 'Total Wage', 'Overtime Pay', 'Advances Cut', 'Final Payout'];
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push([
      `"${row.worker.name}"`,
      `"${row.worker.role}"`,
      row.worker.daily_wage,
      row.totalDays,
      row.totalWage,
      row.overtimePay,
      row.advancesCut,
      row.finalPayout,
    ].join(','));
  });
  const totals = rows.reduce((acc, r) => ({
    days: acc.days + r.totalDays,
    wage: acc.wage + r.totalWage,
    ot: acc.ot + r.overtimePay,
    advances: acc.advances + r.advancesCut,
    payout: acc.payout + r.finalPayout,
  }), { days: 0, wage: 0, ot: 0, advances: 0, payout: 0 });
  lines.push(['TOTAL', '', '', totals.days, totals.wage, totals.ot, totals.advances, totals.payout].join(','));

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll_${range.start}_to_${range.end}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSalarySlipHTML(row: PayrollRow, range: PayrollRange): string {
  const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip - ${row.worker.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #f9fafb; }
  .slip { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { background: #2563eb; color: white; padding: 24px 32px; }
  .header h1 { font-size: 22px; } .header p { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  .body { padding: 32px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
  .row span:first-child { color: #6b7280; font-size: 14px; }
  .row span:last-child { font-weight: 600; color: #111827; font-size: 14px; }
  .total { background: #ecfdf5; border-radius: 12px; padding: 20px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
  .total span:first-child { font-size: 16px; font-weight: 700; color: #065f46; }
  .total span:last-child { font-size: 24px; font-weight: 800; color: #059669; }
  .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; }
  @media print { body { padding: 0; } .slip { box-shadow: none; } }
</style></head><body>
<div class="slip">
  <div class="header"><h1>Salary Slip</h1><p>Period: ${range.start} to ${range.end}</p></div>
  <div class="body">
    <div class="row"><span>Worker Name</span><span>${row.worker.name}</span></div>
    <div class="row"><span>Role</span><span>${row.worker.role}</span></div>
    <div class="row"><span>Daily Wage</span><span>${money(Number(row.worker.daily_wage))}</span></div>
    <div class="row"><span>Total Days Worked</span><span>${row.totalDays}</span></div>
    <div class="row"><span>Total Wage</span><span>${money(row.totalWage)}</span></div>
    <div class="row"><span>Overtime Pay</span><span>${money(row.overtimePay)}</span></div>
    <div class="row"><span>Advances Deducted</span><span>${money(row.advancesCut)}</span></div>
    <div class="total"><span>Net Payout</span><span>${money(row.finalPayout)}</span></div>
  </div>
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
</div>
</body></html>`;
}

export function generateWeeklyReportHTML(rows: PayrollRow[], range: PayrollRange): string {
  const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const totalDays = rows.reduce((s, r) => s + r.totalDays, 0);
  const totalWage = rows.reduce((s, r) => s + r.totalWage, 0);
  const totalOT = rows.reduce((s, r) => s + r.overtimePay, 0);
  const totalAdvances = rows.reduce((s, r) => s + r.advancesCut, 0);
  const totalPayout = rows.reduce((s, r) => s + r.finalPayout, 0);

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Weekly Payroll Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; background: #f9fafb; }
  .report { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { background: #2563eb; color: white; padding: 24px 32px; }
  .header h1 { font-size: 22px; } .header p { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; padding: 12px 16px; text-align: left; font-size: 13px; color: #374151; font-weight: 700; }
  td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827; }
  td.amount { font-weight: 600; }
  tr.total-row { background: #ecfdf5; }
  tr.total-row td { font-weight: 800; color: #065f46; border-bottom: none; }
  .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; }
  @media print { body { padding: 0; } .report { box-shadow: none; } }
</style></head><body>
<div class="report">
  <div class="header"><h1>Weekly Payroll Report</h1><p>Period: ${range.start} to ${range.end}</p></div>
  <table>
    <thead><tr><th>Worker</th><th>Role</th><th>Days</th><th>Wage</th><th>OT</th><th>Advances</th><th>Final Payout</th></tr></thead>
    <tbody>
      ${rows.map((r) => `<tr><td>${r.worker.name}</td><td>${r.worker.role}</td><td>${r.totalDays}</td><td class="amount">${money(r.totalWage)}</td><td class="amount">${money(r.overtimePay)}</td><td class="amount">${money(r.advancesCut)}</td><td class="amount" style="color:#059669;font-weight:700">${money(r.finalPayout)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">TOTAL</td><td>${totalDays}</td><td>${money(totalWage)}</td><td>${money(totalOT)}</td><td>${money(totalAdvances)}</td><td>${money(totalPayout)}</td></tr>
    </tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
</div>
</body></html>`;
}
