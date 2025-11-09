import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddStoreModal from './AddStoreModal';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('AddStoreModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders when open', () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Add New Store')).toBeInTheDocument();
    expect(screen.getByLabelText('Store Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Store URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Polling Interval (hours)')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AddStoreModal isOpen={false} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Add New Store')).not.toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    const submitButton = screen.getByText('Add Store');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Store name is required')).toBeInTheDocument();
      expect(screen.getByText('Store URL is required')).toBeInTheDocument();
    });
  });

  it('validates Shopify URL format', async () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    const urlInput = screen.getByLabelText('Store URL');
    fireEvent.change(urlInput, { target: { value: 'invalid-url.com' } });

    const submitButton = screen.getByText('Add Store');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('URL must be a valid Shopify store (*.myshopify.com)')
      ).toBeInTheDocument();
    });
  });

  it.skip('validates polling interval range', async () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    // Fill in name and URL first to avoid other validation errors
    const nameInput = screen.getByLabelText('Store Name');
    const urlInput = screen.getByLabelText('Store URL');
    fireEvent.change(nameInput, { target: { value: 'Test Store' } });
    fireEvent.change(urlInput, { target: { value: 'test.myshopify.com' } });

    const intervalInput = screen.getByLabelText('Polling Interval (hours)');
    fireEvent.change(intervalInput, { target: { value: '200' } });

    const submitButton = screen.getByText('Add Store');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('Polling interval must be between 1 and 168 hours')
      ).toBeInTheDocument();
    });
  });

  it('handles cancel button', () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('updates form inputs', () => {
    render(<AddStoreModal isOpen={true} onClose={mockOnClose} />, {
      wrapper: createWrapper(),
    });

    const nameInput = screen.getByLabelText('Store Name') as HTMLInputElement;
    const urlInput = screen.getByLabelText('Store URL') as HTMLInputElement;
    const intervalInput = screen.getByLabelText('Polling Interval (hours)') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'My Store' } });
    fireEvent.change(urlInput, { target: { value: 'mystore.myshopify.com' } });
    fireEvent.change(intervalInput, { target: { value: '12' } });

    expect(nameInput.value).toBe('My Store');
    expect(urlInput.value).toBe('mystore.myshopify.com');
    expect(intervalInput.value).toBe('12');
  });
});

