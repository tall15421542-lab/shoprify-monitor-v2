import { Filter, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';

export type PriceSortOption = 'none' | 'price-asc' | 'price-desc';
export type PriceChangeFilter = 'all' | 'price-up' | 'price-down';

interface ProductFiltersProps {
  selectedProductType: string;
  onProductTypeChange: (type: string) => void;
  priceSort: PriceSortOption;
  onPriceSortChange: (sort: PriceSortOption) => void;
  priceChangeFilter: PriceChangeFilter;
  onPriceChangeFilterChange: (filter: PriceChangeFilter) => void;
  productTypes: string[];
  totalProducts: number;
  filteredCount: number;
}

function ProductFilters({
  selectedProductType,
  onProductTypeChange,
  priceSort,
  onPriceSortChange,
  priceChangeFilter,
  onPriceChangeFilterChange,
  productTypes,
  totalProducts,
  filteredCount,
}: ProductFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Product Type Filter */}
        <div className="flex-1">
          <label
            htmlFor="product-type-filter"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
          >
            <Filter size={16} />
            Product Type
          </label>
          <select
            id="product-type-filter"
            value={selectedProductType}
            onChange={(e) => onProductTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="">All Types</option>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Price Change Filter */}
        <div className="flex-1">
          <label
            htmlFor="price-change-filter"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
          >
            <TrendingUp size={16} />
            Price Changes
          </label>
          <select
            id="price-change-filter"
            value={priceChangeFilter}
            onChange={(e) => onPriceChangeFilterChange(e.target.value as PriceChangeFilter)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="all">All Products</option>
            <option value="price-up">📈 Price Increased</option>
            <option value="price-down">📉 Price Decreased</option>
          </select>
        </div>

        {/* Price Sort */}
        <div className="flex-1">
          <label
            htmlFor="price-sort"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
          >
            <ArrowUpDown size={16} />
            Sort by Price
          </label>
          <select
            id="price-sort"
            value={priceSort}
            onChange={(e) => onPriceSortChange(e.target.value as PriceSortOption)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="none">Default (No Sort)</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>

        {/* Results Count */}
        <div className="flex items-end">
          <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredCount}</span>
              {filteredCount !== totalProducts && (
                <span> of <span className="font-semibold text-gray-900">{totalProducts}</span></span>
              )}
              {filteredCount === 1 ? ' product' : ' products'}
            </p>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(selectedProductType || priceChangeFilter !== 'all' || priceSort !== 'none') && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-600">Active filters:</span>
            {selectedProductType && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                Type: {selectedProductType}
                <button
                  onClick={() => onProductTypeChange('')}
                  className="ml-1 hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                  aria-label="Clear product type filter"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {priceChangeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                {priceChangeFilter === 'price-up' ? '📈 Price Increased' : '📉 Price Decreased'}
                <button
                  onClick={() => onPriceChangeFilterChange('all')}
                  className="ml-1 hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                  aria-label="Clear price change filter"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {priceSort !== 'none' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                Sort: {priceSort === 'price-asc' ? 'Price Low to High' : 'Price High to Low'}
                <button
                  onClick={() => onPriceSortChange('none')}
                  className="ml-1 hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                  aria-label="Clear price sort"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => {
                onProductTypeChange('');
                onPriceChangeFilterChange('all');
                onPriceSortChange('none');
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductFilters;

