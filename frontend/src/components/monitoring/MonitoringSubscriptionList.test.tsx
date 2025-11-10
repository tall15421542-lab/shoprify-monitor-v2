import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonitoringSubscriptionList from './MonitoringSubscriptionList';
import type { MonitoringSubscription } from '../../types';

const createSubscription = (overrides: Partial<MonitoringSubscription> = {}): MonitoringSubscription => {
  const base: MonitoringSubscription = {
    id: 'sub-1',
    scopeType: 'store',
    scope: { storeId: 'store-1' },
    changeType: 'both',
    intervalMinutes: 15,
    unreadCount: 3,
    unreadUpdatedAt: new Date('2024-01-01T00:30:00Z'),
    unreadChangeLogs: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:15:00Z'),
  };
  return { ...base, ...overrides };
};

describe('MonitoringSubscriptionList', () => {
  it('renders empty state when no subscriptions exist', () => {
    render(
      <MonitoringSubscriptionList
        subscriptions={[]}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(
      screen.getByText(/no monitoring subscriptions yet/i)
    ).toBeInTheDocument();
  });

  it('renders subscription details and handles selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    const subscriptions: MonitoringSubscription[] = [
      createSubscription({
        id: 'sub-store',
        scopeType: 'store',
        scope: { storeId: 'store-42' },
        unreadCount: 5,
      }),
      createSubscription({
        id: 'sub-product',
        scopeType: 'product',
        scope: { storeId: 'store-42', productId: 'prod-9' },
        changeType: 'price_down',
        intervalMinutes: 60,
      }),
    ];

    render(
      <MonitoringSubscriptionList
        subscriptions={subscriptions}
        onSelect={onSelect}
        onDelete={onDelete}
        selectedId="sub-product"
        storeNameLookup={(storeId) => (storeId === 'store-42' ? 'Fancy Store' : undefined)}
      />
    );

    expect(screen.getByText(/Store Fancy Store/i)).toBeInTheDocument();
    expect(screen.getByText(/Product prod-9/i)).toBeInTheDocument();
    expect(screen.getByText(/Any change/i)).toBeInTheDocument();
    expect(screen.getByText(/Price down/i)).toBeInTheDocument();
    expect(screen.getByText(/Every 60 min/i)).toBeInTheDocument();
    expect(
      screen.getByText((content, node) => node?.textContent === '5')
    ).toBeInTheDocument();

    await user.click(screen.getByText(/Store Fancy Store/i));
    expect(onSelect).toHaveBeenCalledWith(subscriptions[0]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('invokes delete handler without triggering selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const subscription = createSubscription();

    render(
      <MonitoringSubscriptionList
        subscriptions={[subscription]}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /remove subscription/i });
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith(subscription);
    expect(onSelect).not.toHaveBeenCalled();
  });
});


