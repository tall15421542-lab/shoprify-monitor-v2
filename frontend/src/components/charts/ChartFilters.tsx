import { useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../../types';

interface ChartFiltersProps {
  stores: Store[];
  selectedStoreIds: string[];
  selectedProductTypes: string[];
  selectedTag?: string;
  availableTags: string[];
  availableProductTypes: string[];
  windowHours: number;
  tagsLoading: boolean;
  productTypesLoading: boolean;
  onStoreChange: (storeIds: string[]) => void;
  onTagChange: (tag: string) => void;
  onProductTypeChange: (productTypes: string[]) => void;
  onWindowHoursChange: (hours: number) => void;
}

function ChartFilters({
  stores,
  selectedStoreIds,
  selectedProductTypes,
  selectedTag,
  availableTags,
  availableProductTypes,
  windowHours,
  tagsLoading,
  productTypesLoading,
  onStoreChange,
  onTagChange,
  onProductTypeChange,
  onWindowHoursChange,
}: ChartFiltersProps) {
  const windowOptions = [
    { label: '1 Hour', value: 1 },
    { label: '24 Hours', value: 24 },
    { label: '1 Week', value: 168 },
  ];

  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isStoreDropdownOpen &&
        storeDropdownRef.current &&
        !storeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStoreDropdownOpen(false);
      }

      if (
        isProductTypeDropdownOpen &&
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProductTypeDropdownOpen(false);
      }
    }

    if (isStoreDropdownOpen || isProductTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return undefined;
  }, [isStoreDropdownOpen, isProductTypeDropdownOpen]);

  const storeSummary = useMemo(() => {
    if (stores.length === 0) return 'No stores available';

    if (selectedStoreIds.length === 0) {
      return 'All stores';
    }

    if (selectedStoreIds.length === stores.length) {
      return `All stores (${stores.length})`;
    }

    if (selectedStoreIds.length === 1) {
      const store = stores.find((s) => s._id === selectedStoreIds[0]);
      return store?.name || '1 store selected';
    }

    return `${selectedStoreIds.length} stores selected`;
  }, [selectedStoreIds, stores]);

  const productTypeSummary = useMemo(() => {
    if (productTypesLoading) return 'Loading product types...';

    if (availableProductTypes.length === 0) {
      return 'No product types available';
    }

    if (selectedProductTypes.length === 0) {
      return 'All product types';
    }

    if (selectedProductTypes.length === availableProductTypes.length) {
      return `All product types (${availableProductTypes.length})`;
    }

    if (selectedProductTypes.length === 1) {
      return selectedProductTypes[0];
    }

    return `${selectedProductTypes.length} product types selected`;
  }, [selectedProductTypes, availableProductTypes, productTypesLoading]);

  const toggleStoreSelection = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onStoreChange(selectedStoreIds.filter((id) => id !== storeId));
    } else {
      onStoreChange([...selectedStoreIds, storeId]);
    }
  };

  const toggleProductTypeSelection = (productType: string) => {
    if (selectedProductTypes.includes(productType)) {
      onProductTypeChange(selectedProductTypes.filter((value) => value !== productType));
    } else {
      onProductTypeChange([...selectedProductTypes, productType]);
    }
  };

  const handleStoreSelectAllToggle = () => {
    if (selectedStoreIds.length === stores.length) {
      onStoreChange([]);
    } else {
      onStoreChange(stores.map((store) => store._id));
    }
  };

  const handleProductTypeSelectAllToggle = () => {
    if (selectedProductTypes.length === availableProductTypes.length) {
      onProductTypeChange([]);
    } else {
      onProductTypeChange([...availableProductTypes]);
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="store" className="label">
            Stores
          </label>
          <div className="relative" ref={storeDropdownRef}>
            <button
              type="button"
              className="input-field w-full text-left flex items-center justify-between gap-3 disabled:cursor-not-allowed"
              disabled={stores.length === 0}
              onClick={() => setIsStoreDropdownOpen((prev) => !prev)}
            >
              <span className="truncate">{storeSummary}</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${isStoreDropdownOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M5 7L10 12L15 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isStoreDropdownOpen && stores.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                      checked={selectedStoreIds.length === stores.length && stores.length > 0}
                      onChange={handleStoreSelectAllToggle}
                    />
                    Select all stores
                  </label>
                  <button
                    type="button"
                    onClick={handleStoreSelectAllToggle}
                    className="text-xs font-semibold text-sky-600 hover:underline whitespace-nowrap"
                  >
                    {selectedStoreIds.length === stores.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  {stores.map((store) => {
                    const checked = selectedStoreIds.includes(store._id);
                    return (
                      <label
                        key={store._id}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                          checked={checked}
                          onChange={() => toggleStoreSelection(store._id)}
                        />
                        <span className="truncate">{store.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stores.length === 0
              ? 'No stores available'
              : selectedStoreIds.length === 0
              ? 'Showing all stores'
              : 'Filter analytics by store'}
          </p>
        </div>

        <div>
          <label htmlFor="productType" className="label">
            Product Types
          </label>
          <div className="relative" ref={productDropdownRef}>
            <button
              type="button"
              className="input-field w-full text-left flex items-center justify-between gap-3 disabled:cursor-not-allowed"
              disabled={productTypesLoading || availableProductTypes.length === 0}
              onClick={() => setIsProductTypeDropdownOpen((prev) => !prev)}
            >
              <span className="truncate">{productTypeSummary}</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${isProductTypeDropdownOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M5 7L10 12L15 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isProductTypeDropdownOpen && availableProductTypes.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                      checked={
                        availableProductTypes.length > 0 &&
                        selectedProductTypes.length === availableProductTypes.length
                      }
                      onChange={handleProductTypeSelectAllToggle}
                    />
                    Select all product types
                  </label>
                  <button
                    type="button"
                    onClick={handleProductTypeSelectAllToggle}
                    className="text-xs font-semibold text-sky-600 hover:underline whitespace-nowrap"
                  >
                    {selectedProductTypes.length === availableProductTypes.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  {availableProductTypes.map((productType) => {
                    const checked = selectedProductTypes.includes(productType);
                    return (
                      <label
                        key={productType}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                          checked={checked}
                          onChange={() => toggleProductTypeSelection(productType)}
                        />
                        <span className="truncate">{productType}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {productTypesLoading
              ? 'Loading product types...'
              : availableProductTypes.length === 0
              ? 'No product types available for the selected stores'
              : selectedProductTypes.length === 0
              ? 'Showing all product types'
              : 'Filter analytics by product type'}
          </p>
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
            disabled={tagsLoading || availableTags.length === 0}
          >
            <option value="">All Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {tagsLoading
              ? 'Loading tags...'
              : availableTags.length === 0
              ? 'No tags available for the selected stores'
              : 'Filter analytics by tag'}
          </p>
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
          <p className="text-xs text-gray-500 mt-1">Data points are aggregated over this time period</p>
        </div>
      </div>
    </div>
  );
}

export default ChartFilters;

