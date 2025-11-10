import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../hooks/useStores';
import { useMarkMonitoringChangeLogsRead, useMonitoringChangeLogs } from '../hooks/useMonitoringChangeLogs';
import { usePageVisibility } from '../hooks/usePageVisibility';
import MonitoringChangeLogTable from '../components/monitoring/MonitoringChangeLogTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import type { MonitoringChangeLogEntry } from '../types';

function ChangelogPage() {
  const navigate = useNavigate();
  const params = useMemo(() => ({ limit: 200, offset: 0 }), []);
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { mutateAsync: acknowledgeChangeLogs } = useMarkMonitoringChangeLogsRead();
  const acknowledgedIdsRef = useRef<Set<string>>(new Set());
  const [highlightedEntryIds, setHighlightedEntryIds] = useState<Set<string>>(new Set());
  const isPageVisible = usePageVisibility();
  const {
    data: changeLogResponse,
    isLoading: changeLogsLoading,
    error: changeLogsError,
  } = useMonitoringChangeLogs(params);

  useEffect(() => {
    if (!isPageVisible || !changeLogResponse || changeLogsLoading) {
      return;
    }

    const unreadEntries = changeLogResponse.entries.filter((entry) => !entry.readAt);
    if (unreadEntries.length === 0) {
      return;
    }

    const idsToAcknowledge = unreadEntries
      .map((entry) => entry.id)
      .filter((id) => !acknowledgedIdsRef.current.has(id));

    if (idsToAcknowledge.length === 0) {
      return;
    }

    setHighlightedEntryIds((prev) => {
      const next = new Set(prev);
      idsToAcknowledge.forEach((id) => next.add(id));
      return next;
    });

    idsToAcknowledge.forEach((id) => acknowledgedIdsRef.current.add(id));

    void acknowledgeChangeLogs(idsToAcknowledge).catch(() => {
      idsToAcknowledge.forEach((id) => acknowledgedIdsRef.current.delete(id));
    });
  }, [acknowledgeChangeLogs, changeLogResponse, changeLogsLoading, isPageVisible]);

  const storeMap = useMemo(() => {
    if (!stores) {
      return new Map<string, string>();
    }
    return new Map(stores.map((store) => [store._id, store.name]));
  }, [stores]);

  const entries = changeLogResponse?.entries ?? [];
  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
      ),
    [entries]
  );

  const handleEntryClick = useCallback(
    (entry: MonitoringChangeLogEntry) => {
      const search = new URLSearchParams({
        subscriptionId: entry.subscriptionId,
        changeLogId: entry.id,
      });
      navigate(`/subscriptions?${search.toString()}`);
    },
    [navigate]
  );

  const latestTimestamp = sortedEntries[0]?.detectedAt ?? null;
  const totalEntries = changeLogResponse?.count ?? sortedEntries.length;
  const isLoading = changeLogsLoading || (storesLoading && !stores);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Monitoring Change Log</h1>
        <p className="text-gray-600">
          Review the most recent subscription-driven changes across all monitored scopes. Entries are ordered by detected time (newest first).
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Showing {sortedEntries.length} change log {sortedEntries.length === 1 ? 'entry' : 'entries'}.
              {totalEntries > sortedEntries.length && (
                <> (Total available: {totalEntries})</>
              )}
            </p>
            <p className="text-xs text-gray-500">
              Most recent update:{' '}
              {latestTimestamp ? latestTimestamp.toLocaleString() : 'N/A'}
            </p>
            {storesError && (
              <p className="text-xs text-amber-600 mt-2">
                Unable to load store names. Displaying scope identifiers instead.
              </p>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[240px]">
          <LoadingSpinner size={48} />
        </div>
      ) : changeLogsError ? (
        <ErrorMessage message="Failed to load monitoring change logs. Please try again." />
      ) : (
        <MonitoringChangeLogTable
          entries={sortedEntries}
          storeNameLookup={(storeId) => storeMap.get(storeId)}
          highlightedEntryIds={highlightedEntryIds}
          onEntryClick={handleEntryClick}
        />
      )}
    </div>
  );
}

export default ChangelogPage;

