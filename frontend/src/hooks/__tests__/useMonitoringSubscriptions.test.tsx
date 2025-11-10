import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMonitoringSubscriptions,
  useCreateMonitoringSubscription,
  useDeleteMonitoringSubscription,
} from '../useMonitoringSubscriptions';
import type {
  MonitoringSubscription,
  CreateMonitoringSubscriptionInput,
} from '../../types';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getMonitoringSubscriptions: vi.fn(),
  createMonitoringSubscription: vi.fn(),
  deleteMonitoringSubscription: vi.fn(),
}));

describe('useMonitoringSubscriptions', () => {
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

  it('fetches monitoring subscriptions', async () => {
    const mockSubscriptions: MonitoringSubscription[] = [
      {
        id: 'sub-1',
        scopeType: 'store',
        scope: { storeId: 'store-1' },
        changeType: 'both',
        intervalMinutes: 30,
        unreadCount: 2,
        unreadUpdatedAt: new Date('2024-01-01T00:10:00Z'),
      unreadChangeLogs: [],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:05:00Z'),
      },
    ];

    vi.mocked(api.getMonitoringSubscriptions).mockResolvedValue(mockSubscriptions);

    const { result } = renderHook(() => useMonitoringSubscriptions(), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSubscriptions);
    expect(api.getMonitoringSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('creates subscription and invalidates queries', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const input: CreateMonitoringSubscriptionInput = {
      scopeType: 'store',
      scope: { storeId: 'store-1' },
      changeType: 'both',
      intervalMinutes: 45,
    };

    const created: MonitoringSubscription = {
      id: 'sub-new',
      scopeType: 'store',
      scope: { storeId: 'store-1' },
      changeType: 'both',
      intervalMinutes: 45,
      unreadCount: 0,
      unreadUpdatedAt: null,
      unreadChangeLogs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(api.createMonitoringSubscription).mockResolvedValue(created);

    const { result } = renderHook(() => useCreateMonitoringSubscription(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(api.createMonitoringSubscription).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monitoring', 'subscriptions'] });
  });

  it('deletes subscription and invalidates queries', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(api.deleteMonitoringSubscription).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteMonitoringSubscription(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('sub-1');
    });

    expect(api.deleteMonitoringSubscription).toHaveBeenCalledWith('sub-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monitoring', 'subscriptions'] });
  });
});


