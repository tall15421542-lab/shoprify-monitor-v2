import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('StoreCard', () => {
  it('displays store information', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Store')).toBeInTheDocument();
    expect(screen.getByText('test.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('50 products')).toBeInTheDocument();
    expect(screen.getByText('Every 24h')).toBeInTheDocument();
  });

  it('displays active status correctly', () => {
    render(
      <BrowserRouter>
        <StoreCard store={mockStore} />
      </BrowserRouter>
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays paused status correctly', () => {
    const pausedStore = { ...mockStore, status: 'paused' as const };
    render(
      <BrowserRouter>
        <StoreCard store={pausedStore} />
      </BrowserRouter>
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('displays error status correctly', () => {
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
});

