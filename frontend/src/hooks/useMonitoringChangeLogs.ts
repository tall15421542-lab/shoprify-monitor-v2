import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMonitoringChangeLogs,
  markMonitoringChangeLogsRead,
} from '../services/api';
import type {
  MonitoringChangeLogParams,
  MonitoringChangeLogResponse,
  MonitoringUnreadCounter,
} from '../types';

const CHANGE_LOG_QUERY_KEY = ['monitoring', 'change-logs'];

interface UseMonitoringChangeLogsOptions {
  refetchInterval?: number | false;
}

export function useMonitoringChangeLogs(
  params: MonitoringChangeLogParams,
  enabled = true,
  options?: UseMonitoringChangeLogsOptions
) {
  const resolvedRefetchInterval =
    options?.refetchInterval !== undefined
      ? options.refetchInterval
      : enabled
      ? 5000
      : false;

  return useQuery<MonitoringChangeLogResponse>({
    queryKey: [...CHANGE_LOG_QUERY_KEY, params],
    queryFn: () => getMonitoringChangeLogs(params),
    enabled,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    refetchInterval: resolvedRefetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useMarkMonitoringChangeLogsRead() {
  const queryClient = useQueryClient();

  return useMutation<
    { updatedIds: string[]; unreadCounters: MonitoringUnreadCounter[] },
    Error,
    string[]
  >({
    mutationFn: (ids: string[]) => markMonitoringChangeLogsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGE_LOG_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'subscriptions'] });
    },
  });
}


