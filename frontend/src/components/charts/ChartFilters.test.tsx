import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartFilters from './ChartFilters';
import type { Store } from '../../types';

describe('ChartFilters', () => {
  const mockStores: Store[] = [
    { _id: '1', name: 'Store 1', url: 'store1.myshopify.com', status: 'active', pollingInterval: 24 },
    { _id: '2', name: 'Store 2', url: 'store2.myshopify.com', status: 'active', pollingInterval: 24 },
  ];

  const mockTags = ['tag1', 'tag2', 'tag3'];
  const mockOnStoreChange = vi.fn();
  const mockOnTagChange = vi.fn();
  const mockOnWindowHoursChange = vi.fn();

  it('renders filter controls', () => {
    render(
      <ChartFilters
        stores={mockStores}
        availableTags={mockTags}
        windowHours={24}
        onStoreChange={mockOnStoreChange}
        onTagChange={mockOnTagChange}
        onWindowHoursChange={mockOnWindowHoursChange}
      />
    );

    expect(screen.getByLabelText('Store')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Aggregation Window')).toBeInTheDocument();
  });

  it('displays store options', () => {
    render(
      <ChartFilters
        stores={mockStores}
        availableTags={mockTags}
        windowHours={24}
        onStoreChange={mockOnStoreChange}
        onTagChange={mockOnTagChange}
        onWindowHoursChange={mockOnWindowHoursChange}
      />
    );

    expect(screen.getByText('Store 1')).toBeInTheDocument();
    expect(screen.getByText('Store 2')).toBeInTheDocument();
  });

  it('calls onStoreChange when store is selected', () => {
    render(
      <ChartFilters
        stores={mockStores}
        availableTags={mockTags}
        windowHours={24}
        onStoreChange={mockOnStoreChange}
        onTagChange={mockOnTagChange}
        onWindowHoursChange={mockOnWindowHoursChange}
      />
    );

    const storeSelect = screen.getByLabelText('Store');
    fireEvent.change(storeSelect, { target: { value: '1' } });

    expect(mockOnStoreChange).toHaveBeenCalledWith('1');
  });

  it('disables tag select when no tags available', () => {
    render(
      <ChartFilters
        stores={mockStores}
        availableTags={[]}
        windowHours={24}
        onStoreChange={mockOnStoreChange}
        onTagChange={mockOnTagChange}
        onWindowHoursChange={mockOnWindowHoursChange}
      />
    );

    const tagSelect = screen.getByLabelText('Tag') as HTMLSelectElement;
    expect(tagSelect).toBeDisabled();
  });
});

