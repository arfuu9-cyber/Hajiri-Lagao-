import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Clipboard, Link2, LoaderCircle, QrCode,
  RefreshCw, ScanLine, ShieldCheck, Users, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchWorkers } from '@/services/workerService';
import {
  extractInviteCode,
  fetchTeamConnectionRequests,
  getInviteQrPayload,
  requestTeamConnection,
  reviewTeamConnectionRequest,
  type TeamConnectionRequest,
} from '@/services/teamConnectionService';
import type { Worker } from '@/types/database';
import QRCode from '@/utils/qrcode-vendor';
import QRErrorCorrectLevel from '@/utils/qrcode-vendor/QRErrorCorrectLevel';
import { errText } from '@/utils/errors';

interface TeamConnectionsScreenProps {
  onBack: () => void;
}

const prettyError = (error: unknown) => errText(error) || 'Kuch problem hui. Dobara try karein.';
const phoneDigits = (phone: string | null | undefined) => {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export function TeamConnectionsScreen({ onBack }: TeamConnectionsScreenProps) {
  const { profile, myWorker, reloadMyWorker } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [requests, setRequests] = useState<TeamConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const isThekedar = profile?.role === 'thekedar';

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      if (isThekedar) {
        if (!myWorker?.id) {
          setWorkers([]);
          setRequests([]);
          throw new Error('Thekedar ka profile record nahi mila. Profile/registration complete karke dobara login karein.');
        }
        const [team, incoming] = await Promise.all([
          fetchWorkers(myWorker.id),
          fetchTeamConnectionRequests(),
        ]);
        setWorkers(team.filter((worker) => worker.id !== myWorker.id));
        setRequests(incoming.filter((request) => request.status === 'pending'));
      } else {
        setRequests(await fetchTeamConnectionRequests());
        await reloadMyWorker();
      }
    } catch (err) {
      setError(prettyError(err));
    } finally {
      setLoading(false);
    }
  }, [isThekedar, myWorker?.id, reloadMyWorker]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(false); }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (scanFrameRef.current !== null) window.cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => {
    scanningRef.current = false;
    if (scanFrameRef.current !== null) window.cancelAnimationFrame(scanFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    setCameraError('');
    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setCameraError('Is browser mein QR scan support nahi mila. Neeche 6-character invite code manually daal dein.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access available nahi hai. Invite code manually enter karein.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview open nahi hua.');
      video.srcObject = stream;
      await video.play();
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      scanningRef.current = true;
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const raw = found.find((item) => item.rawValue)?.rawValue;
          if (raw) {
            const foundCode = extractInviteCode(raw);
            if (foundCode) {
              setInviteCode(foundCode);
              setNotice('QR scan ho gaya. Thekedar ka naam verify karne ke liye request bhejein.');
              stopCamera();
              return;
            }
            setCameraError('Ye Hajiri Lagao worker QR nahi hai. Sahi QR scan karein.');
          }
        } catch {
          // A video frame can be undecodable while the camera is starting; keep scanning.
        }
        if (scanningRef.current) scanFrameRef.current = window.requestAnimationFrame(() => { void scan(); });
      };
      void scan();
    } catch (err) {
      stopCamera();
      setCameraError(prettyError(err));
    }
  };

  const sendConnectionRequest = async () => {
    const parsedCode = extractInviteCode(inviteCode);
    if (!parsedCode) {
      setError('6-character code daalo ya thekedar ka QR scan karo.');
      return;
    }
    setRequesting(true);
    setError('');
    setNotice('');
    try {
      const result = await requestTeamConnection(parsedCode);
      setInviteCode('');
      setNotice(result.status === 'approved'
        ? `Aap pehle se ${result.thekedar_name} ke saath linked ho.`
        : `Request ${result.thekedar_name} ko bhej di gayi. Thekedar approve karega tab connection active hoga.`);
      await load(false);
    } catch (err) {
      setError(prettyError(err));
    } finally {
      setRequesting(false);
    }
  };

  const decideConnection = async (request: TeamConnectionRequest, approve: boolean) => {
    let note = '';
    if (approve) {
      const workerPhone = phoneDigits(request.worker_phone);
      const requesterPhone = phoneDigits(request.requester_phone);
      const phoneVerifiedMatch = workerPhone.length === 10 && requesterPhone.length === 10 && workerPhone === requesterPhone;
      if (!phoneVerifiedMatch) {
        const reason = !workerPhone || !requesterPhone
          ? 'Worker ya requester ka phone number missing hai.'
          : 'Request karne wale ka phone, worker record se match nahi kar raha.';
        const ok = window.confirm(`${reason} Approve karne se pehle worker ki identity aur phone personally verify karein. Kya aap phir bhi approve karna chahte hain?`);
        if (!ok) return;
      }
    }
    if (!approve) {
      const input = window.prompt('Request reject karne ka reason (optional):', 'Worker details verify nahi hui');
      if (input === null) return;
      note = input;
    }
    setBusyId(request.request_id);
    setError('');
    setNotice('');
    try {
      await reviewTeamConnectionRequest(request.request_id, approve, note);
      setRequests((current) => current.filter((item) => item.request_id !== request.request_id));
      setNotice(approve
        ? `${request.requester_name} approve ho gaye. Ab woh isi worker profile ke through hajiri request kar sakte hain.`
        : `${request.requester_name} ki connection request reject karke list se hata di gayi.`);
      await load(false);
    } catch (err) {
      setError(prettyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Invite code ${code} copy ho gaya. Sirf sahi worker ko share karein.`);
    } catch {
      setNotice(`Invite code: ${code} — worker ko manually bhej dein.`);
    }
  };

  const workerAlreadyConnected = Boolean(myWorker?.thekedar_id) || requests.some((request) => request.status === 'approved');
  const workerPending = requests.some((request) => request.status === 'pending');

  return (
    <div className="min-h-screen bg-concrete-50 pb-10">
      <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-gray-900">{isThekedar ? 'Team & Invite' : 'Mere Thekedar se Connect'}</h1>
            <p className="text-xs text-gray-500">QR/code + dono taraf ki approval</p>
          </div>
          <button onClick={() => void load()} disabled={loading} aria-label="Refresh connection status" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <section className="rounded-3xl bg-gradient-to-br from-[#0A6B4B] to-[#064E3B] p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h2 className="text-lg font-extrabold">Verified Team Connection</h2>
              <p className="mt-1 text-sm leading-relaxed text-emerald-50">Code ya QR sirf request banata hai. Thekedar ke approve karne tak worker link nahi hoga aur request doosre thekedar ko transfer nahi hogi.</p>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="break-words rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
        {notice && <div role="status" className="break-words rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}

        {isThekedar ? (
          <>
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Users className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-gray-900">Worker connection requests</h2>
                  <p className="text-xs text-gray-500">{requests.length} request pending</p>
                </div>
              </div>
              {loading && <p className="mt-4 text-sm text-gray-500">Requests load ho rahi hain...</p>}
              {!loading && !error && requests.length === 0 && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Abhi koi connection request pending nahi hai.</p>}
              <div className="mt-3 space-y-3">
                {requests.map((request) => (
                  <article key={request.request_id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600">{(request.requester_name || request.worker_name || 'M').slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-gray-900">{request.requester_name || request.worker_name || 'Mazdoor'}</p>
                        <p className="mt-1 text-xs text-gray-500">Worker record: {request.worker_name} · {request.worker_role}</p>
                        <p className="mt-1 text-xs text-gray-600">Worker phone: {request.worker_phone || 'Missing'} · Requester phone: {request.requester_phone || 'Missing'}</p>
                        {(() => {
                          const workerDigits = phoneDigits(request.worker_phone);
                          const requesterDigits = phoneDigits(request.requester_phone);
                          const match = workerDigits.length === 10 && requesterDigits.length === 10 && workerDigits === requesterDigits;
                          return (
                            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${match ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                              {match ? 'Phone number matches' : 'Phone identity needs manual verification'}
                            </p>
                          );
                        })()}
                        <p className="mt-1 text-[11px] text-gray-400">Request: {new Date(request.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={busyId !== null} onClick={() => void decideConnection(request, true)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />{busyId === request.request_id ? '...' : 'Approve'}</button>
                      <button disabled={busyId !== null} onClick={() => void decideConnection(request, false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><QrCode className="h-6 w-6" /></span>
                <div><h2 className="font-extrabold text-gray-900">Apne worker ka invite QR/code</h2><p className="text-xs text-gray-500">Har worker ka alag code hota hai</p></div>
              </div>
              {workers.length === 0 && !loading && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Abhi team mein worker nahi hai. Pehle “Add Labor” se worker add karein.</p>}
              <div className="mt-4 space-y-3">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-extrabold text-emerald-700">{worker.name.trim().slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{worker.name}</p>
                      <p className="text-xs text-gray-500">{worker.role || 'Worker'} · {worker.user_id ? 'Account linked' : 'Invite pending'}</p>
                      <p className="mt-1 font-mono text-sm font-extrabold tracking-[0.2em] text-emerald-800">{worker.invite_code ?? 'Code unavailable'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => setSelectedWorker(worker)} disabled={!worker.invite_code} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-40"><QrCode className="h-3.5 w-3.5"/> QR</button>
                      <button onClick={() => worker.invite_code && void copyCode(worker.invite_code)} disabled={!worker.invite_code} className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-2 text-xs font-bold text-gray-700 disabled:opacity-40"><Clipboard className="h-3.5 w-3.5"/> Copy</button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-gray-400">Invite code personal link jaisa hai. Sirf intended worker ko bhejein. Code milne ke baad bhi link tabhi active hoga jab aap request approve karoge.</p>
            </section>
          </>
        ) : (
          <>
            {workerAlreadyConnected ? (
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-200">
                <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="h-6 w-6"/></span><div><h2 className="font-extrabold text-gray-900">Thekedar se connection active hai</h2><p className="mt-1 text-sm text-gray-500">Aapki hajiri aur kharchi linked team ke through hi jayegi.</p></div></div>
                {requests.filter((r) => r.status === 'approved').slice(0, 1).map((request) => <p key={request.request_id} className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Connected: {request.thekedar_name} · Worker profile: {request.worker_name}</p>)}
              </section>
            ) : (
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Link2 className="h-6 w-6" /></span>
                  <div><h2 className="font-extrabold text-gray-900">Thekedar ko connect karein</h2><p className="text-xs text-gray-500">Thekedar se mila 6-character code enter karein</p></div>
                </div>
                {workerPending && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Aapki pehli connection request pending hai. Thekedar ke response ka intezaar karein.</p>}
                {!workerPending && (
                  <>
                    <label htmlFor="team-invite-code" className="mt-4 block text-sm font-bold text-gray-700">Worker invite code</label>
                    <div className="mt-2 flex gap-2">
                      <input id="team-invite-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={64} placeholder="ABC123" autoCapitalize="characters" className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3.5 font-mono text-lg font-extrabold uppercase tracking-[0.2em] text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                      <button type="button" onClick={() => void startCamera()} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><ScanLine className="h-5 w-5"/> Scan</button>
                    </div>
                    <div className={`mt-3 overflow-hidden rounded-2xl bg-black p-2 ${cameraOn ? 'block' : 'hidden'}`}>
                      <video ref={videoRef} playsInline muted className="max-h-72 w-full rounded-xl object-cover" />
                      <button type="button" onClick={stopCamera} className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-800">Camera band karein</button>
                    </div>
                    {cameraError && <p className="mt-2 text-xs font-semibold text-amber-700">{cameraError}</p>}
                    <button type="button" onClick={() => void sendConnectionRequest()} disabled={requesting || inviteCode.trim().length < 6} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A6B4B] px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-50">{requesting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Link2 className="h-4 w-4"/>}{requesting ? 'Request bhej rahe hain...' : 'Connection request bhejein'}</button>
                    <p className="mt-3 text-xs leading-relaxed text-gray-500">Code se connection automatic nahi hoga. Thekedar worker ka naam check karke approve ya reject karega.</p>
                  </>
                )}
              </section>
            )}

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h2 className="font-extrabold text-gray-900">Connection status</h2>
              {loading && <p className="mt-3 text-sm text-gray-500">Status check ho raha hai...</p>}
              {!loading && !error && requests.length === 0 && !workerAlreadyConnected && <p className="mt-3 text-sm text-gray-500">Abhi koi request nahi hai. Thekedar ka code enter karein ya QR scan karein.</p>}
              <div className="mt-3 space-y-2">
                {requests.map((request) => (
                  <div key={request.request_id} className="rounded-2xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900">{request.thekedar_name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : request.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{request.status === 'approved' ? 'Connected' : request.status === 'rejected' ? 'Rejected' : 'Pending'}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Worker profile: {request.worker_name}</p>
                    {request.review_note && <p className="mt-2 text-xs text-rose-700">Reason: {request.review_note}</p>}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <button type="button" onClick={() => void load()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700"><RefreshCw className="h-4 w-4" /> Status refresh karein</button>
      </main>

      {selectedWorker?.invite_code && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Worker invite QR">
          <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-gray-900">{selectedWorker.name}</h2><p className="text-sm text-gray-500">Invite QR / code</p></div>
              <button onClick={() => setSelectedWorker(null)} aria-label="Close QR" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="mt-4 flex justify-center rounded-2xl bg-white p-3"><QrCanvas code={selectedWorker.invite_code}/></div>
            <p className="mt-3 text-center font-mono text-2xl font-extrabold tracking-[0.3em] text-emerald-800">{selectedWorker.invite_code}</p>
            <p className="mt-2 text-center text-xs text-gray-500">Mazdoor apne app mein is QR ko scan kare ya code manually enter kare.</p>
            <button onClick={() => void copyCode(selectedWorker.invite_code!)} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white"><Clipboard className="mr-2 inline h-4 w-4"/>Copy invite code</button>
          </div>
        </div>
      )}

    </div>
  );
}

function QrCanvas({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !code) return;
    const size = 240;
    canvas.width = size;
    canvas.height = size;
    const qr = new QRCode(0, QRErrorCorrectLevel.M);
    qr.addData(getInviteQrPayload(code));
    qr.make();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    const modules = qr.getModuleCount();
    const quiet = 4;
    const step = size / (modules + quiet * 2);
    ctx.fillStyle = '#111827';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) {
          const x = Math.round((col + quiet) * step);
          const y = Math.round((row + quiet) * step);
          ctx.fillRect(x, y, Math.ceil(step), Math.ceil(step));
        }
      }
    }
  }, [code]);
  return <canvas ref={canvasRef} className="h-60 w-60 max-w-full rounded-xl" aria-label={`QR invite code for ${code}`} />;
}
