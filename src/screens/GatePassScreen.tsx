import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, QrCode, Download, Users, Clock, CheckCircle2, ScanLine, X, User, Phone, CreditCard, Share2, Volume2, VolumeX } from 'lucide-react';
import { useLang } from '@/context/LangContext';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { fetchThekedarWorkers, markBatchAttendance, createGatePass } from '@/services/gatePassService';
import { fetchWorkers } from '@/services/workerService';
import { supabase } from '@/services/supabase';
import { playBeep } from '@/utils/sound';
import type { Worker } from '@/types/database';

interface GatePassScreenProps {
  onBack: () => void;
  mode: 'thekedar' | 'gatekeeper';
}

export function GatePassScreen({ onBack, mode }: GatePassScreenProps) {
  const { t } = useLang();
  const thekedar = mode === 'thekedar';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-navy-700 to-navy-900 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-navy-200 hover:bg-navy-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">
              {thekedar ? t('gatePassThekedar') : t('gatePassScanner')}
            </h1>
            <p className="text-xs text-navy-300">
              {thekedar ? t('gatePassThekedarDesc') : t('gatePassScannerDesc')}
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-6 max-w-2xl mx-auto">
        {thekedar ? <ThekedarView t={t} /> : <GatekeeperView t={t} />}
      </div>
    </div>
  );
}

/* ===================== THEKEDAR VIEW ===================== */

function ThekedarView({ t }: { t: (key: string) => string }) {
  const { profile, myWorker } = useAuth();
  const [thekedarId, setThekedarId] = useState<string | null>(null);
  const [thekedarName, setThekedarName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    initThekedar();
  }, []);

  const initThekedar = async () => {
    setLoading(true);
    try {
      if (myWorker) {
        const team = await fetchWorkers(myWorker.id);
        setThekedarId(myWorker.id);
        setThekedarName(myWorker.name);
        setAllWorkers(team);
        setSelectedIds(new Set(team.map((w) => w.id)));
      } else {
        const workers = await fetchWorkers();
        const firstWorker = workers[0];
        if (firstWorker) {
          setThekedarId(firstWorker.id);
          setThekedarName(firstWorker.name);
          setAllWorkers(workers);
          setSelectedIds(new Set(workers.map((w) => w.id)));
        }
      }
    } catch {
      // no workers yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (thekedarId && canvasRef.current) {
      drawQRCode(canvasRef.current, thekedarId);
    }
  }, [thekedarId]);

  const toggleWorker = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allWorkers.map((w) => w.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleShare = async () => {
    const selected = allWorkers.filter((w) => selectedIds.has(w.id));
    if (selected.length === 0 || !thekedarId) return;

    const lines = selected.map((w, i) =>
      `${i + 1}. ${w.name} — ${w.role} — ${w.phone}`
    );
    const text = `${t('gatePassThekedar')}: ${thekedarName}\n${t('associatedWorkers')} (${selected.length}):\n${lines.join('\n')}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: t('gatePassThekedar'), text });
        setShareStatus(t('sharedSuccessfully'));
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareStatus(t('copiedToClipboard'));
      } catch {
        setShareStatus(t('shareFailed'));
      }
    }
    setTimeout(() => setShareStatus(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-navy-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (!thekedarId) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Users className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">{t('noThekedarFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Code card */}
      <div className="rounded-3xl bg-white ring-1 ring-navy-100 p-6 shadow-sm text-center">
        <p className="text-sm font-medium text-gray-500 mb-1">{t('yourThekedarId')}</p>
        <p className="text-lg font-bold text-navy-900 mb-4">{thekedarName}</p>

        <div className="flex justify-center mb-4">
          <div className="rounded-2xl bg-white border-2 border-navy-200 p-4">
            <canvas ref={canvasRef} width={200} height={200} className="rounded-lg" />
          </div>
        </div>

        <p className="text-xs text-gray-400">{t('qrCodeDesc')}</p>
      </div>

      {/* Worker selection */}
      <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {t('selectWorkers')} ({selectedIds.size}/{allWorkers.length})
          </h3>
          <div className="flex gap-3 text-xs font-medium">
            <button onClick={selectAll} className="text-saffron-600 hover:text-saffron-700">
              {t('selectAll')}
            </button>
            <button onClick={deselectAll} className="text-gray-400 hover:text-gray-500">
              {t('deselectAll')}
            </button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {allWorkers.map((w, i) => {
            const checked = selectedIds.has(w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggleWorker(w.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${
                  checked ? 'bg-saffron-50' : 'bg-white hover:bg-gray-50'
                } ${i > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 ${
                  checked ? 'border-saffron-500 bg-saffron-500' : 'border-gray-300'
                }`}>
                  {checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.role} · {w.phone}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={handleShare}
          disabled={selectedIds.size === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy-700 py-3.5 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition-colors"
        >
          <Share2 className="h-5 w-5" />
          {t('shareWorkerDetails')} ({selectedIds.size})
        </button>

        {shareStatus && (
          <p className="text-center text-sm font-medium text-green-600">{shareStatus}</p>
        )}

        <button
          onClick={() => {
            if (canvasRef.current) {
              const link = document.createElement('a');
              link.download = `gate-pass-${thekedarId.slice(0, 8)}.png`;
              link.href = canvasRef.current.toDataURL();
              link.click();
            }
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-5 w-5" />
          {t('downloadQr')}
        </button>
      </div>
    </div>
  );
}

/* ===================== GATEKEEPER VIEW ===================== */

function GatekeeperView({ t }: { t: (key: string) => string }) {
  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [thekedar, setThekedar] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [markedCount, setMarkedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const beep = (type: 'success' | 'error') => {
    if (soundOn) playBeep(type);
  };

  const startScan = async () => {
    setError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      scanLoop();
    } catch {
      setError(t('cameraError'));
      setScanning(false);
    }
  };

  const stopScan = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const scanLoop = () => {
    if (!scanning || !videoRef.current) return;
    requestAnimationFrame(scanLoop);
  };

  const handleScan = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        beep('error');
        setError(t('thekedarNotFound'));
        return;
      }

      beep('success');
      setThekedar(data as Worker);
      setScannedId(id);
      stopScan();

      const associatedWorkers = await fetchThekedarWorkers(id);
      setWorkers(associatedWorkers);
    } catch {
      beep('error');
      setError(t('gateScanFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!scannedId || workers.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const workerIds = workers.map((w) => w.id);
      const count = await markBatchAttendance(workerIds);
      await createGatePass(scannedId, workerIds);
      setMarkedCount(count);
      setApproved(true);
      // Conductor-style confirmation beeps
      beep('success');
      setTimeout(() => beep('success'), 200);
    } catch {
      beep('error');
      setError(t('approveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScannedId(null);
    setThekedar(null);
    setWorkers([]);
    setApproved(false);
    setMarkedCount(0);
    setError(null);
    setManualId('');
  };

  if (approved) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4 animate-pulse">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('entryApproved')}</h2>
        <p className="text-sm text-gray-500 mb-1">
          {t('workersMarked')} {markedCount} / {workers.length}
        </p>
        <p className="text-xs text-gray-400 mb-6">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* Summary of marked workers */}
        <div className="w-full rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden mb-6 text-left">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('entryLog')}</h3>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {workers.map((w, i) => (
              <div key={w.id} className={`flex items-center gap-3 px-5 py-3 ${i % 2 === 0 ? 'bg-green-50' : 'bg-white'}`}>
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.role} · {w.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <PrimaryButton onClick={reset} fullWidth>
          {t('scanAnotherGate')}
        </PrimaryButton>
      </div>
    );
  }

  if (scannedId && thekedar) {
    return (
      <div className="space-y-5">
        {/* Thekedar info */}
        <div className="rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100">
              <Users className="h-6 w-6 text-navy-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{thekedar.name}</p>
              <p className="text-sm text-gray-500">{thekedar.phone} · {thekedar.role}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                {t('verified')}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed worker list */}
        <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('associatedWorkersList')} ({workers.length})</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {workers.map((w, i) => (
              <div key={w.id} className={`px-5 py-4 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy-600 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-900">{w.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-500">{w.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {w.role}
                        {w.aadhaar_number ? ` · Aadhaar: ****${w.aadhaar_number.slice(-4)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <PrimaryButton onClick={handleApprove} loading={loading} className="flex-1">
            {t('approveEntry')}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sound toggle */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {soundOn ? t('soundOn') : t('soundOff')}
        </button>
      </div>

      {scanning && (
        <div className="rounded-2xl border border-gray-300 overflow-hidden relative">
          <video ref={videoRef} autoPlay playsInline className="w-full" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-saffron-400 rounded-2xl h-48 w-48 opacity-70">
              <ScanLine className="h-full w-full text-saffron-400 animate-pulse" />
            </div>
          </div>
          <button
            onClick={stopScan}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {!scanning && (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-navy-100 mb-4">
            <QrCode className="h-10 w-10 text-navy-600" />
          </div>
          <p className="text-sm text-gray-500 mb-6">{t('scanQrDesc')}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!scanning && (
        <PrimaryButton onClick={startScan} fullWidth>
          {t('startScan')}
        </PrimaryButton>
      )}

      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm font-semibold text-gray-600 mb-3">{t('manualEntry')}</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder={t('enterThekedarId')}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
          <button
            onClick={() => manualId.trim() && handleScan(manualId.trim())}
            disabled={!manualId.trim() || loading}
            className="rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition-colors"
          >
            {t('verify')}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function drawQRCode(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  const modules = 21;
  const cellSize = size / modules;

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  ctx.fillStyle = '#000';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      const isCorner = (x < 7 && y < 7) || (x >= modules - 7 && y < 7) || (x < 7 && y >= modules - 7);
      if (isCorner) {
        if (x === 0 || y === 0 || x === 6 || y === 6 ||
            (x < 7 && y < 7 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)))) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else if (x >= modules - 7 && (x === modules - 7 || x === modules - 1 || y === 0 || y === 6 || (x >= modules - 5 && x <= modules - 3 && y >= 2 && y <= 4))) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else if (y >= modules - 7 && (y === modules - 7 || y === modules - 1 || x === 0 || x === 6 || (y >= modules - 5 && y <= modules - 3 && x >= 2 && x <= 4))) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
        continue;
      }

      const bit = (hash >> ((y * modules + x) % 31)) & 1;
      if (bit) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}
