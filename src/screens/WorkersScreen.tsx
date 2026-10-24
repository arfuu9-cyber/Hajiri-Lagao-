import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, CheckCircle2, ShieldCheck, Plus, X, UserPlus, HardHat, Clock, ChevronRight } from 'lucide-react';
import { LoadingView } from '@/components/LoadingView';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { WorkerCard } from '@/components/WorkerCard';
import { PrimaryButton, LangToggle } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { fetchWorkers, searchWorkers } from '@/services/workerService';
import { createAdvance } from '@/services/payrollService';
import { useAuth, useTeamId } from '@/context/AuthContext';
import type { Worker } from '@/types/database';

interface WorkersScreenProps {
  isActive: boolean;
  onAddWorker: (initialRole?: string) => void;
  onViewDetail: (workerId: string) => void;
}


export function WorkersScreen({ isActive, onAddWorker, onViewDetail }: WorkersScreenProps) {
  const { t } = useLang();
  const { user, profile } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Advance modal state: worker confirms from their own signed-in account.
  const [advanceWorker, setAdvanceWorker] = useState<Worker | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [advanceNote, setAdvanceNote] = useState('');
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [advanceStep, setAdvanceStep] = useState<'detail' | 'success'>('detail');

  const teamId = useTeamId();
  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchWorkers(teamId);
      setWorkers(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (isActive) {
      loadWorkers();
    }
  }, [isActive, loadWorkers]);

  // Debounced search
  useEffect(() => {
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        loadWorkers();
        return;
      }
      try {
        const results = await searchWorkers(searchQuery);
        setWorkers(results);
      } catch {
        // Keep existing results on search error
      }
    }, 300);
    setSearchTimer(timer);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredWorkers = useMemo(() => workers, [workers]);

  // ---- Advance modal handlers ----
  const handleGiveAdvance = (worker: Worker) => {
    setAdvanceWorker(worker);
    setAdvanceAmount('');
    setAdvanceDate(new Date().toISOString().slice(0, 10));
    setAdvanceNote('');
    setAdvanceError(null);
    setAdvanceStep('detail');
  };

  const closeAdvanceDialog = () => {
    if (advanceLoading) return;
    setAdvanceWorker(null);
    setAdvanceError(null);
    setAdvanceStep('detail');
  };

  const saveAdvance = async () => {
    if (!advanceWorker) return;
    const amount = Number(advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAdvanceError(t('enterAdvanceAmount'));
      return;
    }
    setAdvanceLoading(true);
    setAdvanceError(null);
    try {
      await createAdvance({
        workerId: advanceWorker.id,
        amount,
        date: advanceDate,
        note: advanceNote,
        givenBy: user?.id,
      });
      setAdvanceStep('success');
      await loadWorkers();
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : t('couldNotSave'));
    } finally {
      setAdvanceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-concrete-50">
      <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('workers')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{workers.length} {t('registeredWorkers')}</p>
          </div>
          <LangToggle />
        </div>
      </header>

      <div className="px-5 py-4 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchByNamePhone')}
            className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>
      </div>

      <div className="px-5 py-5 max-w-2xl mx-auto">
        {loading ? (
          <LoadingView message={t('loading')} />
        ) : error ? (
          <ErrorView message={t('couldNotLoad')} onRetry={loadWorkers} />
        ) : filteredWorkers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('noWorkersAdded')}
            description={t('addFirstWorker')}
            actionLabel={t('addNewWorker')}
            onAction={onAddWorker}
          />
        ) : (
          <div className="space-y-4">
            {filteredWorkers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onGiveAdvance={handleGiveAdvance}
                onView={(w) => onViewDetail(w.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Labour toggle: stays reachable above the bottom navigation. */}
      {profile?.role === 'thekedar' && isActive && (
        <>
          {addMenuOpen && (
            <div className="fixed bottom-36 right-4 z-30 flex w-[min(300px,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:right-6">
              <p className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Naya worker add karein</p>
              <button type="button" onClick={() => { setAddMenuOpen(false); onAddWorker('Helper'); }} className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-emerald-50 active:scale-[0.99]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><UserPlus className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block text-sm font-extrabold text-slate-900">Add Mazdoor / Helper</span><span className="mt-0.5 block text-xs text-slate-500">Helper ki details aur daily wage</span></span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
              <button type="button" onClick={() => { setAddMenuOpen(false); onAddWorker('Mason'); }} className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-sky-50 active:scale-[0.99]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-800"><HardHat className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block text-sm font-extrabold text-slate-900">Add Karigar / Mistri</span><span className="mt-0.5 block text-xs text-slate-500">Trade aur daily wage set karein</span></span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-expanded={addMenuOpen}
            aria-label={addMenuOpen ? 'Close add worker menu' : 'Open add worker menu'}
            onClick={() => setAddMenuOpen((open) => !open)}
            className="fixed bottom-28 right-4 z-30 inline-flex min-h-14 items-center gap-3 rounded-2xl bg-[#0057B8] px-5 py-4 text-sm font-extrabold text-white shadow-xl shadow-blue-900/25 transition hover:bg-[#064A98] active:scale-95 sm:right-6"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">{addMenuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</span>
            {addMenuOpen ? 'Close' : 'Add Labor'}
          </button>
        </>
      )}

      {/* Advance modal: record now, worker confirms securely in their own app. */}
      {advanceWorker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeAdvanceDialog}>
          <div className="max-h-[92svh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[28px] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><ShieldCheck className="h-6 w-6" /></span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900">{t('giveAdvanceTitle')}</h2>
                  <p className="truncate text-sm text-slate-500">{advanceWorker.name} · {advanceWorker.phone}</p>
                </div>
              </div>
              <button type="button" onClick={closeAdvanceDialog} disabled={advanceLoading} aria-label="Close" className="rounded-xl p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 disabled:opacity-40">×</button>
            </div>

            {advanceStep === 'detail' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{t('amount')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-extrabold text-slate-400">₹</span>
                    <input autoFocus type="number" min="1" step="1" inputMode="decimal" value={advanceAmount} onChange={(event) => setAdvanceAmount(event.target.value)} placeholder="500" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-10 pr-4 text-xl font-extrabold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{t('date')}</label>
                  <input type="date" value={advanceDate} onChange={(event) => setAdvanceDate(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{t('note')} <span className="font-normal text-slate-400">{t('noteOptional')}</span></label>
                  <textarea value={advanceNote} onChange={(event) => setAdvanceNote(event.target.value)} rows={2} maxLength={250} placeholder="Jaise: ration, travel, dawa" className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-xs leading-5 text-emerald-900">{t('advanceFraudNote')}</p>
                </div>
                {advanceError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{advanceError}</p>}
                <button type="button" onClick={() => void saveAdvance()} disabled={advanceLoading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">
                  {advanceLoading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Kharchi save ho rahi hai…</> : `${t('saveAdvance')} →`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-5 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-9 w-9" /></span>
                <h3 className="mt-4 text-xl font-black text-slate-900">Kharchi record ho gayi</h3>
                <p className="mt-1 text-2xl font-black text-emerald-800">₹{Number(advanceAmount).toLocaleString('en-IN')}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">Mazdoor jab apne Google account se app kholega, to is kharchi ko confirm ya dispute kar sakega. Confirm hone tak ye payroll deduction mein include nahi hogi.</p>
                <div className="mt-5 flex w-full items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Kharchi worker ke linked account se confirm ya dispute hogi.
                </div>
                <button type="button" onClick={closeAdvanceDialog} className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-800 px-5 py-3 font-extrabold text-white hover:bg-emerald-900">Ho gaya</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
