import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangePicker from './DateRangePicker';
import type { DateRange } from '../../types';

describe('DateRangePicker', () => {
  const mockOnChange = vi.fn();
  const mockDateRange: DateRange = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
  };

  it('renders date inputs', () => {
    render(<DateRangePicker dateRange={mockDateRange} onChange={mockOnChange} />);

    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
  });

  it('displays preset buttons', () => {
    render(<DateRangePicker dateRange={mockDateRange} onChange={mockOnChange} />);

    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('calls onChange when date is changed', () => {
    render(<DateRangePicker dateRange={mockDateRange} onChange={mockOnChange} />);

    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('calls onChange when preset is clicked', () => {
    render(<DateRangePicker dateRange={mockDateRange} onChange={mockOnChange} />);

    const last7DaysButton = screen.getByText('Last 7 days');
    fireEvent.click(last7DaysButton);

    expect(mockOnChange).toHaveBeenCalled();
  });
});

