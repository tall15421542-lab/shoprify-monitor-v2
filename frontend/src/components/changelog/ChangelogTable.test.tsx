import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChangelogTable from './ChangelogTable';
import type { ChangelogEntry } from '../../types';

describe('ChangelogTable', () => {
  const mockEntries: ChangelogEntry[] = [
    {
      _id: '1',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      productId: 'p1',
      productTitle: 'Test Product 1',
      storeId: 's1',
      storeName: 'Test Store',
      oldPrice: 100,
      newPrice: 110,
      priceChange: 10,
      priceChangePercent: 10,
      tags: ['tag1', 'tag2'],
    },
    {
      _id: '2',
      timestamp: new Date('2024-01-02T12:00:00Z'),
      productId: 'p2',
      productTitle: 'Test Product 2',
      storeId: 's1',
      storeName: 'Test Store',
      oldPrice: 50,
      newPrice: 45,
      priceChange: -5,
      priceChangePercent: -10,
      tags: ['tag3'],
    },
  ];

  it('renders table with entries', () => {
    render(<ChangelogTable entries={mockEntries} />);

    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    // Test Store appears twice (once per row)
    const storeElements = screen.getAllByText('Test Store');
    expect(storeElements).toHaveLength(2);
  });

  it('displays prices correctly', () => {
    render(<ChangelogTable entries={mockEntries} />);

    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$110.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$45.00')).toBeInTheDocument();
  });

  it('shows price changes', () => {
    render(<ChangelogTable entries={mockEntries} />);

    // Price increase should show
    expect(screen.getByText(/\+\$10\.00/)).toBeInTheDocument();
    // Price decrease should show
    expect(screen.getByText(/\$5\.00/)).toBeInTheDocument();
  });

  it('displays tags', () => {
    render(<ChangelogTable entries={mockEntries} />);

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    render(<ChangelogTable entries={[]} />);

    expect(screen.getByText('No price changes found for the selected filters')).toBeInTheDocument();
  });

  it('displays timestamps', () => {
    render(<ChangelogTable entries={mockEntries} />);

    // Check that dates are rendered (format may vary by locale)
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2\/2024/)).toBeInTheDocument();
  });
});

