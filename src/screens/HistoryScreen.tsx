import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { LoadingView } from '@/components/LoadingView';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { AttendanceRow } from '@/components/AttendanceRow';
import { LangToggle } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { fetchAttendanceHistory } from '@/services/attendanceService';
import { formatDateHeading, formatTimeInKolkata } from '@/utils/date';
import type { AttendanceWithWorker } from '@/types/database';

interface HistoryScreenProps {
  isActive: boolean;
}

export function HistoryScreen({ isActive }: HistoryScreenProps) {
  const { t } = useLang();
  const [records, setRecords] = useState<AttendanceWithWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchAttendanceHistory(200);
      setRecords(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      loadHistory();
    }
  }, [isActive, loadHistory]);

  const groupedRecords = useMemo(() => {
    const filtered = searchQuery.trim()
      ? records.filter((r) => {
          const q = searchQuery.toLowerCase();
          return (
            r.worker.name.toLowerCase().includes(q) ||
            r.worker.role.toLowerCase().includes(q) ||
            r.worker.phone.includes(q)
          );
        })
      : records;

    const grouped = new Map<string, AttendanceWithWorker[]>();
    for (const record of filtered) {
      const dateKey = record.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(record);
    }

    return Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('attendanceHistory')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{t('recordsByDate')}</p>
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
            placeholder={t('searchNameRolePhone')}
            className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>
      </div>

      <div className="px-5 py-5 max-w-2xl mx-auto">
        {loading ? (
          <LoadingView message={t('loading')} />
        ) : error ? (
          <ErrorView message={t('couldNotLoad')} onRetry={loadHistory} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('noAttendanceRecords')}
            description={t('recordsWillAppear')}
          />
        ) : groupedRecords.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t('noMatches')}
            description={t('tryDifferentSearch')}
          />
        ) : (
          <div className="space-y-6">
            {groupedRecords.map(([dateStr, entries]) => (
              <div key={dateStr}>
                <h2 className="text-sm font-bold text-gray-700 mb-2 sticky top-[120px] bg-gray-50 py-1">
                  {formatDateHeading(dateStr)}
                  <span className="ml-2 text-gray-400 font-normal">
                    ({entries.length} {entries.length === 1 ? t('worker') : t('workersPlural')})
                  </span>
                </h2>
                <div className="rounded-2xl bg-white border border-gray-200 px-5 shadow-sm">
                  {entries.map((record) => (
                    <AttendanceRow
                      key={record.id}
                      name={record.worker.name}
                      role={record.worker.role}
                      phone={record.worker.phone}
                      timeIn={formatTimeInKolkata(record.time_in)}
                      status={record.status}
                      dutyMultiplier={record.duty_multiplier}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
