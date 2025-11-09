import type { Store } from '../../types';

interface ChangelogFiltersProps {
  stores: Store[];
  availableTags: string[];
  selectedStoreId?: string;
  selectedTag?: string;
  startDate: Date;
  endDate: Date;
  onStoreChange: (storeId: string) => void;
  onTagChange: (tag: string) => void;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
}

function ChangelogFilters({
  stores,
  availableTags,
  selectedStoreId,
  selectedTag,
  startDate,
  endDate,
  onStoreChange,
  onTagChange,
  onStartDateChange,
  onEndDateChange,
}: ChangelogFiltersProps) {
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="changelog-store" className="label">
            Store
          </label>
          <select
            id="changelog-store"
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
          <label htmlFor="changelog-tag" className="label">
            Tag
          </label>
          <select
            id="changelog-tag"
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
        </div>

        <div>
          <label htmlFor="changelog-start-date" className="label">
            Start Date
          </label>
          <input
            type="date"
            id="changelog-start-date"
            value={formatDateForInput(startDate)}
            onChange={(e) => onStartDateChange(new Date(e.target.value))}
            max={formatDateForInput(endDate)}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="changelog-end-date" className="label">
            End Date
          </label>
          <input
            type="date"
            id="changelog-end-date"
            value={formatDateForInput(endDate)}
            onChange={(e) => onEndDateChange(new Date(e.target.value))}
            min={formatDateForInput(startDate)}
            max={formatDateForInput(new Date())}
            className="input-field"
          />
        </div>
      </div>
    </div>
  );
}

export default ChangelogFilters;

