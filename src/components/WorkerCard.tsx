import { Phone, CreditCard, IndianRupee, HandCoins } from 'lucide-react';
import { useLang } from '@/context/LangContext';
import type { Worker } from '@/types/database';

interface WorkerCardProps {
  worker: Worker;
  onAssignNfc?: (worker: Worker) => void;
  onRemoveNfc?: (worker: Worker) => void;
  onGiveAdvance?: (worker: Worker) => void;
}

export function WorkerCard({ worker, onAssignNfc, onRemoveNfc, onGiveAdvance }: WorkerCardProps) {
  const { t } = useLang();
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-24">
          <h3 className="text-lg font-bold text-gray-900 truncate">{worker.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{worker.role}</p>
        </div>
        <span
          className={`shrink-0 ml-3 rounded-full px-3 py-1 text-xs font-medium ${
            worker.nfc_tag_uid
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {worker.nfc_tag_uid ? t('cardAssigned') : t('noCard')}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <IndianRupee className="h-4 w-4 text-gray-400 shrink-0" />
        <span>{Number(worker.daily_wage).toLocaleString('en-IN')} {t('dailyWage')}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <Phone className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="truncate">{worker.phone}</span>
      </div>

      {worker.nfc_tag_uid && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <CreditCard className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="font-mono text-xs truncate">{worker.nfc_tag_uid}</span>
        </div>
      )}

      {(onAssignNfc || onRemoveNfc || onGiveAdvance) && (
        <div className="mt-4 flex gap-3">
          {onAssignNfc && (
            <button
              onClick={() => onAssignNfc(worker)}
              className="flex-1 rounded-lg bg-navy-50 px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
            >
              {worker.nfc_tag_uid ? t('replaceCard') : t('assignNfcCard')}
            </button>
          )}
          {onRemoveNfc && worker.nfc_tag_uid && (
            <button
              onClick={() => onRemoveNfc(worker)}
              className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              {t('remove')}
            </button>
          )}
          {onGiveAdvance && (
            <button onClick={() => onGiveAdvance(worker)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
              <HandCoins className="h-4 w-4" /> {t('giveAdvance')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
