import PriceChange from '../products/PriceChange';
import type { MonitoringChangeLogEntry } from '../../types';
import { formatPrice } from '../../utils/price';

const scopeTypeLabels: Record<MonitoringChangeLogEntry['scopeType'], string> = {
  product: 'Product',
  store: 'Store',
  product_type: 'Product Type',
  store_product_type: 'Store - Product Type',
};

function formatScopeType(scopeType: MonitoringChangeLogEntry['scopeType']) {
  return scopeTypeLabels[scopeType] ?? 'Unknown';
}

interface MonitoringChangeLogTableProps {
  entries: MonitoringChangeLogEntry[];
  storeNameLookup?: (storeId: string) => string | undefined;
  highlightedEntryIds?: Set<string>;
  onEntryClick?: (entry: MonitoringChangeLogEntry) => void;
}

function formatScope(
  entry: MonitoringChangeLogEntry,
  storeNameLookup?: (storeId: string) => string | undefined
) {
  const { scopeType, scope } = entry;
  switch (scopeType) {
    case 'product': {
      const storeId = scope.storeId;
      const productId = scope.productId;
      const storeLabel =
        (entry.storeName && entry.storeName.trim()) ||
        (storeId ? storeNameLookup?.(storeId) : undefined) ||
        storeId ||
        '—';
      const productLabel =
        (entry.productName && entry.productName.trim()) ||
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

function formatValue(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return formatPrice(value);
}

function MonitoringChangeLogTable({
  entries,
  storeNameLookup,
  highlightedEntryIds,
  onEntryClick,
}: MonitoringChangeLogTableProps) {
  if (entries.length === 0) {
    return (
      <div className="card text-sm text-gray-600">
        No change log entries for this subscription yet.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 px-4">Detected</th>
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4">Scope</th>
            <th className="py-3 px-4">Current</th>
            <th className="py-3 px-4">Previous</th>
            <th className="py-3 px-4">Change</th>
            <th className="py-3 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isUnread = !entry.readAt && !entry.isBaseline;
            const isNew = !!highlightedEntryIds?.has(entry.id);
            const isClickable = typeof onEntryClick === 'function';
            return (
              <tr
                key={entry.id}
                className={`border-b border-gray-100 ${
                  isNew
                    ? 'bg-emerald-50 ring-2 ring-emerald-200'
                    : isUnread
                    ? 'bg-amber-50'
                    : isClickable
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : 'hover:bg-gray-50'
                } ${isClickable ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500' : ''}`}
                onClick={
                  isClickable
                    ? () => {
                        onEntryClick?.(entry);
                      }
                    : undefined
                }
                onKeyDown={
                  isClickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onEntryClick?.(entry);
                        }
                      }
                    : undefined
                }
                tabIndex={isClickable ? 0 : undefined}
                aria-label={
                  isClickable
                    ? `View subscription ${entry.subscriptionId} change log entry detected ${entry.detectedAt.toLocaleString()}`
                    : undefined
                }
              >
                <td className="py-3 px-4 text-gray-700">
                  {entry.detectedAt.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-gray-700">
                  {formatScopeType(entry.scopeType)}
                </td>
                <td className="py-3 px-4 text-gray-900 font-medium">
                  {formatScope(entry, storeNameLookup)}
                </td>
                <td className="py-3 px-4 text-gray-900">{formatValue(entry.currentValue)}</td>
                <td className="py-3 px-4 text-gray-600">{formatValue(entry.previousValue)}</td>
                <td className="py-3 px-4">
                  {entry.absoluteChange !== null && entry.percentageChange !== null ? (
                    <PriceChange
                      change={entry.absoluteChange}
                      changePercent={entry.percentageChange}
                    />
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-2">
                    {isNew && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        New
                      </span>
                    )}
                    {entry.isBaseline ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                        Baseline
                      </span>
                    ) : entry.readAt ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        Read
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        Unread
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MonitoringChangeLogTable;


