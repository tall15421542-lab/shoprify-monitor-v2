import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductCard from './ProductCard';
import type { Product } from '../../types';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockProduct: Product = {
  _id: '1',
  storeId: 'store1',
  shopifyId: 'shopify1',
  title: 'Test Product',
  handle: 'test-product',
  vendor: 'Test Vendor',
  productType: 'Test Type',
  tags: ['tag1', 'tag2', 'tag3', 'tag4'],
  variants: [],
  images: [{ id: 'img1', src: 'https://example.com/image.jpg' }],
  currentPrice: 99.99,
  previousPrice: 89.99,
  priceChange: 10,
  priceChangePercent: 11.11,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProductCard', () => {
  it('displays product information', () => {
    render(<ProductCard product={mockProduct} />, { wrapper: createWrapper() });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('by Test Vendor')).toBeInTheDocument();
  });

  it('displays product image', () => {
    const { container } = render(<ProductCard product={mockProduct} />, { wrapper: createWrapper() });

    const image = container.querySelector('img') as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.alt).toBe('Test Product');
    expect(image.src).toBe('https://example.com/image.jpg');
  });

  it('displays fallback icon when no image', () => {
    const productWithoutImage = { ...mockProduct, images: [] };
    const { container } = render(<ProductCard product={productWithoutImage} />, {
      wrapper: createWrapper(),
    });

    // Check for Package icon SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays price change indicator', () => {
    render(<ProductCard product={mockProduct} />, { wrapper: createWrapper() });

    expect(screen.getByText(/\+\$10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\+11\.1%\)/)).toBeInTheDocument();
  });

  it('displays tags with limit', () => {
    render(<ProductCard product={mockProduct} />, { wrapper: createWrapper() });

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument(); // +1 for the 4th tag
  });

  it('opens price history modal on click', () => {
    render(<ProductCard product={mockProduct} />, { wrapper: createWrapper() });

    const card = screen.getByText('Test Product').closest('div')?.parentElement;
    fireEvent.click(card!);

    // Modal should open (we'll see the title in PriceHistoryModal)
    expect(screen.getByText(/Price History:/)).toBeInTheDocument();
  });

  it('handles product without price change', () => {
    const productNoChange = {
      ...mockProduct,
      previousPrice: undefined,
      priceChange: undefined,
      priceChangePercent: undefined,
    };

    render(<ProductCard product={productNoChange} />, { wrapper: createWrapper() });

    expect(screen.getByText('$99.99')).toBeInTheDocument();
    // Should not show price change badge
    expect(screen.queryByText(/\+\$/)).not.toBeInTheDocument();
  });
});

