import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StoresPage from '../StoresPage';
import { ToastProvider } from '../../components/common/ToastContainer';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  updateAllStores: vi.fn(),
}));

// Mock useStores hook
const mockRefetch = vi.fn();
const mockUseStores = vi.fn(() => ({
  data: [],
  isLoading: false,
  error: null,
  refetch: mockRefetch,
}));

const mockUseAddStore = vi.fn(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('../../hooks/useStores', () => ({
  useStores: () => mockUseStores(),
  useAddStore: () => mockUseAddStore(),
}));

const renderStoresPage = () => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <StoresPage />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('StoresPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    renderStoresPage();
    expect(screen.getByText('Stores')).toBeInTheDocument();
  });

  it('renders Update All Stores button', () => {
    renderStoresPage();
    expect(screen.getByRole('button', { name: /update all stores/i })).toBeInTheDocument();
  });

  it('renders Add Store button', () => {
    renderStoresPage();
    expect(screen.getByRole('button', { name: /add store/i })).toBeInTheDocument();
  });

  it('disables Update All button when no stores exist', () => {
    mockUseStores.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    expect(updateButton).toBeDisabled();
  });

  it('enables Update All button when stores exist', () => {
    mockUseStores.mockReturnValue({
      data: [
        {
          _id: '1',
          name: 'Store 1',
          url: 'store1.myshopify.com',
          status: 'active',
          pollingInterval: 60,
          productCount: 50,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    expect(updateButton).not.toBeDisabled();
  });

  it('updates all stores when Update All button is clicked', async () => {
    const mockStores = [
      {
        _id: '1',
        name: 'Store 1',
        url: 'store1.myshopify.com',
        status: 'active' as const,
        pollingInterval: 60,
        productCount: 50,
      },
      {
        _id: '2',
        name: 'Store 2',
        url: 'store2.myshopify.com',
        status: 'active' as const,
        pollingInterval: 60,
        productCount: 75,
      },
    ];

    mockUseStores.mockReturnValue({
      data: mockStores,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const mockUpdateResult = {
      pollResult: {
        total_stores: 2,
        successful_stores: 2,
        failed_stores: 0,
        total_products: 125,
      },
      aggregationResult: {
        store_averages: 2,
        tag_averages: 5,
        store_tag_averages: 8,
      },
    };

    (api.updateAllStores as any).mockResolvedValue(mockUpdateResult);

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    fireEvent.click(updateButton);
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
    
    // Should call the API
    await waitFor(() => {
      expect(api.updateAllStores).toHaveBeenCalled();
    });
    
    // Should call refetch to refresh the store list
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    
    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/Updated 2 stores, 125 products/i)).toBeInTheDocument();
    });
  });

  it('shows error toast when update fails', async () => {
    mockUseStores.mockReturnValue({
      data: [
        {
          _id: '1',
          name: 'Store 1',
          url: 'store1.myshopify.com',
          status: 'active' as const,
          pollingInterval: 60,
          productCount: 50,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const mockError = {
      response: {
        data: { error: 'Network error' },
      },
    };

    (api.updateAllStores as any).mockRejectedValue(mockError);

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    fireEvent.click(updateButton);
    
    // Wait for error to be handled
    await waitFor(() => {
      expect(screen.getByText(/Update failed: Network error/i)).toBeInTheDocument();
    });
  });

  it('disables Update All button while updating', async () => {
    mockUseStores.mockReturnValue({
      data: [
        {
          _id: '1',
          name: 'Store 1',
          url: 'store1.myshopify.com',
          status: 'active' as const,
          pollingInterval: 60,
          productCount: 50,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    let resolveUpdate: any;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    (api.updateAllStores as any).mockReturnValue(updatePromise);

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    fireEvent.click(updateButton);
    
    // Button should be disabled during update
    await waitFor(() => {
      expect(updateButton).toBeDisabled();
    });
    
    // Resolve the promise
    resolveUpdate({
      pollResult: { successful_stores: 1, total_products: 50 },
      aggregationResult: { store_averages: 1, tag_averages: 3, store_tag_averages: 3 },
    });
    
    // Button should be enabled after update
    await waitFor(() => {
      expect(updateButton).not.toBeDisabled();
    });
  });

  it('shows spinning icon while updating', async () => {
    mockUseStores.mockReturnValue({
      data: [
        {
          _id: '1',
          name: 'Store 1',
          url: 'store1.myshopify.com',
          status: 'active' as const,
          pollingInterval: 60,
          productCount: 50,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    let resolveUpdate: any;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    (api.updateAllStores as any).mockReturnValue(updatePromise);

    renderStoresPage();
    
    const updateButton = screen.getByRole('button', { name: /update all stores/i });
    fireEvent.click(updateButton);
    
    // Should show spinning icon
    await waitFor(() => {
      const icon = updateButton.querySelector('.animate-spin');
      expect(icon).toBeInTheDocument();
    });
    
    // Resolve the promise
    resolveUpdate({
      pollResult: { successful_stores: 1, total_products: 50 },
      aggregationResult: { store_averages: 1, tag_averages: 3, store_tag_averages: 3 },
    });
    
    // Spinning should stop after update
    await waitFor(() => {
      const icon = updateButton.querySelector('.animate-spin');
      expect(icon).not.toBeInTheDocument();
    });
  });
});

