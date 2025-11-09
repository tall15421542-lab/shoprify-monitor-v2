import { useState, useMemo, useEffect } from 'react';
import { useStores } from '../hooks/useStores';
import { useTags } from '../hooks/useTags';
import { useAveragePriceByStore, useAveragePriceByTag, useAveragePriceByStoreAndTag } from '../hooks/useAnalytics';
import DateRangePicker from '../components/charts/DateRangePicker';
import ChartFilters from '../components/charts/ChartFilters';
import LineChart from '../components/charts/LineChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import type { DateRange } from '../types';

function DashboardPage() {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  // Filter states
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [windowHours, setWindowHours] = useState<number>(24);

  // Fetch stores
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();

  // Fetch tags - filtered by store if a store is selected, otherwise all tags
  const { data: tags } = useTags(selectedStoreId || undefined);

  // Extract tag names from the tags data
  const availableTags = useMemo(() => {
    if (!tags) return [];
    return tags.map(t => t.tag).sort();
  }, [tags]);

  // Clear selected tag if it's not available in the current tag list
  useEffect(() => {
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [availableTags, selectedTag]);

  // Analytics queries
  const analyticsParams = {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    windowHours,
  };

  const { data: storeData, isLoading: storeLoading, error: storeError } = useAveragePriceByStore(
    selectedStoreId || undefined,
    analyticsParams
  );

  const { data: tagData, isLoading: tagLoading, error: tagError } = useAveragePriceByTag(
    selectedTag || undefined,
    analyticsParams
  );

  const { data: storeTagData, isLoading: storeTagLoading, error: storeTagError } = useAveragePriceByStoreAndTag(
    selectedStoreId || undefined,
    selectedTag || undefined,
    analyticsParams
  );

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
          selectedStoreId={selectedStoreId}
          selectedTag={selectedTag}
          availableTags={availableTags}
          windowHours={windowHours}
          onStoreChange={setSelectedStoreId}
          onTagChange={setSelectedTag}
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
        {/* Store & Tag Combined Chart - Show this when both are selected */}
        {selectedStoreId && selectedTag ? (
          <div>
            {storeTagLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : storeTagError ? (
              <ErrorMessage message="Failed to load combined analytics." />
            ) : (
              <LineChart
                data={storeTagData || []}
                title={`Average Price - ${stores?.find(s => s._id === selectedStoreId)?.name} - ${selectedTag}`}
                color="#f59e0b"
              />
            )}
          </div>
        ) : selectedStoreId ? (
          /* Store Chart - Show this when only store is selected */
          <div>
            {storeLoading ? (
              <div className="card">
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              </div>
            ) : storeError ? (
              <ErrorMessage message="Failed to load store analytics." />
            ) : (
              <LineChart
                data={storeData || []}
                title={`Average Price - ${stores?.find(s => s._id === selectedStoreId)?.name || 'Store'}`}
                color="#0ea5e9"
              />
            )}
          </div>
        ) : selectedTag ? (
          /* Tag Chart - Show this when only tag is selected */
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
                data={tagData || []}
                title={`Average Price by Tag - ${selectedTag}`}
                color="#8b5cf6"
              />
            )}
          </div>
        ) : (
          /* Empty State - Show when nothing is selected */
          <div className="card">
            <div className="text-center py-12">
              <p className="text-gray-600 mb-2">
                Select a store or tag from the filters to view analytics
              </p>
              <p className="text-sm text-gray-500">
                You can filter by store, tag, or both to see price trends over time
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;

