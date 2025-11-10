import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMonitoringChangeLogs,
  useMarkMonitoringChangeLogsRead,
} from '../useMonitoringChangeLogs';
import type { MonitoringChangeLogResponse } from '../../types';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getMonitoringChangeLogs: vi.fn(),
  markMonitoringChangeLogsRead: vi.fn(),
}));

describe('useMonitoringChangeLogs', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('fetches monitoring change logs', async () => {
    const response: MonitoringChangeLogResponse = {
      count: 1,
      limit: 25,
      offset: 0,
      entries: [
        {
          id: 'log-1',
          subscriptionId: 'sub-1',
          scopeType: 'store',
          scope: { storeId: 'store-1' },
          changeType: 'both',
          currentValue: 120,
          previousValue: 100,
          absoluteChange: 20,
          percentageChange: 20,
          detectedAt: new Date('2024-01-01T00:00:00Z'),
          readAt: null,
          isBaseline: false,
        },
      ],
      unreadCounters: [
        {
          subscriptionId: 'sub-1',
          unreadCount: 1,
          updatedAt: new Date('2024-01-01T00:05:00Z'),
        },
      ],
    };

    vi.mocked(api.getMonitoringChangeLogs).mockResolvedValue(response);

    const { result } = renderHook(() => useMonitoringChangeLogs({ limit: 25 }), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(response);
    expect(api.getMonitoringChangeLogs).toHaveBeenCalledWith({ limit: 25 });
  });

  it('does not fetch when disabled', async () => {
    const { result } = renderHook(
      () => useMonitoringChangeLogs({ subscriptionId: 'sub-1' }, false),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isIdle).toBe(true);
    });

    expect(api.getMonitoringChangeLogs).not.toHaveBeenCalled();
  });

  it('marks change logs as read and invalidates caches', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(api.markMonitoringChangeLogsRead).mockResolvedValue({
      updatedIds: ['log-1'],
      unreadCounters: [
        {
          subscriptionId: 'sub-1',
          unreadCount: 0,
          updatedAt: new Date('2024-01-01T00:10:00Z'),
        },
      ],
    });

    const { result } = renderHook(() => useMarkMonitoringChangeLogsRead(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(['log-1']);
    });

    expect(api.markMonitoringChangeLogsRead).toHaveBeenCalledWith(['log-1']);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monitoring', 'change-logs'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monitoring', 'subscriptions'] });
  });
});


