import { Trash2, Bell } from 'lucide-react';
import type { MonitoringSubscription } from '../../types';

interface MonitoringSubscriptionListProps {
  subscriptions: MonitoringSubscription[];
  selectedId?: string;
  onSelect: (subscription: MonitoringSubscription) => void;
  onDelete: (subscription: MonitoringSubscription) => void;
  deletingId?: string | null;
  storeNameLookup?: (storeId: string) => string | undefined;
}

export function formatScope(
  subscription: MonitoringSubscription,
  storeNameLookup?: (storeId: string) => string | undefined
) {
  const { scope, scopeType } = subscription;
  switch (scopeType) {
    case 'product': {
      const storeId = scope.storeId;
      const productId = scope.productId;
      const storeLabel =
        (subscription.storeName && subscription.storeName.trim()) ||
        (storeId ? storeNameLookup?.(storeId) : undefined) ||
        storeId ||
        '—';
      const productLabel =
        (subscription.productName && subscription.productName.trim()) ||
        productId ||
        '—';
      return `${storeLabel} - ${productLabel}`;
    }
    case 'store': {
      const storeName = scope.storeId
        ? storeNameLookup?.(scope.storeId) ?? scope.storeId
        : '—';
      return storeName;
    }
    case 'product_type':
      return scope.productType ?? '—';
    case 'store_product_type': {
      const storeName = scope.storeId
        ? storeNameLookup?.(scope.storeId) ?? scope.storeId
        : '—';
      const productType = scope.productType ?? '—';
      return `${storeName} - ${productType}`;
    }
    default:
      return 'Unknown scope';
  }
}

export function formatScopeTypeLabel(
  scopeType: MonitoringSubscription['scopeType']
) {
  switch (scopeType) {
    case 'store':
      return 'Store';
    case 'product':
      return 'Product';
    case 'product_type':
      return 'Product Type';
    case 'store_product_type':
      return 'Store - Product Type';
    default:
      return (scopeType as string).replace(/_/g, ' ');
  }
}

export function formatChangeType(changeType: string) {
  switch (changeType) {
    case 'price_up':
      return 'Price up';
    case 'price_down':
      return 'Price down';
    case 'both':
      return 'Any change';
    default:
      return changeType;
  }
}

function MonitoringSubscriptionList({
  subscriptions,
  selectedId,
  onSelect,
  onDelete,
  deletingId,
  storeNameLookup,
}: MonitoringSubscriptionListProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="card text-sm text-gray-600">
        No monitoring subscriptions yet. Create one using the selections above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((subscription) => {
        const isSelected = subscription.id === selectedId;
        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(subscription);
          }
        };

        return (
          <div
            key={subscription.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(subscription)}
            onKeyDown={handleKeyDown}
            className={`w-full text-left card transition-all border focus:outline-none ${
              isSelected
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'border-gray-200 hover:border-primary-200 focus:ring-2 focus:ring-primary-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    <Bell size={12} />
                    {formatScopeTypeLabel(subscription.scopeType)}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {formatChangeType(subscription.changeType)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {formatScope(subscription, storeNameLookup)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Created {subscription.createdAt.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full text-xs font-semibold ${
                    subscription.unreadCount > 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {subscription.unreadCount}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(subscription);
                  }}
                  disabled={deletingId === subscription.id}
                  className="text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  aria-label="Remove subscription"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MonitoringSubscriptionList;


