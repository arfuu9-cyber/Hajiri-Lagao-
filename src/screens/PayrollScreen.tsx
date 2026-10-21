import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, IndianRupee, Share2, FileDown, FileText, MessageCircle, CheckCircle2 } from 'lucide-react';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { useLang } from '@/context/LangContext';
import { useTeamId } from '@/context/AuthContext';
import { fetchPayroll, fetchPayments, recordPayment, exportPayrollCSV, generateWeeklyReportHTML, generateSalarySlipHTML, type PayrollRange } from '@/services/payrollService';
import type { PayrollRow } from '@/types/database';

function getWeekRange(value: string): PayrollRange {
  const selected = new Date(`${value}T00:00:00`);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { start: format(monday), end: format(sunday) };
}

function getMonthRange(value: string): PayrollRange {
  const [y, m] = value.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const last = String(new Date(y, m, 0).getDate()).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}` };
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function PayrollScreen({ isActive }: { isActive: boolean }) {
  const { t } = useLang();
  const teamId = useTeamId();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [paid, setPaid] = useState<Record<string, number>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const range = useMemo(() => (mode === 'month' ? getMonthRange(selectedDate) : getWeekRange(selectedDate)), [selectedDate, mode]);
  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [data, paidMap] = await Promise.all([fetchPayroll(range, teamId), fetchPayments(range)]);
      setRows(data);
      setPaid(paidMap);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, teamId]);

  useEffect(() => {
    if (isActive) loadPayroll();
  }, [isActive, loadPayroll]);

  const totals = useMemo(
    () => rows.reduce(
      (result, row) => ({
        days: result.days + row.totalDays,
        wage: result.wage + row.totalWage,
        overtime: result.overtime + row.overtimePay,
        advances: result.advances + row.advancesCut,
        payout: result.payout + row.finalPayout,
      }),
      { days: 0, wage: 0, overtime: 0, advances: 0, payout: 0 },
    ),
    [rows],
  );

  const shareReport = async () => {
    const html = generateWeeklyReportHTML(rows, range);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
      return;
    }
    if (navigator.share) {
      const report = `Weekly Payroll Report (${range.start} to ${range.end})\n\n${rows.map((row) => `${row.worker.name}: ${row.totalDays} days | ${money(row.finalPayout)}`).join('\n')}\n\nTotal payout: ${money(totals.payout)}`;
      await navigator.share({ title: 'Weekly Payroll Report', text: report });
      return;
    }
    window.print();
  };

  const payWorker = async (row: PayrollRow) => {
    if (!window.confirm(`${row.worker.name} ko ${money(row.finalPayout)} ka bhugtaan kiya?`)) return;
    setPayingId(row.worker.id);
    setPayError(false);
    try {
      await recordPayment({ workerId: row.worker.id, amount: row.finalPayout, range });
      setPaid((prev) => ({ ...prev, [row.worker.id]: row.finalPayout }));
    } catch {
      setPayError(true);
    } finally {
      setPayingId(null);
    }
  };

  const todoPay = rows.filter((r) => r.finalPayout > 0 && paid[r.worker.id] == null);
  const todoTotal = todoPay.reduce((sum, r) => sum + r.finalPayout, 0);
  const payAll = async () => {
    if (todoPay.length === 0) return;
    if (!window.confirm(`${todoPay.length} mazdoor ko kul ${money(todoTotal)} ka bhugtaan kiya?`)) return;
    setPayingId('all');
    setPayError(false);
    try {
      for (const r of todoPay) {
        await recordPayment({ workerId: r.worker.id, amount: r.finalPayout, range });
        setPaid((prev) => ({ ...prev, [r.worker.id]: r.finalPayout }));
      }
    } catch {
      setPayError(true);
    } finally {
      setPayingId(null);
    }
  };

  const shareOnWhatsApp = (row: PayrollRow) => {
    const digits = (row.worker.phone ?? '').replace(/\D/g, '');
    const number = digits.length === 10 ? `91${digits}` : digits;
    const message = [
      '*Hajiri Lagao - Hisaab*',
      `${row.worker.name} (${range.start} se ${range.end})`,
      `Din: ${row.totalDays}`,
      `Mazdoori: ${money(row.totalWage)}`,
      `Overtime: ${money(row.overtimePay)}`,
      `Kharchi katauti: ${money(row.advancesCut)}`,
      `*Final bhugtaan: ${money(row.finalPayout)}*`,
    ].join('\n');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleExportCSV = () => {
    exportPayrollCSV(rows, range);
  };

  const handleSalarySlip = (row: PayrollRow) => {
    const html = generateSalarySlipHTML(row, range);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  return (
    <div className="min-h-screen bg-concrete-50">
      <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('payrollSettlement')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{t('weeklyDihadiCalc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} disabled={loading || rows.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">{t('export')}</span>
            </button>
            <button onClick={shareReport} disabled={loading || rows.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-saffron-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-saffron-600 disabled:bg-gray-300">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('shareWeeklyReport')}</span>
              <span className="sm:hidden">{t('share')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        <section className="rounded-3xl ring-1 ring-navy-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex gap-2 rounded-2xl bg-gray-100 p-1">
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${mode === m ? 'bg-navy-600 text-white shadow' : 'text-gray-500'}`}
              >
                {t(m === 'week' ? 'periodWeek' : 'periodMonth')}
              </button>
            ))}
          </div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CalendarDays className="h-4 w-4 text-navy-600" /> {t('selectDateInWeek')}
          </label>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500" />
          <p className="mt-2 text-sm text-gray-500">{mode === 'month' ? t('periodMonth') : t('week')}: {range.start} {t('to')} {range.end}</p>
        </section>

        {loading ? <LoadingView message={t('calculatingPayroll')} /> : error ? <ErrorView message={t('couldNotCalcPayroll')} onRetry={loadPayroll} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Summary label={t('days')} value={String(totals.days)} />
              <Summary label={t('totalWage')} value={money(totals.wage)} />
              <Summary label={t('overtime')} value={money(totals.overtime)} />
              <Summary label={t('advances')} value={money(totals.advances)} />
              <Summary label={t('finalPayout')} value={money(totals.payout)} highlight />
            </div>
            <section className="space-y-3">
              {payError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t('couldNotSave')}</p>}
              {todoPay.length > 0 && (
                <button type="button" disabled={payingId !== null} onClick={payAll} className="w-full rounded-2xl bg-navy-600 py-3.5 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50">
                  {payingId === 'all' ? '...' : `Sabko bhugtaan karo (${money(todoTotal)})`}
                </button>
              )}
              {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">{t('noWorkersFound')}</div> : rows.map((row) => (
                <article key={row.worker.id} className="rounded-3xl ring-1 ring-navy-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-gray-900">{row.worker.name}</h2>
                      <p className="text-sm text-gray-500">{row.worker.role} · {money(Number(row.worker.daily_wage))}{t('perDay')}</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-lg text-green-700">{money(row.finalPayout)}</strong>
                      <button onClick={() => handleSalarySlip(row)} className="mt-1 flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-700">
                        <FileText className="h-3.5 w-3.5" /> Salary Slip
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <Metric label={t('days')} value={String(row.totalDays)} />
                    <Metric label={t('wage')} value={money(row.totalWage)} />
                    <Metric label={t('overtime')} value={money(row.overtimePay)} />
                    <Metric label={t('advanceCut')} value={money(row.advancesCut)} />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={() => shareOnWhatsApp(row)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </button>
                    {paid[row.worker.id] != null ? (
                      <span className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-50 py-2.5 text-sm font-bold text-green-700 ring-1 ring-green-200">
                        <CheckCircle2 className="h-4 w-4" /> {t('paidDone')} {money(paid[row.worker.id])}
                      </span>
                    ) : (
                      <button type="button" disabled={row.finalPayout <= 0 || payingId !== null} onClick={() => payWorker(row)} className="flex-1 rounded-2xl bg-navy-600 py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40">
                        {payingId === row.worker.id ? '...' : t('markPaid')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Summary({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${highlight ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}><p className="text-xs text-gray-500">{label}</p><p className={`mt-1 text-base font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-gray-50 px-3 py-2"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-semibold text-gray-900">{value}</p></div>;
}
