import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, CreditCard, CheckCircle2, XCircle, Loader2, ChevronRight, ShieldCheck } from 'lucide-react';
import { LoadingView } from '@/components/LoadingView';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { WorkerCard } from '@/components/WorkerCard';
import { PrimaryButton, LangToggle } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { fetchWorkers, searchWorkers, assignNfcTag, removeNfcTag } from '@/services/workerService';
import { createAdvance, sendAdvanceOtp, resendAdvanceOtp, verifyAdvanceOtp } from '@/services/payrollService';
import {
  getNfcAvailability,
  startRealNfcScan,
  simulateNfcScan,
  cancelNfcScan,
  NfcScanCancelledError,
} from '@/services/nfcService';
import { useAuth, useTeamId } from '@/context/AuthContext';
import type { Worker } from '@/types/database';

interface WorkersScreenProps {
  isActive: boolean;
  onAddWorker: () => void;
  onViewDetail: (workerId: string) => void;
}

type AssignState = 'idle' | 'scanning' | 'saving' | 'success' | 'error';

export function WorkersScreen({ isActive, onAddWorker, onViewDetail }: WorkersScreenProps) {
  const { t } = useLang();
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // NFC assignment state
  const [assigningWorker, setAssigningWorker] = useState<Worker | null>(null);
  const [assignState, setAssignState] = useState<AssignState>('idle');
  const [assignMessage, setAssignMessage] = useState('');
  const [showMockAssign, setShowMockAssign] = useState(false);
  const [mockAssignUid, setMockAssignUid] = useState('');

  // Advance modal state
  const [advanceWorker, setAdvanceWorker] = useState<Worker | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [advanceNote, setAdvanceNote] = useState('');
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [advanceStep, setAdvanceStep] = useState<'detail' | 'verify' | 'success'>('detail');
  const [advanceId, setAdvanceId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const nfcAvailability = getNfcAvailability();

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

  useEffect(() => {
    return () => {
      cancelNfcScan();
    };
  }, []);

  const filteredWorkers = useMemo(() => workers, [workers]);

  // ---- Advance modal handlers ----
  const handleGiveAdvance = (worker: Worker) => {
    setAdvanceWorker(worker);
    setAdvanceAmount('');
    setAdvanceDate(new Date().toISOString().slice(0, 10));
    setAdvanceNote('');
    setAdvanceError(null);
    setAdvanceStep('detail');
    setAdvanceId(null);
    setMaskedPhone('');
    setOtpInput('');
  };

  const closeAdvanceDialog = () => {
    setAdvanceWorker(null);
    setAdvanceError(null);
    setAdvanceStep('detail');
    setAdvanceId(null);
    setMaskedPhone('');
    setOtpInput('');
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
      const advance = await createAdvance({
        workerId: advanceWorker.id,
        amount,
        date: advanceDate,
        note: advanceNote,
        givenBy: user?.id,
      });
      setAdvanceId(advance.id);
      setAdvanceLoading(false);
      // Auto-send OTP to worker
      await handleSendOtp(advance.id);
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : t('couldNotSave'));
      setAdvanceLoading(false);
    }
  };

  const handleSendOtp = async (advId: string) => {
    if (!advanceWorker) return;
    setOtpSending(true);
    setAdvanceError(null);
    try {
      const res = await sendAdvanceOtp(advId);
      setMaskedPhone(res.maskedPhone);
      setAdvanceStep('verify');
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : t('couldNotSave'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (!advanceId) return;
    setOtpSending(true);
    setAdvanceError(null);
    try {
      const res = await resendAdvanceOtp(advanceId);
      setMaskedPhone(res.maskedPhone);
      setOtpInput('');
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : t('couldNotSave'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!advanceId) return;
    if (otpInput.trim().length !== 6) {
      setAdvanceError(t('otpSixDigits'));
      return;
    }
    setOtpVerifying(true);
    setAdvanceError(null);
    try {
      await verifyAdvanceOtp(advanceId, otpInput.trim());
      setAdvanceStep('success');
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : t('otpMismatch'));
    } finally {
      setOtpVerifying(false);
    }
  };

  // ---- NFC assignment handlers ----
  const handleAssignNfc = (worker: Worker) => {
    setAssigningWorker(worker);
    setAssignState('idle');
    setAssignMessage('');
    setShowMockAssign(false);
    setMockAssignUid('');
  };

  const closeAssignDialog = () => {
    cancelNfcScan();
    setAssigningWorker(null);
    setAssignState('idle');
    setAssignMessage('');
    setShowMockAssign(false);
    setMockAssignUid('');
  };

  const handleRealScanForAssign = async () => {
    if (!assigningWorker) return;
    setAssignState('scanning');
    setAssignMessage('Hold the NFC card near your phone...');

    try {
      const uid = await startRealNfcScan();
      await saveNfcAssignment(assigningWorker.id, uid);
    } catch (err) {
      if (err instanceof NfcScanCancelledError) {
        setAssignState('idle');
        setAssignMessage('');
      } else {
        setAssignState('error');
        setAssignMessage(err instanceof Error ? err.message : 'Scan failed. Please try again.');
      }
    }
  };

  const handleMockScanForAssign = async () => {
    if (!assigningWorker) return;
    setAssignState('scanning');
    setAssignMessage('Simulating scan...');

    try {
      const uid = await simulateNfcScan(mockAssignUid || undefined);
      await saveNfcAssignment(assigningWorker.id, uid);
    } catch (err) {
      setAssignState('error');
      setAssignMessage(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    }
  };

  const saveNfcAssignment = async (workerId: string, uid: string) => {
    setAssignState('saving');
    setAssignMessage('Saving card assignment...');

    try {
      const updated = await assignNfcTag(workerId, uid);
      setWorkers((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setAssignState('success');
      setAssignMessage('NFC card assigned successfully.');
    } catch (err) {
      setAssignState('error');
      setAssignMessage(err instanceof Error ? err.message : 'Could not assign card.');
    }
  };

  const handleRemoveNfc = async (worker: Worker) => {
    if (!confirm(`Remove NFC card from ${worker.name}?`)) return;

    try {
      const updated = await removeNfcTag(worker.id);
      setWorkers((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not remove card.');
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
                onAssignNfc={handleAssignNfc}
                onRemoveNfc={handleRemoveNfc}
                onGiveAdvance={handleGiveAdvance}
                onView={(w) => onViewDetail(w.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Advance Modal */}
      {advanceWorker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeAdvanceDialog}>
          <div className="w-full rounded-t-2xl bg-white p-6 sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t('giveAdvanceTitle')}</h2>
                <p className="text-sm text-gray-500">{advanceWorker.name} · {advanceWorker.phone}</p>
              </div>
              <button onClick={closeAdvanceDialog} disabled={advanceLoading || otpSending || otpVerifying} className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
            </div>

            {/* Step indicator */}
            {advanceStep !== 'success' && (
              <div className="mb-5 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${advanceStep === 'detail' ? 'bg-saffron-500 text-white' : 'bg-green-500 text-white'}`}>1</div>
                <div className={`h-1 flex-1 rounded-full ${advanceStep === 'verify' ? 'bg-saffron-500' : 'bg-gray-200'}`} />
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${advanceStep === 'verify' ? 'bg-saffron-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                <span className="ml-2 text-xs text-gray-500">{advanceStep === 'detail' ? t('advanceStep1') : t('advanceStep2')}</span>
              </div>
            )}

            {/* Step 1: Detail */}
            {advanceStep === 'detail' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">{t('amount')}</label>
                  <input autoFocus type="number" min="0.01" step="0.01" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="e.g. 500" className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">{t('date')}</label>
                  <input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">{t('note')} <span className="font-normal text-gray-400">{t('noteOptional')}</span></label>
                  <textarea value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} rows={3} placeholder="e.g. Travel expense" className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{t('advanceFraudNote')}</p>
                </div>
                {advanceError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{advanceError}</p>}
                <PrimaryButton onClick={saveAdvance} loading={advanceLoading || otpSending} fullWidth>
                  {advanceLoading ? t('saving') : otpSending ? t('otpSending') : `${t('sendOtpToWorker')} →`}
                </PrimaryButton>
              </div>
            )}

            {/* Step 2: OTP Verify */}
            {advanceStep === 'verify' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">{t('otpSentToWorker')}</p>
                    <p className="text-sm font-bold text-green-800 font-mono mt-0.5">{maskedPhone}</p>
                    <p className="text-xs text-green-700 mt-1">{t('enterWorkerOtp')}</p>
                  </div>
                </div>
                <div>
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 digit OTP"
                    className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-500"
                  />
                </div>
                {advanceError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{advanceError}</p>}
                <PrimaryButton onClick={handleVerifyOtp} loading={otpVerifying} fullWidth>
                  {otpVerifying ? t('otpVerifying') : t('verifyAdvance')}
                </PrimaryButton>
                <button
                  onClick={handleResendOtp}
                  disabled={otpSending}
                  className="w-full text-center text-sm font-semibold text-navy-600 hover:text-navy-700 disabled:opacity-50"
                >
                  {otpSending ? t('otpSending') : t('resendOtpWorker')}
                </button>
              </div>
            )}

            {/* Step 3: Success */}
            {advanceStep === 'success' && (
              <div className="flex flex-col items-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mb-4">
                  <ShieldCheck className="h-9 w-9 text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900 text-center">{t('advanceVerified')}</p>
                <p className="text-sm text-gray-500 mt-1 text-center">
                  {t('amount')}: ₹{Number(advanceAmount).toLocaleString('en-IN')}
                </p>
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3 w-full">
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800 leading-relaxed">{t('onlyVerifiedCounted')}</p>
                </div>
                <button
                  onClick={closeAdvanceDialog}
                  className="mt-6 rounded-xl bg-saffron-500 px-8 py-3 text-sm font-semibold text-white hover:bg-saffron-600 transition-colors"
                >
                  {t('done')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NFC Assignment Modal */}
      {assigningWorker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={closeAssignDialog}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {t('assignNfcCard')}
              </h2>
              <button
                onClick={closeAssignDialog}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3 mb-5">
              <p className="text-sm text-gray-500">{t('workers')}</p>
              <p className="text-base font-bold text-gray-900">{assigningWorker.name}</p>
              <p className="text-sm text-gray-600">{assigningWorker.role}</p>
              {assigningWorker.nfc_tag_uid && (
                <p className="mt-2 text-xs text-gray-500">
                  Current card: <span className="font-mono">{assigningWorker.nfc_tag_uid}</span>
                </p>
              )}
            </div>

            {assignState === 'scanning' && (
              <div className="flex flex-col items-center py-6">
                <Loader2 className="h-10 w-10 text-navy-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700">{assignMessage}</p>
              </div>
            )}

            {assignState === 'saving' && (
              <div className="flex flex-col items-center py-6">
                <Loader2 className="h-10 w-10 text-navy-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700">{assignMessage}</p>
              </div>
            )}

            {assignState === 'success' && (
              <div className="flex flex-col items-center py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mb-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{assignMessage}</p>
                <button
                  onClick={closeAssignDialog}
                  className="mt-4 rounded-xl bg-saffron-500 px-6 py-3 text-sm font-semibold text-white hover:bg-saffron-600 transition-colors"
                >
                  {t('done')}
                </button>
              </div>
            )}

            {assignState === 'error' && (
              <div className="flex flex-col items-center py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-3">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center">{assignMessage}</p>
                <button
                  onClick={() => {
                    setAssignState('idle');
                    setAssignMessage('');
                  }}
                  className="mt-4 rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('retry')}
                </button>
              </div>
            )}

            {assignState === 'idle' && (
              <div className="space-y-4">
                {nfcAvailability === 'available' && (
                  <PrimaryButton onClick={handleRealScanForAssign} fullWidth>
                    <CreditCard className="h-5 w-5" />
                    {t('scanNfcCard')}
                  </PrimaryButton>
                )}

                {nfcAvailability !== 'available' && (
                  <div className="flex items-start gap-3 rounded-xl bg-navy-50 border border-navy-200 px-4 py-3">
                    <p className="text-sm text-navy-800">
                      NFC hardware not available. Use simulate mode below to test.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowMockAssign((s) => !s)}
                  className="w-full text-center text-sm font-semibold text-navy-600 hover:text-navy-700 py-1"
                >
                  {showMockAssign ? t('hideSimulate') : t('simulateScan')}
                </button>

                {showMockAssign && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                    <p className="text-sm text-gray-600">Enter a tag UID or use a random one:</p>
                    <input
                      type="text"
                      value={mockAssignUid}
                      onChange={(e) => setMockAssignUid(e.target.value)}
                      placeholder="e.g. AB12CD34 or leave blank for random"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                    <PrimaryButton onClick={handleMockScanForAssign} fullWidth>
                      {t('simulateAndAssign')}
                    </PrimaryButton>
                  </div>
                )}

                {assigningWorker.nfc_tag_uid && (
                  <button
                    onClick={() => handleRemoveNfc(assigningWorker)}
                    className="w-full text-center text-sm font-semibold text-red-600 hover:text-red-700 py-1"
                  >
                    {t('remove')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
