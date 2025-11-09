import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StoreCard from '../StoreCard';
import { ToastProvider } from '../../common/ToastContainer';
import * as api from '../../../services/api';

// Mock the API
vi.mock('../../../services/api', () => ({
  updateStore: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockStore = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test Store',
  url: 'test.myshopify.com',
  status: 'active' as const,
  pollingInterval: 60,
  lastFetch: new Date('2024-01-01T12:00:00Z'),
  productCount: 100,
};

const renderStoreCard = (store = mockStore, onUpdate?: () => void) => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <StoreCard store={store} onUpdate={onUpdate} />
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('StoreCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders store information correctly', () => {
    renderStoreCard();
    
    expect(screen.getByText('Test Store')).toBeInTheDocument();
    expect(screen.getByText('test.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('100 products')).toBeInTheDocument();
    expect(screen.getByText('Every 60h')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('navigates to products page when card is clicked', () => {
    renderStoreCard();
    
    const card = screen.getByText('Test Store').closest('div.card');
    fireEvent.click(card!);
    
    expect(mockNavigate).toHaveBeenCalledWith('/stores/507f1f77bcf86cd799439011/products');
  });

  it('renders Update button', () => {
    renderStoreCard();
    
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
  });

  it('updates store when Update button is clicked', async () => {
    const mockUpdateResult = {
      pollResult: {
        store_id: mockStore._id,
        store_name: mockStore.name,
        products_saved: 50,
        errors: 0,
        price_snapshots: 50,
      },
      aggregationResult: {
        store_averages: 1,
        tag_averages: 3,
        store_tag_averages: 3,
      },
    };

    (api.updateStore as any).mockResolvedValue(mockUpdateResult);

    const mockOnUpdate = vi.fn();
    renderStoreCard(mockStore, mockOnUpdate);
    
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
    
    // Wait for update to complete
    await waitFor(() => {
      expect(api.updateStore).toHaveBeenCalledWith(mockStore._id);
    });
    
    // Should call onUpdate callback
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
    
    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/Updated Test Store: 50 products/i)).toBeInTheDocument();
    });
  });

  it('does not navigate when Update button is clicked', async () => {
    (api.updateStore as any).mockResolvedValue({
      pollResult: { products_saved: 50 },
      aggregationResult: { store_averages: 1, tag_averages: 3, store_tag_averages: 3 },
    });

    renderStoreCard();
    
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);
    
    // Navigation should not be called when clicking update button
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows error toast when update fails', async () => {
    const mockError = {
      response: {
        data: { error: 'Store not found' },
      },
    };

    (api.updateStore as any).mockRejectedValue(mockError);

    renderStoreCard();
    
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);
    
    // Wait for error to be handled
    await waitFor(() => {
      expect(screen.getByText(/Update failed: Store not found/i)).toBeInTheDocument();
    });
  });

  it('disables Update button while updating', async () => {
    // Create a promise that we can control
    let resolveUpdate: any;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    (api.updateStore as any).mockReturnValue(updatePromise);

    renderStoreCard();
    
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);
    
    // Button should be disabled during update
    await waitFor(() => {
      expect(updateButton).toBeDisabled();
    });
    
    // Resolve the promise
    resolveUpdate({
      pollResult: { products_saved: 50 },
      aggregationResult: { store_averages: 1, tag_averages: 3, store_tag_averages: 3 },
    });
    
    // Button should be enabled after update
    await waitFor(() => {
      expect(updateButton).not.toBeDisabled();
    });
  });

  it('shows spinning icon while updating', async () => {
    let resolveUpdate: any;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    (api.updateStore as any).mockReturnValue(updatePromise);

    renderStoreCard();
    
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);
    
    // Should show spinning icon
    await waitFor(() => {
      const icon = updateButton.querySelector('.animate-spin');
      expect(icon).toBeInTheDocument();
    });
    
    // Resolve the promise
    resolveUpdate({
      pollResult: { products_saved: 50 },
      aggregationResult: { store_averages: 1, tag_averages: 3, store_tag_averages: 3 },
    });
    
    // Spinning should stop after update
    await waitFor(() => {
      const icon = updateButton.querySelector('.animate-spin');
      expect(icon).not.toBeInTheDocument();
    });
  });
});


