import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useStores } from '../hooks/useStores';
import { useProductTypes } from '../hooks/useProductTypes';
import {
  getAveragePriceByStore,
  getAveragePriceByStoreAndProductType,
  getAveragePriceByProductType,
  getStoreProductTypes,
} from '../services/api';
import DateRangePicker from '../components/charts/DateRangePicker';
import ChartFilters from '../components/charts/ChartFilters';
import LineChart from '../components/charts/LineChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import type { AveragePriceData, DateRange, ProductType } from '../types';

function DashboardPage() {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  // Filter states
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState<number>(1);

  // Fetch stores
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const activeStores = useMemo(
    () => (stores ?? []).filter((store) => store.status === 'active'),
    [stores]
  );

  const hasInitializedStoresRef = useRef(false);
  const previousStoreIdsRef = useRef<string[]>([]);
  const hasInitializedProductTypesRef = useRef(false);
  const previousAvailableProductTypesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!stores) return;
    const storeIds = activeStores.map((store) => store._id);
    setSelectedStoreIds((prev) => {
      const prevStoreIds = previousStoreIdsRef.current;
      const validIds = prev.filter((id) => storeIds.includes(id));
      const hadAllPreviously =
        prevStoreIds.length > 0 &&
        prev.length === prevStoreIds.length &&
        prevStoreIds.every((id) => prev.includes(id));

      let nextSelection: string[];

      if (!hasInitializedStoresRef.current) {
        nextSelection = storeIds;
        hasInitializedStoresRef.current = true;
      } else if (hadAllPreviously) {
        nextSelection = storeIds;
      } else {
        nextSelection = validIds;
      }

      previousStoreIdsRef.current = storeIds;
      return nextSelection;
    });
  }, [stores, activeStores]);

  const { data: allProductTypes, isLoading: allProductTypesLoading } = useProductTypes();

  const productTypeOptionsQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['product-types', 'store', storeId],
      queryFn: () => getStoreProductTypes(storeId),
      enabled: selectedStoreIds.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  }) as UseQueryResult<ProductType[], Error>[];

  const availableProductTypes = (() => {
    if (selectedStoreIds.length === 0) {
      return (allProductTypes || []).map((type) => type.product_type).sort();
    }

    if (productTypeOptionsQueries.length === 0 || productTypeOptionsQueries.some((query) => !query.data)) {
      return [];
    }

    const productTypeLists = productTypeOptionsQueries.map((query) =>
      query.data!.map((type) => type.product_type)
    );
    const [first, ...rest] = productTypeLists;
    const intersection = first.filter((productType) =>
      rest.every((types) => types.includes(productType))
    );

    return Array.from(new Set(intersection)).sort();
  })();

  const availableProductTypesKey = availableProductTypes.join('|');

  const productTypeOptionsLoading =
    selectedStoreIds.length === 0
      ? allProductTypesLoading
      : productTypeOptionsQueries.some((query) => query.isLoading);

  const productTypeOptionsReady =
    selectedStoreIds.length === 0
      ? !allProductTypesLoading
      : productTypeOptionsQueries.every((query) => query.isSuccess);

  useEffect(() => {
    if (!productTypeOptionsReady) return;
    const available = availableProductTypes;

    setSelectedProductTypes((prev) => {
      const prevAvailable = previousAvailableProductTypesRef.current;
      const valid = prev.filter((type) => available.includes(type));
      const hadAllPreviously =
        prevAvailable.length > 0 &&
        prev.length === prevAvailable.length &&
        prevAvailable.every((type) => prev.includes(type));

      let candidate: string[];

      if (!hasInitializedProductTypesRef.current) {
        candidate = available;
        hasInitializedProductTypesRef.current = true;
      } else if (hadAllPreviously) {
        candidate = available;
      } else {
        candidate = valid;
      }

      const unchanged =
        candidate.length === prev.length && candidate.every((value, index) => value === prev[index]);

      return unchanged ? prev : candidate;
    });

    previousAvailableProductTypesRef.current = available.slice();
  }, [productTypeOptionsReady, availableProductTypesKey, availableProductTypes]);

  // Analytics queries
  const analyticsParams = useMemo(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      windowHours,
    }),
    [dateRange.startDate, dateRange.endDate, windowHours]
  );

  const hasStoreSelection = selectedStoreIds.length > 0;
  const hasProductTypeSelection = selectedProductTypes.length > 0;

  const storeQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['analytics', 'store', storeId, analyticsParams],
      queryFn: () => getAveragePriceByStore(storeId, analyticsParams),
      enabled: hasStoreSelection && !hasProductTypeSelection,
    })),
  }) as UseQueryResult<AveragePriceData[], Error>[];

  const storeProductTypeCombos = useMemo(
    () =>
      selectedStoreIds.flatMap((storeId) =>
        selectedProductTypes.map((productType) => ({
          storeId,
          productType,
        }))
      ),
    [selectedStoreIds, selectedProductTypes]
  );

  const storeProductTypeQueries = useQueries({
    queries: storeProductTypeCombos.map(({ storeId, productType }) => ({
      queryKey: ['analytics', 'store-product-type', storeId, productType, analyticsParams],
      queryFn: () => getAveragePriceByStoreAndProductType(storeId, productType, analyticsParams),
      enabled: hasStoreSelection && hasProductTypeSelection,
    })),
  }) as UseQueryResult<AveragePriceData[], Error>[];

  const productTypeOnlyQueries = useQueries({
    queries: selectedProductTypes.map((productType) => ({
      queryKey: ['analytics', 'product-type', productType, analyticsParams],
      queryFn: () => getAveragePriceByProductType(productType, analyticsParams),
      enabled: !hasStoreSelection && hasProductTypeSelection,
    })),
  }) as UseQueryResult<AveragePriceData[], Error>[];

  const colorPalette = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#22d3ee', '#f97316'];

  const getStoreLabel = (storeId: string, index: number) => {
    const store = activeStores.find((s) => s._id === storeId);
    return store?.name || `Store ${index + 1}`;
  };

  const storeOnlySeries = selectedStoreIds.map((storeId, index) => ({
    id: `store-${storeId}`,
    label: getStoreLabel(storeId, index),
    color: colorPalette[index % colorPalette.length],
    data: storeQueries[index]?.data ?? [],
  }));

  const storeProductTypeQueryMap = useMemo(() => {
    const map = new Map<string, UseQueryResult<AveragePriceData[], Error>>();
    storeProductTypeCombos.forEach((combo, index) => {
      map.set(`${combo.storeId}::${combo.productType}`, storeProductTypeQueries[index]);
    });
    return map;
  }, [storeProductTypeCombos, storeProductTypeQueries]);

  const storeProductTypeSeries = storeProductTypeCombos.map((combo, index) => {
    const query = storeProductTypeQueryMap.get(`${combo.storeId}::${combo.productType}`);
    const storeIndex = selectedStoreIds.findIndex((id) => id === combo.storeId);
    const productTypeIndex = selectedProductTypes.findIndex((type) => type === combo.productType);
    const colorIndex =
      storeIndex >= 0 && productTypeIndex >= 0
        ? (storeIndex * selectedProductTypes.length + productTypeIndex) % colorPalette.length
        : index % colorPalette.length;

    return {
      id: `store-${combo.storeId}-product-${combo.productType}`,
      label: `${getStoreLabel(combo.storeId, storeIndex)} • ${combo.productType}`,
      color: colorPalette[colorIndex],
      data: query?.data ?? [],
    };
  });

  const productTypeOnlySeries = selectedProductTypes.map((productType, index) => ({
    id: `product-type-${productType}`,
    label: productType,
    color: colorPalette[index % colorPalette.length],
    data: productTypeOnlyQueries[index]?.data ?? [],
  }));

  const storeOnlyLoading = storeQueries.some((query) => query.isLoading);
  const storeOnlyError = storeQueries.find((query) => query.error)?.error;

  const storeProductTypeLoading = storeProductTypeQueries.some((query) => query.isLoading);
  const storeProductTypeError = storeProductTypeQueries.find((query) => query.error)?.error;

  const productTypeOnlyLoading = productTypeOnlyQueries.some((query) => query.isLoading);
  const productTypeOnlyError = productTypeOnlyQueries.find((query) => query.error)?.error;

  const latestAnalyticsUpdate = (() => {
    const timestamps = [
      ...storeQueries.map((query) => query.dataUpdatedAt ?? 0),
      ...storeProductTypeQueries.map((query) => query.dataUpdatedAt ?? 0),
      ...productTypeOnlyQueries.map((query) => query.dataUpdatedAt ?? 0),
    ].filter((timestamp) => timestamp > 0);

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps));
  })();

  const showStoreProductTypeChart = hasStoreSelection && hasProductTypeSelection;
  const showStoreOnlyChart = hasStoreSelection && !hasProductTypeSelection;
  const showProductTypeOnlyChart = !hasStoreSelection && hasProductTypeSelection;
  const showEmptyState = !hasStoreSelection && !hasProductTypeSelection;

  if (storesLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (storesError) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <ErrorMessage message="Failed to load stores. Please refresh the page." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>

      {/* Controls Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        <ChartFilters
          stores={activeStores}
          selectedStoreIds={selectedStoreIds}
          selectedProductTypes={selectedProductTypes}
          availableProductTypes={availableProductTypes}
          windowHours={windowHours}
          productTypesLoading={productTypeOptionsLoading}
          onStoreChange={setSelectedStoreIds}
          onProductTypeChange={setSelectedProductTypes}
          onWindowHoursChange={setWindowHours}
        />
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Active Stores</p>
              <p className="text-2xl font-bold text-gray-900">{activeStores.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date Range</p>
              <p className="text-sm font-medium text-gray-900">
                {Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="text-sm font-medium text-gray-900">
                {latestAnalyticsUpdate ? latestAnalyticsUpdate.toLocaleString() : 'Not yet loaded'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="space-y-6">
        {showStoreProductTypeChart && (
          <div className="space-y-6">
            {storeProductTypeLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : storeProductTypeError ? (
              <ErrorMessage message="Failed to load combined store-product-type analytics." />
            ) : (
              <LineChart
                title="Average Price by Store and Product Type"
                series={storeProductTypeSeries}
                emptyMessage="No data available for the selected store and product type combination."
              />
            )}
          </div>
        )}

        {showStoreOnlyChart && (
          <div>
            {storeOnlyLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : storeOnlyError ? (
              <ErrorMessage message="Failed to load store analytics." />
            ) : (
              <LineChart
                title="Average Price by Store"
                series={storeOnlySeries}
                emptyMessage="No data available for the selected stores."
              />
            )}
          </div>
        )}

        {showProductTypeOnlyChart && (
          <div>
            {productTypeOnlyLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : productTypeOnlyError ? (
              <ErrorMessage message="Failed to load product type analytics." />
            ) : (
              <LineChart
                title={
                  selectedProductTypes.length === 1
                    ? `Average Price by Product Type - ${selectedProductTypes[0]}`
                    : 'Average Price by Product Type'
                }
                series={productTypeOnlySeries}
                emptyMessage="No data available for the selected product types."
              />
            )}
          </div>
        )}

        {showEmptyState && (
          <div className="card">
            <div className="text-center py-12">
              <p className="text-gray-600 mb-2">
                Select a store or product type from the filters to view analytics
              </p>
              <p className="text-sm text-gray-500">
                You can filter by store, product type, or combinations to see price trends over time
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;

