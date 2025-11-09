import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriceChange from './PriceChange';

describe('PriceChange', () => {
  it('displays price increase in red', () => {
    const { container } = render(<PriceChange change={10} changePercent={10} />);

    expect(screen.getByText(/\+\$10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\+10\.0%\)/)).toBeInTheDocument();

    const span = container.querySelector('span');
    expect(span).toHaveClass('text-red-600');
    expect(span).toHaveClass('bg-red-100');
  });

  it('displays price decrease in green', () => {
    const { container } = render(<PriceChange change={-10} changePercent={-10} />);

    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/10\.0%\)/)).toBeInTheDocument();

    const span = container.querySelector('span');
    expect(span).toHaveClass('text-green-600');
    expect(span).toHaveClass('bg-green-100');
  });

  it('displays no change in gray', () => {
    const { container } = render(<PriceChange change={0} changePercent={0} />);

    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();

    const span = container.querySelector('span');
    expect(span).toHaveClass('text-gray-600');
    expect(span).toHaveClass('bg-gray-100');
  });

  it('formats large numbers correctly', () => {
    render(<PriceChange change={1234.56} changePercent={50.5} />);

    expect(screen.getByText(/\+\$1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText(/\+50\.5%\)/)).toBeInTheDocument();
  });

  it('formats decimals to one place', () => {
    render(<PriceChange change={5.123} changePercent={5.678} />);

    expect(screen.getByText(/5\.7%\)/)).toBeInTheDocument();
  });
});

