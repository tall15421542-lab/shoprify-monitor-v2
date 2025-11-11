import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonitoringSubscriptionsPage from '../MonitoringSubscriptionsPage';
import type { MonitoringSubscription, Store } from '../../types';

const mockUseMonitoringSubscriptions = vi.fn();
const mockUseCreateMonitoringSubscription = vi.fn();
const mockUseUpdateMonitoringSubscription = vi.fn();
const mockUseDeleteMonitoringSubscription = vi.fn();
const mockUseStores = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../hooks/useMonitoringSubscriptions', () => ({
  useMonitoringSubscriptions: () => mockUseMonitoringSubscriptions(),
  useCreateMonitoringSubscription: () => mockUseCreateMonitoringSubscription(),
  useUpdateMonitoringSubscription: () => mockUseUpdateMonitoringSubscription(),
  useDeleteMonitoringSubscription: () => mockUseDeleteMonitoringSubscription(),
}));

vi.mock('../../hooks/useStores', () => ({
  useStores: () => mockUseStores(),
}));

vi.mock('../../components/common/ToastContainer', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const baseSubscription: MonitoringSubscription = {
  id: 'sub-1',
  scopeType: 'store',
  scope: { storeId: 'store-1' },
  changeType: 'both',
  unreadCount: 0,
  unreadUpdatedAt: null,
  unreadChangeLogs: [],
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const baseStore: Store = {
  _id: 'store-1',
  name: 'Example Store',
  url: 'example.myshopify.com',
  status: 'active',
  pollingInterval: 60,
  productCount: 10,
  lastFetch: new Date('2024-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/subscriptions']}>
      <MonitoringSubscriptionsPage />
    </MemoryRouter>
  );
}

describe('MonitoringSubscriptionsPage', () => {
  it('renders list and allows opening create modal', () => {
    mockUseMonitoringSubscriptions.mockReturnValue({
      data: [baseSubscription],
      isLoading: false,
      error: null,
    });
    mockUseStores.mockReturnValue({
      data: [baseStore],
      isLoading: false,
      error: null,
    });
    mockUseCreateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
    mockUseUpdateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
    mockUseDeleteMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });

    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Monitoring Subscriptions/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Example Store/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByText(/Add Subscription/i)).toBeInTheDocument();
  });

  it('submits create form with store scope', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined);
    mockUseMonitoringSubscriptions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mockUseStores.mockReturnValue({
      data: [baseStore],
      isLoading: false,
      error: null,
    });
    mockUseCreateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: createMutate,
    });
    mockUseUpdateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mockUseDeleteMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /add subscription/i }));

    fireEvent.change(screen.getByLabelText(/store id/i), {
      target: { value: 'store-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: 'store',
          scope: { storeId: 'store-1' },
          changeType: 'both',
        })
      );
    });
  });

  it('handles delete action', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    mockUseMonitoringSubscriptions.mockReturnValue({
      data: [baseSubscription],
      isLoading: false,
      error: null,
    });
    mockUseStores.mockReturnValue({
      data: [baseStore],
      isLoading: false,
      error: null,
    });
    mockUseCreateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mockUseUpdateMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mockUseDeleteMonitoringSubscription.mockReturnValue({
      isPending: false,
      mutateAsync: deleteMutate,
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    fireEvent.click(screen.getByLabelText(/remove subscription/i));

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith('sub-1');
    });
  });
});


