import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LineChart from './LineChart';
import type { AveragePriceData } from '../../types';

describe('LineChart', () => {
  const mockData: AveragePriceData[] = [
    { timestamp: new Date('2024-01-01'), averagePrice: 100, productCount: 5 },
    { timestamp: new Date('2024-01-02'), averagePrice: 110, productCount: 6 },
  ];

  it('renders with data', () => {
    render(<LineChart data={mockData} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('displays empty state when no data', () => {
    render(<LineChart data={[]} title="Empty Chart" />);

    expect(screen.getByText('Empty Chart')).toBeInTheDocument();
    expect(screen.getByText('No data available for the selected period')).toBeInTheDocument();
  });

  it('uses custom color prop', () => {
    const { container } = render(
      <LineChart data={mockData} title="Color Test" color="#ff0000" />
    );

    expect(container).toBeInTheDocument();
  });
});

