import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StoreCard from './StoreCard';
import type { Store } from '../../types';

const mockStore: Store = {
  _id: '123',
  name: 'Test Store',
  url: 'test.myshopify.com',
  status: 'active',
  pollingInterval: 24,
  productCount: 50,
  lastFetch: new Date('2024-01-01T12:00:00Z'),
};

const mockNavigate = vi.fn();
const mockShowToast = vi.fn();
const mockDeactivateStore = vi.fn();
const mockActivateStore = vi.fn();
const mockUpdateStore = vi.fn();

vi.mock('../monitoring/MonitoringSubscribeButton', () => ({
  __esModule: true,
  default: (props: any) => (
    <button type="button">{props.label}</button>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../common/ToastContainer', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock('../../services/api', () => ({
  updateStore: (...args: unknown[]) => mockUpdateStore(...(args as [string])),
  deactivateStore: (...args: unknown[]) => mockDeactivateStore(...(args as [string])),
  activateStore: (...args: unknown[]) => mockActivateStore(...(args as [string])),
}));

describe('StoreCard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockShowToast.mockReset();
    mockDeactivateStore.mockReset();
    mockActivateStore.mockReset();
    mockUpdateStore.mockReset();
  });

  it('displays store information', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Store')).toBeInTheDocument();
    expect(screen.getByText('test.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('50 products')).toBeInTheDocument();
    expect(screen.getByText('Every 24 hours')).toBeInTheDocument();
  });

  it('shows subscribe label when monitoring is not active', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('shows subscribed label when monitoring is active', () => {
    const subscribedStore: Store = {
      ...mockStore,
      monitoring: {
        store: { subscribed: true },
      },
    };

    render(
      <BrowserRouter>
        <StoreCard store={subscribedStore} />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /subscribed/i })).toBeInTheDocument();
  });

  it('does not render status badge for active store', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('does not render status badge for inactive store', () => {
    const inactiveStore = { ...mockStore, status: 'inactive' as const };
    render(
      <BrowserRouter>
        <StoreCard store={inactiveStore} />
      </BrowserRouter>
    );

    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('renders error badge when status is error', () => {
    const errorStore = { ...mockStore, status: 'error' as const };
    render(
      <BrowserRouter>
        <StoreCard store={errorStore} />
      </BrowserRouter>
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('handles click to navigate to products', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    const card = screen.getByText('Test Store').closest('div')?.parentElement;
    fireEvent.click(card!);

    expect(mockNavigate).toHaveBeenCalledWith('/stores/123/products');
  });

  it('displays last fetch time', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('handles missing product count', () => {
    const storeWithoutCount = { ...mockStore, productCount: undefined };
    render(
      <BrowserRouter>
        <StoreCard store={storeWithoutCount} />
      </BrowserRouter>
    );

    expect(screen.getByText('0 products')).toBeInTheDocument();
  });

  it('deactivates store after confirmation', async () => {
    mockDeactivateStore.mockResolvedValue({ message: 'Store marked inactive successfully' });
    const onUpdate = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <BrowserRouter>
        <StoreCard store={mockStore} onUpdate={onUpdate} />
      </BrowserRouter>
    );

    const deactivateButton = screen.getByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      expect(mockDeactivateStore).toHaveBeenCalledWith('123');
    });
    expect(onUpdate).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Test Store deactivated');

    confirmSpy.mockRestore();
  });

  it('does not deactivate store when confirmation is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    const deactivateButton = screen.getByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateButton);

    expect(mockDeactivateStore).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('enables inactive store', async () => {
    mockActivateStore.mockResolvedValue({ message: 'Store reactivated successfully' });
    mockUpdateStore.mockResolvedValue({
      pollResult: { products_saved: 42 },
      aggregationResult: { store_averages: 1, tag_averages: 1, store_tag_averages: 1 },
    });
    const inactiveStore = { ...mockStore, status: 'inactive' as const };
    const onUpdate = vi.fn();

    render(
      <BrowserRouter>
        <StoreCard store={inactiveStore} onUpdate={onUpdate} />
      </BrowserRouter>
    );

    const enableButton = screen.getByRole('button', { name: /enable/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockActivateStore).toHaveBeenCalledWith('123');
      expect(mockUpdateStore).toHaveBeenCalledWith('123');
    });
    expect(onUpdate).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Test Store enabled and refreshed (42 products)');
  });

  it('does not show deactivate button for inactive store', () => {
    const inactiveStore = { ...mockStore, status: 'inactive' as const };

    render(
      <BrowserRouter>
        <StoreCard store={inactiveStore} />
      </BrowserRouter>
    );

    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });
});

