import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../hooks/useStores';
import { useMarkMonitoringChangeLogsRead, useMonitoringChangeLogs } from '../hooks/useMonitoringChangeLogs';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { getMonitoringChangeLogs } from '../services/api';
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
  const [bootstrapUnreadEntries, setBootstrapUnreadEntries] = useState<MonitoringChangeLogEntry[]>([]);
  const isPageVisible = usePageVisibility();
  const {
    data: changeLogResponse,
    isLoading: changeLogsLoading,
    error: changeLogsError,
    refetch: refetchChangeLogs,
  } = useMonitoringChangeLogs(params, true, { refetchInterval: false });
  const knownEntryIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isActive = true;

    const fetchUnreadChangeLogs = async () => {
      try {
        const response = await getMonitoringChangeLogs({ readState: 'unread', limit: 200, offset: 0 });
        if (!isActive) {
          return;
        }
        setBootstrapUnreadEntries(response.entries ?? []);
      } catch {
        if (!isActive) {
          return;
        }
        setBootstrapUnreadEntries([]);
      }
    };

    void fetchUnreadChangeLogs();

    return () => {
      isActive = false;
    };
  }, []);

  const baseEntries = changeLogResponse?.entries ?? [];
  const mergedEntries = useMemo(() => {
    if (!bootstrapUnreadEntries.length) {
      return baseEntries;
    }

    const entryMap = new Map<string, MonitoringChangeLogEntry>();
    baseEntries.forEach((entry) => {
      entryMap.set(entry.id, entry);
    });
    bootstrapUnreadEntries.forEach((entry) => {
      if (!entryMap.has(entry.id)) {
        entryMap.set(entry.id, entry);
      }
    });

    return Array.from(entryMap.values());
  }, [baseEntries, bootstrapUnreadEntries]);

  useEffect(() => {
    const known = knownEntryIdsRef.current;
    mergedEntries.forEach((entry) => {
      known.add(entry.id);
    });
  }, [mergedEntries]);

  useEffect(() => {
    if (!isPageVisible) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | null = null;

    const detectUnreadChanges = async () => {
      if (isCancelled) {
        return;
      }

      try {
        const detectionResponse = await getMonitoringChangeLogs({
          readState: 'unread',
          limit: 1,
          offset: 0,
        });
        const newestUnread = detectionResponse.entries?.[0];

        if (newestUnread && !knownEntryIdsRef.current.has(newestUnread.id)) {
          await refetchChangeLogs();
          const unreadResponse = await getMonitoringChangeLogs({
            readState: 'unread',
            limit: 200,
            offset: 0,
          });
          if (!isCancelled) {
            setBootstrapUnreadEntries(unreadResponse.entries ?? []);
          }
        }
      } catch {
        // ignore detection errors; a future tick will retry
      } finally {
        if (!isCancelled) {
          timeoutId = window.setTimeout(detectUnreadChanges, 5000);
        }
      }
    };

    timeoutId = window.setTimeout(detectUnreadChanges, 5000);

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isPageVisible, refetchChangeLogs]);

  useEffect(() => {
    if (!isPageVisible || changeLogsLoading || mergedEntries.length === 0) {
      return;
    }

    const unreadEntries = mergedEntries.filter((entry) => !entry.readAt);
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
  }, [acknowledgeChangeLogs, changeLogsLoading, isPageVisible, mergedEntries]);

  const storeMap = useMemo(() => {
    if (!stores) {
      return new Map<string, string>();
    }
    return new Map(stores.map((store) => [store._id, store.name]));
  }, [stores]);

  const sortedEntries = useMemo(
    () =>
      [...mergedEntries].sort(
        (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
      ),
    [mergedEntries]
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

