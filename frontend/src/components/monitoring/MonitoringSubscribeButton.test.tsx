import type { ComponentProps } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MonitoringSubscribeButton from './MonitoringSubscribeButton';
import { ToastProvider } from '../common/ToastContainer';

const mutateAsync = vi.fn();

vi.mock('../../hooks/useMonitoringSubscriptions', () => ({
  useCreateMonitoringSubscription: () => ({
    mutateAsync,
  }),
}));

function renderButton(props: ComponentProps<typeof MonitoringSubscribeButton>) {
  return render(
    <ToastProvider>
      <MonitoringSubscribeButton {...props} />
    </ToastProvider>
  );
}

describe('MonitoringSubscribeButton', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it('disables trigger when no targets provided', () => {
    renderButton({ targets: [], label: 'Subscribe' });
    const button = screen.getByRole('button', { name: /subscribe/i });
    expect(button).toBeDisabled();
  });

  it('creates subscription with selected options', async () => {
    mutateAsync.mockResolvedValue({});

    renderButton({
      targets: [
        {
          scopeType: 'store',
          scope: { storeId: 'store-1' },
          label: 'Store 1',
        },
      ],
      label: 'Subscribe',
    });

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(screen.getByLabelText(/any change/i)).toBeChecked();
    const priceDownRadio = screen.getByLabelText(/price goes down/i);
    fireEvent.click(priceDownRadio);

    const intervalInput = screen.getByLabelText(/interval \(minutes\)/i);
    fireEvent.change(intervalInput, { target: { value: '90' } });

    fireEvent.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        scopeType: 'store',
        scope: { storeId: 'store-1' },
        changeType: 'price_down',
        intervalMinutes: 90,
      });
    });
  });

  it('deduplicates identical targets before submission', async () => {
    mutateAsync.mockResolvedValue({});

    renderButton({
      targets: [
        {
          scopeType: 'store',
          scope: { storeId: 'store-1' },
          label: 'Store 1',
        },
        {
          scopeType: 'store',
          scope: { storeId: 'store-1' },
          label: 'Duplicate Store 1',
        },
      ],
      label: 'Subscribe',
    });

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
    fireEvent.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
  });
});


