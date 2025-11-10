import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangelogPage from '../ChangelogPage';
import type { MonitoringChangeLogEntry, MonitoringChangeLogResponse, Store } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual: typeof import('react-router-dom') = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockUseStores = vi.fn();
const mockUseMonitoringChangeLogs = vi.fn();
const mockUseMarkMonitoringChangeLogsRead = vi.fn();
const mockUsePageVisibility = vi.fn();

vi.mock('../../hooks/useStores', () => ({
  useStores: () => mockUseStores(),
}));

vi.mock('../../hooks/useMonitoringChangeLogs', () => ({
  useMonitoringChangeLogs: () => mockUseMonitoringChangeLogs(),
  useMarkMonitoringChangeLogsRead: () => mockUseMarkMonitoringChangeLogsRead(),
}));

vi.mock('../../hooks/usePageVisibility', () => ({
  usePageVisibility: () => mockUsePageVisibility(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePageVisibility.mockReturnValue(true);
  navigateMock.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/changelog']}>
      <ChangelogPage />
    </MemoryRouter>
  );
}

describe('ChangelogPage', () => {
  it('displays loading spinner while change logs load', () => {
    mockUseMarkMonitoringChangeLogsRead.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ updatedIds: [], unreadCounters: [] }),
    });
    const storesResult = {
      data: [] as Store[],
      isLoading: false,
      error: null,
    };

    const changeLogsResult = {
      data: undefined as MonitoringChangeLogResponse | undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
    };

    mockUseStores.mockReturnValue(storesResult);
    mockUseMonitoringChangeLogs.mockReturnValue(changeLogsResult);

    const { container } = renderPage();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders change log entries, acknowledges unread, and handles refresh', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ updatedIds: ['log-new'], unreadCounters: [] });
    mockUseMarkMonitoringChangeLogsRead.mockReturnValue({ mutateAsync });

    const storesResult = {
      data: [
        {
          _id: 'store-1',
          name: 'Fancy Market',
          url: 'fancy.example.com',
          status: 'active' as const,
          pollingInterval: 60,
          lastFetch: new Date(),
          productCount: 10,
        },
      ] as Store[],
      isLoading: false,
      error: null,
    };

    const refetch = vi.fn();
    const entries: MonitoringChangeLogEntry[] = [
      {
        id: 'log-new',
        subscriptionId: 'sub-1',
        scopeType: 'store',
        scope: { storeId: 'store-1' },
        changeType: 'both',
        currentValue: 150,
        previousValue: 120,
        absoluteChange: 30,
        percentageChange: 25,
        detectedAt: new Date('2024-01-05T12:00:00Z'),
        readAt: null,
        isBaseline: false,
      },
      {
        id: 'log-old',
        subscriptionId: 'sub-2',
        scopeType: 'store',
        scope: { storeId: 'store-1' },
        changeType: 'price_down',
        currentValue: 120,
        previousValue: 100,
        absoluteChange: 20,
        percentageChange: 20,
        detectedAt: new Date('2024-01-01T12:00:00Z'),
        readAt: new Date('2024-01-02T12:00:00Z'),
        isBaseline: false,
      },
    ];

    const changeLogsResult = {
      data: {
        entries,
        count: entries.length,
        limit: 200,
        offset: 0,
        unreadCounters: [],
      } as MonitoringChangeLogResponse,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch,
    };

    mockUseStores.mockReturnValue(storesResult);
    mockUseMonitoringChangeLogs.mockReturnValue(changeLogsResult);

    renderPage();

    expect(screen.getByText(/Showing 2 change log entries/i)).toBeInTheDocument();
    expect(screen.getByText(/Most recent update/i)).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Store Fancy Market');
    expect(rows[2]).toHaveTextContent('Store Fancy Market');

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(['log-new']);
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge unread change logs when page is hidden', async () => {
    mockUsePageVisibility.mockReturnValue(false);

    const mutateAsync = vi.fn().mockResolvedValue({ updatedIds: [], unreadCounters: [] });
    mockUseMarkMonitoringChangeLogsRead.mockReturnValue({ mutateAsync });

    const storesResult = {
      data: [] as Store[],
      isLoading: false,
      error: null,
    };

    const entries: MonitoringChangeLogEntry[] = [
      {
        id: 'log-hidden',
        subscriptionId: 'sub-hidden',
        scopeType: 'store',
        scope: { storeId: 'store-hidden' },
        changeType: 'both',
        currentValue: 100,
        previousValue: 90,
        absoluteChange: 10,
        percentageChange: 11.11,
        detectedAt: new Date('2024-01-05T12:00:00Z'),
        readAt: null,
        isBaseline: false,
      },
    ];

    const changeLogsResult = {
      data: {
        entries,
        count: entries.length,
        limit: 200,
        offset: 0,
        unreadCounters: [],
      } as MonitoringChangeLogResponse,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };

    mockUseStores.mockReturnValue(storesResult);
    mockUseMonitoringChangeLogs.mockReturnValue(changeLogsResult);

    renderPage();

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('navigates to subscriptions page when a change log entry is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ updatedIds: [], unreadCounters: [] });
    mockUseMarkMonitoringChangeLogsRead.mockReturnValue({ mutateAsync });

    mockUseStores.mockReturnValue({
      data: [] as Store[],
      isLoading: false,
      error: null,
    });

    const entries: MonitoringChangeLogEntry[] = [
      {
        id: 'log-click',
        subscriptionId: 'sub-click',
        scopeType: 'store',
        scope: { storeId: 'store-click' },
        changeType: 'both',
        currentValue: 100,
        previousValue: 90,
        absoluteChange: 10,
        percentageChange: 11.11,
        detectedAt: new Date('2024-02-01T12:00:00Z'),
        readAt: null,
        isBaseline: false,
      },
    ];

    const changeLogsResult = {
      data: {
        entries,
        count: entries.length,
        limit: 200,
        offset: 0,
        unreadCounters: [],
      } as MonitoringChangeLogResponse,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };

    mockUseMonitoringChangeLogs.mockReturnValue(changeLogsResult);

    renderPage();

    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);

    expect(navigateMock).toHaveBeenCalledWith('/subscriptions?subscriptionId=sub-click&changeLogId=log-click');
  });
});


