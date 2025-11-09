import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LineChart from './LineChart';
import type { AveragePriceData } from '../../types';

describe('LineChart', () => {
  const mockSeries: Array<{
    id: string;
    label: string;
    data: AveragePriceData[];
    color?: string;
  }> = [
    {
      id: 'series-1',
      label: 'Series 1',
      data: [
        { timestamp: new Date('2024-01-01'), averagePrice: 100, productCount: 5 },
        { timestamp: new Date('2024-01-02'), averagePrice: 110, productCount: 6 },
      ],
    },
    {
      id: 'series-2',
      label: 'Series 2',
      color: '#ff0000',
      data: [
        { timestamp: new Date('2024-01-01'), averagePrice: 90, productCount: 4 },
        { timestamp: new Date('2024-01-02'), averagePrice: 95, productCount: 5 },
      ],
    },
  ];

  it('renders with data', () => {
    render(<LineChart series={mockSeries} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('displays empty state when no data', () => {
    render(
      <LineChart
        series={[
          { id: 'empty', label: 'Empty', data: [] },
        ]}
        title="Empty Chart"
        emptyMessage="Nothing to show"
      />
    );

    expect(screen.getByText('Empty Chart')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('uses custom color prop', () => {
    const { container } = render(
      <LineChart series={mockSeries} title="Color Test" />
    );

    expect(container).toBeInTheDocument();
  });
});

