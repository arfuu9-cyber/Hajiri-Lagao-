import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Nfc,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Loader2,
  Info,
} from 'lucide-react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LoadingView } from '@/components/LoadingView';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { AttendanceSelector } from '@/components/AttendanceSelector';
import { DutyBadge } from '@/components/AttendanceSelector';
import { fetchWorkers, findWorkerByNfcUid } from '@/services/workerService';
import { useTeamId } from '@/context/AuthContext';
import { createAttendance, AttendanceDuplicateError } from '@/services/attendanceService';
import {
  getNfcAvailability,
  startRealNfcScan,
  simulateNfcScan,
  cancelNfcScan,
  NfcScanCancelledError,
} from '@/services/nfcService';
import { formatTimeInKolkata } from '@/utils/date';
import { playBeep } from '@/utils/sound';
import { useLang } from '@/context/LangContext';
import type { Worker, DutyMultiplier } from '@/types/database';

type ScanStatus = 'idle' | 'scanning' | 'found' | 'selecting' | 'recording' | 'success' | 'error' | 'duplicate';

interface ScanResult {
  worker: Worker;
  timeIn: string;
  isMock: boolean;
  dutyMultiplier: DutyMultiplier;
}

interface NfcAttendanceScreenProps {
  onBack: () => void;
}

export function NfcAttendanceScreen({ onBack }: NfcAttendanceScreenProps) {
  const { t } = useLang();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanMessage, setScanMessage] = useState('');
  const [foundWorker, setFoundWorker] = useState<Worker | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DutyMultiplier>(1);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [mockWorkerId, setMockWorkerId] = useState('');
  const [showMockPicker, setShowMockPicker] = useState(false);

  const nfcAvailability = getNfcAvailability();
  const isScanningRef = useRef(false);

  const teamId = useTeamId();
  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    setLoadError(false);
    try {
      const data = await fetchWorkers(teamId);
      setWorkers(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingWorkers(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    return () => {
      cancelNfcScan();
    };
  }, []);

  const resetState = () => {
    setScanStatus('idle');
    setScanMessage('');
    setScanResult(null);
    setFoundWorker(null);
    setSelectedDuty(1);
  };

  const handleRealScan = async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setScanStatus('scanning');
    setScanMessage(t('holdCardNear'));
    setScanResult(null);
    setFoundWorker(null);

    try {
      const uid = await startRealNfcScan();
      await processScannedUid(uid, false);
    } catch (err) {
      if (err instanceof NfcScanCancelledError) {
        setScanStatus('idle');
        setScanMessage('');
      } else {
        setScanStatus('error');
        setScanMessage(
          err instanceof Error ? err.message : t('scanFailed')
        );
      }
    } finally {
      isScanningRef.current = false;
    }
  };

  const handleMockScan = async () => {
    if (!mockWorkerId) return;
    const worker = workers.find((w) => w.id === mockWorkerId);
    if (!worker) return;

    setScanStatus('scanning');
    setScanMessage(t('simulatingScan'));
    setScanResult(null);
    setFoundWorker(null);

    try {
      const uid = await simulateNfcScan(worker.nfc_tag_uid ?? `MOCK-${worker.id.slice(0, 6)}`);
      await processScannedUid(uid, true);
    } catch (err) {
      setScanStatus('error');
      setScanMessage(
        err instanceof Error ? err.message : t('scanFailed')
      );
    }
  };

  const processScannedUid = async (uid: string, isMock: boolean) => {
    setScanStatus('scanning');
    setScanMessage(t('lookingUpWorker'));

    try {
      const worker = await findWorkerByNfcUid(uid);

      if (!worker) {
        playBeep('error');
        setScanStatus('error');
        setScanMessage(t('cardNotAssigned'));
        return;
      }

      playBeep('success');
      setFoundWorker(worker);
      setScanStatus('selecting');
      setScanMessage('');
    } catch (err) {
      setScanStatus('error');
      setScanMessage(
        err instanceof Error ? err.message : t('couldNotRecord')
      );
    }
  };

  const handleConfirmDuty = async () => {
    if (!foundWorker) return;
    setScanStatus('recording');

    try {
      const attendance = await createAttendance(foundWorker.id, 'present', selectedDuty);

      playBeep('success');
      setTimeout(() => playBeep('success'), 150);

      setScanStatus('success');
      setScanResult({
        worker: foundWorker,
        timeIn: formatTimeInKolkata(attendance.time_in),
        isMock: scanStatus === 'selecting' && mockWorkerId === foundWorker.id,
        dutyMultiplier: selectedDuty,
      });
      setScanMessage('');
    } catch (err) {
      if (err instanceof AttendanceDuplicateError) {
        playBeep('error');
        setScanStatus('duplicate');
        setScanMessage(err.message);
      } else {
        playBeep('error');
        setScanStatus('error');
        setScanMessage(
          err instanceof Error ? err.message : t('couldNotRecord')
        );
      }
    }
  };

  const handleCancelScan = () => {
    cancelNfcScan();
    if (scanStatus === 'scanning') {
      setScanStatus('idle');
      setScanMessage('');
    }
    isScanningRef.current = false;
  };

  if (loadingWorkers) {
    return (
      <ScreenWrapper onBack={onBack} title={t('nfcAttendance')}>
        <LoadingView message={t('loading')} />
      </ScreenWrapper>
    );
  }

  if (loadError) {
    return (
      <ScreenWrapper onBack={onBack} title={t('nfcAttendance')}>
        <ErrorView message={t('couldNotLoad')} onRetry={loadWorkers} />
      </ScreenWrapper>
    );
  }

  if (workers.length === 0) {
    return (
      <ScreenWrapper onBack={onBack} title={t('nfcAttendance')}>
        <EmptyState
          icon={Users}
          title={t('noWorkersYet')}
          description={t('addWorkerFirst')}
          actionLabel={t('goBack')}
          onAction={onBack}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper onBack={onBack} title={t('nfcAttendance')}>
      <div className="px-5 py-6 max-w-2xl mx-auto space-y-6">
        {nfcAvailability === 'mock-only' && (
          <div className="flex items-start gap-3 rounded-xl bg-navy-50 border border-navy-200 px-4 py-3">
            <Info className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <p className="text-sm text-navy-800">
              {t('nfcNotAvailable')}
            </p>
          </div>
        )}

        {/* Scanner area */}
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white ring-1 ring-navy-100 p-8 shadow-sm">
          <div className="relative mb-6">
            {scanStatus === 'scanning' && (
              <div className="absolute inset-0 rounded-full bg-navy-200 animate-ping opacity-75" />
            )}
            <div
              className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
                scanStatus === 'success'
                  ? 'bg-green-50'
                  : scanStatus === 'error' || scanStatus === 'duplicate'
                    ? 'bg-red-50'
                    : scanStatus === 'scanning' || scanStatus === 'recording'
                      ? 'bg-navy-50'
                      : scanStatus === 'selecting'
                        ? 'bg-saffron-50'
                        : 'bg-gray-50'
              }`}
            >
              {scanStatus === 'success' ? (
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              ) : scanStatus === 'error' || scanStatus === 'duplicate' ? (
                <XCircle className="h-12 w-12 text-red-500" />
              ) : scanStatus === 'scanning' || scanStatus === 'recording' ? (
                <Loader2 className="h-12 w-12 text-navy-600 animate-spin" />
              ) : (
                <Nfc className="h-12 w-12 text-gray-400" />
              )}
            </div>
          </div>

          {/* Idle state */}
          {scanStatus === 'idle' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                {t('tapWorkerCard')}
              </h2>
              <p className="mt-2 text-sm text-gray-500 text-center max-w-xs">
                {t('tapCardDesc')}
              </p>
            </>
          )}

          {scanStatus === 'scanning' && (
            <p className="text-base font-semibold text-navy-600 text-center">{scanMessage}</p>
          )}

          {scanStatus === 'recording' && (
            <p className="text-base font-semibold text-navy-600 text-center">{t('recordingAttendance')}</p>
          )}

          {/* Worker found → select duty type */}
          {scanStatus === 'selecting' && foundWorker && (
            <div className="w-full text-center">
              <div className="rounded-xl bg-saffron-50 border border-saffron-200 px-5 py-4 inline-block mb-5">
                <p className="text-lg font-bold text-gray-900">{foundWorker.name}</p>
                <p className="text-sm text-gray-600 mt-1">{foundWorker.role}</p>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-3">{t('selectDutyType')}</h3>
              <AttendanceSelector value={selectedDuty} onChange={setSelectedDuty} />
              <div className="mt-5">
                <PrimaryButton onClick={handleConfirmDuty} fullWidth>
                  {t('confirmAttendance')}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Success */}
          {scanStatus === 'success' && scanResult && (
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">{t('attendanceMarked')}</h2>
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-5 py-4 inline-block">
                <p className="text-lg font-bold text-gray-900">{scanResult.worker.name}</p>
                <p className="text-sm text-gray-600 mt-1">{scanResult.worker.role}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <DutyBadge multiplier={scanResult.dutyMultiplier} size="md" />
                </div>
                <p className="text-sm text-gray-700 mt-2 font-medium">
                  {t('time')}: {scanResult.timeIn}
                </p>
              </div>
              {scanResult.isMock && (
                <p className="mt-3 text-xs text-gray-400">
                  {t('simulatedScan')}
                </p>
              )}
            </div>
          )}

          {scanStatus === 'duplicate' && (
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">{t('alreadyMarked')}</h2>
              <p className="mt-2 text-sm text-gray-600 max-w-xs">{scanMessage}</p>
            </div>
          )}

          {scanStatus === 'error' && (
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">{t('scanFailed')}</h2>
              <p className="mt-2 text-sm text-gray-600 max-w-xs">{scanMessage}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {scanStatus === 'scanning' ? (
            <PrimaryButton onClick={handleCancelScan} fullWidth variant="danger">
              {t('cancelScan')}
            </PrimaryButton>
          ) : scanStatus === 'selecting' ? (
            <button
              onClick={resetState}
              className="w-full text-center text-sm font-semibold text-gray-600 hover:text-gray-800 py-2"
            >
              {t('cancel')}
            </button>
          ) : (
            <>
              {nfcAvailability === 'available' && (
                <PrimaryButton onClick={handleRealScan} fullWidth>
                  {t('startNfcScan')}
                </PrimaryButton>
              )}

              <button
                onClick={() => setShowMockPicker((s) => !s)}
                className="w-full text-center text-sm font-semibold text-navy-600 hover:text-navy-700 py-2"
              >
                {showMockPicker ? t('hideSimulate') : t('simulateScan')}
              </button>

              {showMockPicker && (
                <div className="rounded-2xl bg-white ring-1 ring-navy-100 p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    {t('selectWorkerSimulate')}
                  </p>
                  <select
                    value={mockWorkerId}
                    onChange={(e) => setMockWorkerId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 bg-white focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    <option value="">{t('chooseWorker')}</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.role}
                        {w.nfc_tag_uid ? ` (${t('hasCard')})` : ` (${t('noCard')})`}
                      </option>
                    ))}
                  </select>
                  <PrimaryButton
                    onClick={handleMockScan}
                    disabled={!mockWorkerId}
                    fullWidth
                  >
                    {t('simulateAndAssign')}
                  </PrimaryButton>
                </div>
              )}

              {(scanStatus === 'success' || scanStatus === 'error' || scanStatus === 'duplicate') && (
                <button
                  onClick={resetState}
                  className="w-full text-center text-sm font-semibold text-gray-600 hover:text-gray-800 py-2"
                >
                  {t('scanAnother')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Safety note */}
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {t('onePerDay')}
          </p>
        </div>
      </div>
    </ScreenWrapper>
  );
}

function ScreenWrapper({
  children,
  onBack,
  title,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}
