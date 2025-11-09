import { formatPrice } from '../../utils/price';
import PriceChange from '../products/PriceChange';
import type { ChangelogEntry } from '../../types';

interface ChangelogTableProps {
  entries: ChangelogEntry[];
}

function ChangelogTable({ entries }: ChangelogTableProps) {
  if (entries.length === 0) {
    return (
      <div className="card">
        <p className="text-center text-gray-600 py-8">No price changes found for the selected filters</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Product</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Store</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Old Price</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">New Price</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Change</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Tags</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry._id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-600">
                {new Date(entry.timestamp).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                <div className="font-medium text-gray-900">{entry.productTitle}</div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">{entry.storeName}</td>
              <td className="py-3 px-4 text-sm text-gray-600">{formatPrice(entry.oldPrice)}</td>
              <td className="py-3 px-4 text-sm font-medium text-gray-900">
                {formatPrice(entry.newPrice)}
              </td>
              <td className="py-3 px-4">
                <PriceChange change={entry.priceChange} changePercent={entry.priceChangePercent} />
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 2 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      +{entry.tags.length - 2}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ChangelogTable;

