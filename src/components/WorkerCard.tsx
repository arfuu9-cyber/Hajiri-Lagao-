import { Phone, IndianRupee, HandCoins, Nfc, ChevronRight, MessageCircle } from 'lucide-react';
import { useLang } from '@/context/LangContext';
import type { Worker } from '@/types/database';

interface WorkerCardProps {
  worker: Worker;
  onAssignNfc?: (worker: Worker) => void;
  onRemoveNfc?: (worker: Worker) => void;
  onGiveAdvance?: (worker: Worker) => void;
  onView?: (worker: Worker) => void;
}

export function WorkerCard({ worker, onAssignNfc, onRemoveNfc, onGiveAdvance, onView }: WorkerCardProps) {
  const { t } = useLang();
  const initial = worker.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
      <div className="flex items-center gap-3">
        {worker.profile_photo_url ? (
          <img src={worker.profile_photo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-500 to-navy-700 text-xl font-extrabold text-white">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-gray-900">{worker.name}</h3>
          <p className="text-sm text-gray-500">{worker.role}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            worker.nfc_tag_uid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Nfc className="h-3.5 w-3.5" />
          {worker.nfc_tag_uid ? t('cardAssigned') : t('noCard')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-700">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-concrete-50 px-3 py-1.5">
          <IndianRupee className="h-4 w-4 text-saffron-500" />
          {Number(worker.daily_wage).toLocaleString('en-IN')} {t('dailyWage')}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-concrete-50 px-3 py-1.5">
          <Phone className="h-4 w-4 shrink-0 text-navy-500" />
          <span className="truncate">{worker.phone}</span>
        </span>
      </div>

      {worker.invite_code && !worker.user_id && onAssignNfc && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-saffron-50 px-4 py-3 ring-1 ring-saffron-200">
          <div>
            <p className="text-xs text-gray-600">{t('inviteShareTitle')}</p>
            <p className="text-lg font-extrabold tracking-[0.25em] text-gray-900">{worker.invite_code}</p>
          </div>
          <a
            href={`https://wa.me/${(worker.phone ?? '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hajiri Lagao app me Mazdoor ban kar register karo. Mera code: ${worker.invite_code}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-2 text-sm font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" /> {t('shareInvite')}
          </a>
        </div>
      )}

      {onView && (
        <button
          onClick={() => onView(worker)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-concrete-50 px-4 py-3 text-sm font-semibold text-navy-700"
        >
          {t('viewDetails')}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {(onAssignNfc || onRemoveNfc || onGiveAdvance) && (
        <div className="mt-4 flex gap-2">
          {onAssignNfc && (
            <button
              onClick={() => onAssignNfc(worker)}
              className="flex-1 rounded-2xl bg-navy-50 px-4 py-3 text-sm font-bold text-navy-700 transition-colors hover:bg-navy-100"
            >
              {worker.nfc_tag_uid ? t('replaceCard') : t('assignNfcCard')}
            </button>
          )}
          {onRemoveNfc && worker.nfc_tag_uid && (
            <button
              onClick={() => onRemoveNfc(worker)}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              {t('remove')}
            </button>
          )}
          {onGiveAdvance && (
            <button
              onClick={() => onGiveAdvance(worker)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-saffron-50 px-4 py-3 text-sm font-bold text-saffron-700 transition-colors hover:bg-saffron-100"
            >
              <HandCoins className="h-4 w-4" /> {t('giveAdvance')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
