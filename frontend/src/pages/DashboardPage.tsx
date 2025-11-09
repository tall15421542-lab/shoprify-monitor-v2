import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useStores } from '../hooks/useStores';
import { useTags } from '../hooks/useTags';
import { useProductTypes } from '../hooks/useProductTypes';
import { useAveragePriceByTag } from '../hooks/useAnalytics';
import {
  getAveragePriceByStore,
  getAveragePriceByStoreAndProductType,
  getAveragePriceByStoreAndTag,
  getAveragePriceByProductType,
  getStoreProductTypes,
  getStoreTags,
} from '../services/api';
import DateRangePicker from '../components/charts/DateRangePicker';
import ChartFilters from '../components/charts/ChartFilters';
import LineChart from '../components/charts/LineChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import type { AveragePriceData, DateRange, ProductType, Tag } from '../types';

function DashboardPage() {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  // Filter states
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState<number>(24);

  // Fetch stores
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();

  const hasInitializedStoresRef = useRef(false);
  const previousStoreIdsRef = useRef<string[]>([]);
  const hasInitializedProductTypesRef = useRef(false);
  const previousAvailableProductTypesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!stores) return;
    const storeIds = stores.map((store) => store._id);
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
  }, [stores]);

  const { data: allTags, isLoading: allTagsLoading } = useTags();

  const { data: allProductTypes, isLoading: allProductTypesLoading } = useProductTypes();

  // Extract tag names from the tags data
  const tagOptionsQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['tags', 'store', storeId],
      queryFn: () => getStoreTags(storeId),
      enabled: selectedStoreIds.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  }) as UseQueryResult<Tag[], Error>[];

  const productTypeOptionsQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['product-types', 'store', storeId],
      queryFn: () => getStoreProductTypes(storeId),
      enabled: selectedStoreIds.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  }) as UseQueryResult<ProductType[], Error>[];

  const availableTags = (() => {
    if (selectedStoreIds.length === 0) {
      return (allTags || []).map((tag) => tag.tag).sort();
    }

    if (tagOptionsQueries.length === 0 || tagOptionsQueries.some((query) => !query.data)) {
      return [];
    }

    const tagLists = tagOptionsQueries.map((query) => query.data!.map((tag) => tag.tag));
    const [first, ...rest] = tagLists;
    const intersection = first.filter((tag) => rest.every((tags) => tags.includes(tag)));

    return Array.from(new Set(intersection)).sort();
  })();

  const availableTagsKey = availableTags.join('|');

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

  // Clear selected tag if it's not available in the current tag list
  const tagsOptionsLoading =
    selectedStoreIds.length === 0 ? allTagsLoading : tagOptionsQueries.some((query) => query.isLoading);
  const productTypeOptionsLoading =
    selectedStoreIds.length === 0
      ? allProductTypesLoading
      : productTypeOptionsQueries.some((query) => query.isLoading);

  const tagsOptionsReady =
    selectedStoreIds.length === 0 ? !allTagsLoading : tagOptionsQueries.every((query) => query.isSuccess);
  const productTypeOptionsReady =
    selectedStoreIds.length === 0
      ? !allProductTypesLoading
      : productTypeOptionsQueries.every((query) => query.isSuccess);

  useEffect(() => {
    if (!tagsOptionsReady) return;
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [tagsOptionsReady, availableTagsKey, selectedTag]);

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
      enabled: hasStoreSelection && !selectedTag && !hasProductTypeSelection,
    })),
  }) as UseQueryResult<AveragePriceData[], Error>[];

  const storeTagQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['analytics', 'store-tag', storeId, selectedTag, analyticsParams],
      queryFn: () => getAveragePriceByStoreAndTag(storeId, selectedTag!, analyticsParams),
      enabled: hasStoreSelection && !!selectedTag && !hasProductTypeSelection,
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

  const { data: tagData, isLoading: tagLoading, error: tagError } = useAveragePriceByTag(
    selectedTag || undefined,
    analyticsParams
  );

  const productTypeOnlyQueries = useQueries({
    queries: selectedProductTypes.map((productType) => ({
      queryKey: ['analytics', 'product-type', productType, analyticsParams],
      queryFn: () => getAveragePriceByProductType(productType, analyticsParams),
      enabled: !hasStoreSelection && hasProductTypeSelection,
    })),
  }) as UseQueryResult<AveragePriceData[], Error>[];

  const colorPalette = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#22d3ee', '#f97316'];

  const getStoreLabel = (storeId: string, index: number) => {
    const store = stores?.find((s) => s._id === storeId);
    return store?.name || `Store ${index + 1}`;
  };

  const storeOnlySeries = selectedStoreIds.map((storeId, index) => ({
    id: `store-${storeId}`,
    label: getStoreLabel(storeId, index),
    color: colorPalette[index % colorPalette.length],
    data: storeQueries[index]?.data ?? [],
  }));

  const storeTagSeries = selectedStoreIds.map((storeId, index) => ({
    id: `store-${storeId}`,
    label: getStoreLabel(storeId, index),
    color: colorPalette[index % colorPalette.length],
    data: storeTagQueries[index]?.data ?? [],
  }));

  const storeProductTypeQueryMap = useMemo(() => {
    const map = new Map<string, UseQueryResult<AveragePriceData[], Error>>();
    storeProductTypeCombos.forEach((combo, index) => {
      map.set(`${combo.storeId}::${combo.productType}`, storeProductTypeQueries[index]);
    });
    return map;
  }, [storeProductTypeCombos, storeProductTypeQueries]);

  const storeProductTypeSections = selectedProductTypes.map((productType) => ({
    productType,
    series: selectedStoreIds.map((storeId, index) => {
      const query = storeProductTypeQueryMap.get(`${storeId}::${productType}`);
      return {
        id: `store-${storeId}-product-${productType}`,
        label: getStoreLabel(storeId, index),
        color: colorPalette[index % colorPalette.length],
        data: query?.data ?? [],
      };
    }),
  }));

  const productTypeOnlySeries = selectedProductTypes.map((productType, index) => ({
    id: `product-type-${productType}`,
    label: productType,
    color: colorPalette[index % colorPalette.length],
    data: productTypeOnlyQueries[index]?.data ?? [],
  }));

  const storeOnlyLoading = storeQueries.some((query) => query.isLoading);
  const storeOnlyError = storeQueries.find((query) => query.error)?.error;

  const storeTagLoading = storeTagQueries.some((query) => query.isLoading);
  const storeTagError = storeTagQueries.find((query) => query.error)?.error;

  const storeProductTypeLoading = storeProductTypeQueries.some((query) => query.isLoading);
  const storeProductTypeError = storeProductTypeQueries.find((query) => query.error)?.error;

  const productTypeOnlyLoading = productTypeOnlyQueries.some((query) => query.isLoading);
  const productTypeOnlyError = productTypeOnlyQueries.find((query) => query.error)?.error;

  const showStoreProductTypeChart = hasStoreSelection && hasProductTypeSelection;
  const showStoreTagChart = hasStoreSelection && !!selectedTag && !hasProductTypeSelection;
  const showStoreOnlyChart = hasStoreSelection && !selectedTag && !hasProductTypeSelection;
  const showTagOnlyChart = !hasStoreSelection && !!selectedTag;
  const showProductTypeOnlyChart = !hasStoreSelection && hasProductTypeSelection;
  const showEmptyState = !hasStoreSelection && !selectedTag && !hasProductTypeSelection;

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
          stores={stores || []}
          selectedStoreIds={selectedStoreIds}
          selectedProductTypes={selectedProductTypes}
          selectedTag={selectedTag}
          availableTags={availableTags}
          availableProductTypes={availableProductTypes}
          windowHours={windowHours}
          tagsLoading={tagsOptionsLoading}
          productTypesLoading={productTypeOptionsLoading}
          onStoreChange={setSelectedStoreIds}
          onTagChange={setSelectedTag}
          onProductTypeChange={setSelectedProductTypes}
          onWindowHoursChange={setWindowHours}
        />
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Stores</p>
              <p className="text-2xl font-bold text-gray-900">{stores?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date Range</p>
              <p className="text-sm font-medium text-gray-900">
                {Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))} days
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
              storeProductTypeSections.map((section) => (
                <LineChart
                  key={section.productType}
                  title={`Average Price by Store • Product Type: ${section.productType}`}
                  series={section.series}
                  emptyMessage="No data available for the selected store and product type combination."
                />
              ))
            )}
          </div>
        )}

        {showStoreTagChart && (
          <div>
            {storeTagLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : storeTagError ? (
              <ErrorMessage message="Failed to load combined store-tag analytics." />
            ) : (
              <LineChart
                title={`Average Price by Store • Tag: ${selectedTag}`}
                series={storeTagSeries}
                emptyMessage="No data available for the selected store and tag combination."
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

        {showTagOnlyChart && (
          <div>
            {tagLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : tagError ? (
              <ErrorMessage message="Failed to load tag analytics." />
            ) : (
              <LineChart
                title={`Average Price by Tag - ${selectedTag}`}
                series={[
                  {
                    id: `tag-${selectedTag}`,
                    label: selectedTag,
                    color: '#8b5cf6',
                    data: tagData || [],
                  },
                ]}
                emptyMessage="No data available for the selected tag."
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
                Select a store, tag, or product type from the filters to view analytics
              </p>
              <p className="text-sm text-gray-500">
                You can filter by store, tag, product type, or combinations to see price trends over time
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;

