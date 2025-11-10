import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MonitoringChangeLogTable from './MonitoringChangeLogTable';
import type { MonitoringChangeLogEntry } from '../../types';

const buildEntry = (overrides: Partial<MonitoringChangeLogEntry> = {}): MonitoringChangeLogEntry => {
  const base: MonitoringChangeLogEntry = {
    id: 'log-1',
    subscriptionId: 'sub-1',
    scopeType: 'store',
    scope: { storeId: 'store-1' },
    changeType: 'both',
    currentValue: 120,
    previousValue: 100,
    absoluteChange: 20,
    percentageChange: 20,
    detectedAt: new Date('2024-01-01T00:00:00Z'),
    readAt: null,
    isBaseline: false,
  };
  return { ...base, ...overrides };
};

describe('MonitoringChangeLogTable', () => {
  it('renders empty state when no entries exist', () => {
    render(<MonitoringChangeLogTable entries={[]} />);

    expect(
      screen.getByText(/No change log entries for this subscription yet/i)
    ).toBeInTheDocument();
  });

  it('renders entries with formatted values and statuses', () => {
    const entries: MonitoringChangeLogEntry[] = [
      buildEntry({
        id: 'log-unread',
        scopeType: 'store',
        scope: { storeId: 'store-42' },
        absoluteChange: 5,
        percentageChange: 4.5,
      }),
      buildEntry({
        id: 'log-baseline',
        isBaseline: true,
        readAt: new Date('2024-01-01T01:00:00Z'),
        absoluteChange: null,
        percentageChange: null,
        currentValue: 90,
        previousValue: 90,
      }),
      buildEntry({
        id: 'log-read',
        readAt: new Date('2024-01-01T02:00:00Z'),
        scopeType: 'product',
        scope: { storeId: 'store-42', productId: 'prod-7' },
      }),
      buildEntry({
        id: 'log-product-type',
        scopeType: 'product_type',
        scope: { productType: 'Apparel' },
      }),
      buildEntry({
        id: 'log-store-product-type',
        scopeType: 'store_product_type',
        scope: { storeId: 'store-99', productType: 'Footwear' },
      }),
    ];

    render(
      <MonitoringChangeLogTable
        entries={entries}
        storeNameLookup={(storeId) => (storeId === 'store-42' ? 'Fancy Store' : undefined)}
      />
    );

    expect(screen.getByRole('columnheader', { name: /Type/i })).toBeInTheDocument();

    expect(screen.getByText('Store')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Product Type')).toBeInTheDocument();
    expect(screen.getByText('Store - Product Type')).toBeInTheDocument();

    expect(screen.getByText('Fancy Store')).toBeInTheDocument();
    expect(screen.getByText(/Product prod-7/i)).toBeInTheDocument();

    expect(screen.getByText(/Unread/i)).toBeInTheDocument();
    expect(screen.getByText(/Baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/Read/i)).toBeInTheDocument();

    expect(screen.getByText(/\$120\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$90\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\+\$5\.00/)).toBeInTheDocument();
  });

  it('invokes callback when an entry row is clicked', () => {
    const entry = buildEntry({ id: 'log-click', subscriptionId: 'sub-click' });
    const onEntryClick = vi.fn();

    render(<MonitoringChangeLogTable entries={[entry]} onEntryClick={onEntryClick} />);

    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);

    expect(onEntryClick).toHaveBeenCalledWith(entry);
  });
});


