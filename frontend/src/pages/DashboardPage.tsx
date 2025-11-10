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
import MonitoringSubscribeButton, { SubscriptionTarget } from '../components/monitoring/MonitoringSubscribeButton';

function DashboardPage() {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

  const storeLookup = useMemo(() => {
    const map = new Map<string, string>();
    activeStores.forEach((store) => {
      map.set(store._id, store.name);
    });
    return map;
  }, [activeStores]);

  const storeSubscriptionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (stores ?? []).forEach((store) => {
      map.set(store._id, store.monitoring?.store?.subscribed ?? false);
    });
    return map;
  }, [stores]);

  const productTypeSubscriptionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (allProductTypes ?? []).forEach((item) => {
      map.set(item.product_type, item.monitoring?.productType?.subscribed ?? false);
    });
    return map;
  }, [allProductTypes]);

  const storeProductTypeSubscriptionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    selectedStoreIds.forEach((storeId, index) => {
      const data = productTypeOptionsQueries[index]?.data;
      data?.forEach((item) => {
        const key = `${storeId}::${item.product_type}`;
        map.set(key, item.monitoring?.storeProductType?.subscribed ?? false);
      });
    });
    return map;
  }, [selectedStoreIds, productTypeOptionsQueries]);

  const subscribeTargets: SubscriptionTarget[] = useMemo(() => {
    const targets: SubscriptionTarget[] = [];

    if (hasStoreSelection && hasProductTypeSelection) {
      selectedStoreIds.forEach((storeId) => {
        selectedProductTypes.forEach((productType) => {
          const label = `${storeLookup.get(storeId) ?? storeId} • ${productType}`;
          targets.push({
            scopeType: 'store_product_type',
            scope: { storeId, productType },
            label,
          });
        });
      });
      return targets;
    }

    if (hasStoreSelection) {
      selectedStoreIds.forEach((storeId) => {
        targets.push({
          scopeType: 'store',
          scope: { storeId },
          label: storeLookup.get(storeId) ?? storeId,
        });
      });
      return targets;
    }

    if (hasProductTypeSelection) {
      selectedProductTypes.forEach((productType) => {
        targets.push({
          scopeType: 'product_type',
          scope: { productType },
          label: productType,
        });
      });
      return targets;
    }

    return targets;
  }, [hasStoreSelection, hasProductTypeSelection, selectedStoreIds, selectedProductTypes, storeLookup]);

  const [selectedSubscriptionKeys, setSelectedSubscriptionKeys] = useState<string[]>([]);
  const [pendingSubscribedKeys, setPendingSubscribedKeys] = useState<string[]>([]);

  const getTargetKey = (target: SubscriptionTarget) => `${target.scopeType}:${JSON.stringify(target.scope)}`;

  const computedTargets = useMemo(
    () =>
      subscribeTargets.map((target) => {
        const key = getTargetKey(target);
        let subscribed = false;
        switch (target.scopeType) {
          case 'store':
            subscribed = storeSubscriptionMap.get(target.scope.storeId ?? '') ?? false;
            break;
          case 'product_type':
            subscribed = productTypeSubscriptionMap.get(target.scope.productType ?? '') ?? false;
            break;
          case 'store_product_type': {
            const comboKey = `${target.scope.storeId ?? ''}::${target.scope.productType ?? ''}`;
            subscribed = storeProductTypeSubscriptionMap.get(comboKey) ?? false;
            break;
          }
          default:
            subscribed = false;
        }
        return {
          target,
          key,
          subscribed,
        };
      }),
    [subscribeTargets, storeSubscriptionMap, productTypeSubscriptionMap, storeProductTypeSubscriptionMap]
  );

  const pendingSubscribedKeySet = useMemo(() => new Set(pendingSubscribedKeys), [pendingSubscribedKeys]);

  const subscribedTargets = useMemo(
    () =>
      computedTargets.filter(
        (item) => item.subscribed || pendingSubscribedKeySet.has(item.key)
      ),
    [computedTargets, pendingSubscribedKeySet]
  );

  const unsubscribedTargets = useMemo(
    () =>
      computedTargets.filter(
        (item) => !item.subscribed && !pendingSubscribedKeySet.has(item.key)
      ),
    [computedTargets, pendingSubscribedKeySet]
  );

  useEffect(() => {
    const backendSubscribedKeys = new Set(
      computedTargets.filter((item) => item.subscribed).map((item) => item.key)
    );
    const availableKeys = new Set(computedTargets.map((item) => item.key));
    setPendingSubscribedKeys((prev) =>
      prev.filter((key) => availableKeys.has(key) && !backendSubscribedKeys.has(key))
    );
  }, [computedTargets]);

  useEffect(() => {
    if (unsubscribedTargets.length === 0) {
      setSelectedSubscriptionKeys([]);
      return;
    }

    const validKeys = new Set(unsubscribedTargets.map((item) => item.key));
    setSelectedSubscriptionKeys((prev) => prev.filter((key) => validKeys.has(key)));
  }, [unsubscribedTargets]);

  const selectedSubscribeTargets = useMemo(
    () =>
      unsubscribedTargets
        .filter((item) => selectedSubscriptionKeys.includes(item.key))
        .map((item) => item.target),
    [selectedSubscriptionKeys, unsubscribedTargets]
  );

  const toggleSubscriptionSelection = (key: string) => {
    setSelectedSubscriptionKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((existingKey) => existingKey !== key);
      }
      if (!unsubscribedTargets.find((item) => item.key === key)) {
        return prev;
      }
      return [...prev, key];
    });
  };

  const subscribeDescription = useMemo(() => {
    if (computedTargets.length === 0) {
      return 'Select stores or product types to enable monitoring subscriptions.';
    }
    if (hasStoreSelection && hasProductTypeSelection) {
      return 'Select store and product type combinations below to create targeted subscriptions.';
    }
    if (hasStoreSelection) {
      return 'Select the stores below to create store-level monitoring subscriptions.';
    }
    return 'Select product types below to monitor changes across all stores.';
  }, [computedTargets.length, hasStoreSelection, hasProductTypeSelection]);

  const handleSubscriptionSuccess = (successes: Array<{ target: SubscriptionTarget }>) => {
    if (!successes || successes.length === 0) {
      return;
    }
    setPendingSubscribedKeys((prev) => {
      const set = new Set(prev);
      successes.forEach(({ target }) => {
        set.add(getTargetKey(target));
      });
      return Array.from(set);
    });
    setSelectedSubscriptionKeys([]);
  };

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
          <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Monitoring Subscriptions</h4>
              <p className="text-xs text-gray-500">{subscribeDescription}</p>
            </div>
            {subscribedTargets.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Subscribed Targets
                </h5>
                <ul className="space-y-2">
                  {subscribedTargets.map(({ key, target }) => (
                    <li
                      key={`subscribed-${key}`}
                      className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-100 rounded-md text-sm text-green-800"
                    >
                      <span className="flex-1 truncate">{target.label}</span>
                      <span className="ml-3 text-[11px] font-medium uppercase tracking-wide text-green-600">
                        {target.scopeType.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unsubscribedTargets.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
                {unsubscribedTargets.map(({ key, target }) => {
                  const checked = selectedSubscriptionKeys.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 transition"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={checked}
                        onChange={() => toggleSubscriptionSelection(key)}
                      />
                      <span className="flex-1 truncate">{target.label}</span>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        {target.scopeType.replace(/_/g, ' ')}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-md text-sm text-gray-600">
                All selections already have monitoring subscriptions.
              </div>
            )}
            <MonitoringSubscribeButton
              targets={selectedSubscribeTargets}
              buttonVariant="primary"
              buttonSize="md"
              disabled={selectedSubscribeTargets.length === 0}
              label="Subscribe to Monitoring"
              description={subscribeDescription}
              onSubscriptionSuccess={handleSubscriptionSuccess}
            />
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

