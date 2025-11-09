import type { Store } from '../../types';

interface ChartFiltersProps {
  stores: Store[];
  selectedStoreId?: string;
  selectedTag?: string;
  availableTags: string[];
  windowHours: number;
  onStoreChange: (storeId: string) => void;
  onTagChange: (tag: string) => void;
  onWindowHoursChange: (hours: number) => void;
}

function ChartFilters({
  stores,
  selectedStoreId,
  selectedTag,
  availableTags,
  windowHours,
  onStoreChange,
  onTagChange,
  onWindowHoursChange,
}: ChartFiltersProps) {
  const windowOptions = [
    { label: '1 Hour', value: 1 },
    { label: '24 Hours', value: 24 },
    { label: '1 Week', value: 168 },
  ];

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="store" className="label">
            Store
          </label>
          <select
            id="store"
            value={selectedStoreId || ''}
            onChange={(e) => onStoreChange(e.target.value)}
            className="input-field"
          >
            <option value="">All Stores</option>
            {stores.map((store) => (
              <option key={store._id} value={store._id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tag" className="label">
            Tag
          </label>
          <select
            id="tag"
            value={selectedTag || ''}
            onChange={(e) => onTagChange(e.target.value)}
            className="input-field"
            disabled={availableTags.length === 0}
          >
            <option value="">All Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          {availableTags.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">No tags available</p>
          )}
        </div>

        <div>
          <label htmlFor="window" className="label">
            Aggregation Window
          </label>
          <select
            id="window"
            value={windowHours}
            onChange={(e) => onWindowHoursChange(Number(e.target.value))}
            className="input-field"
          >
            {windowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Data points are aggregated over this time period
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChartFilters;

