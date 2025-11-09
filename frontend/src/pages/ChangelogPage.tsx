import { useState, useMemo } from 'react';
import { useStores } from '../hooks/useStores';
import { useStoreProducts } from '../hooks/useProducts';
import { useProductChangelogs, useStoreChangelogs, useTagChangelogs, useStoreTagChangelogs } from '../hooks/useChangelog';
import ChangelogTable from '../components/changelog/ChangelogTable';
import ChangelogFilters from '../components/changelog/ChangelogFilters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

function ChangelogPage() {
  // Filter states
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Fetch stores
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();

  // Fetch products for the selected store to get available tags
  const { data: products } = useStoreProducts(selectedStoreId || undefined);

  // Extract unique tags from products
  const availableTags = useMemo(() => {
    if (!products) return [];
    const tags = new Set<string>();
    products.forEach((product) => {
      product.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [products]);

  // Changelog query parameters
  const changelogParams = {
    startDate,
    endDate,
    limit: 100,
  };

  // Determine which changelog query to use based on filters
  const useProductQuery = !selectedStoreId && !selectedTag;
  const useStoreQuery = selectedStoreId && !selectedTag;
  const useTagQuery = !selectedStoreId && selectedTag;
  const useStoreTagQuery = selectedStoreId && selectedTag;

  const { data: productData, isLoading: productLoading, error: productError } = useProductChangelogs(
    useProductQuery ? changelogParams : { ...changelogParams, limit: 0 }
  );

  const { data: storeData, isLoading: storeLoading, error: storeError } = useStoreChangelogs(
    selectedStoreId || 'skip',
    useStoreQuery ? changelogParams : { ...changelogParams, limit: 0 }
  );

  const { data: tagData, isLoading: tagLoading, error: tagError } = useTagChangelogs(
    selectedTag || 'skip',
    useTagQuery ? changelogParams : { ...changelogParams, limit: 0 }
  );

  const { data: storeTagData, isLoading: storeTagLoading, error: storeTagError } = useStoreTagChangelogs(
    selectedStoreId || 'skip',
    selectedTag || 'skip',
    useStoreTagQuery ? changelogParams : { ...changelogParams, limit: 0 }
  );

  // Determine which data to display
  const displayData = useProductQuery
    ? productData
    : useStoreQuery
    ? storeData
    : useTagQuery
    ? tagData
    : useStoreTagQuery
    ? storeTagData
    : [];

  const isLoading = productLoading || storeLoading || tagLoading || storeTagLoading || storesLoading;
  const hasError = productError || storeError || tagError || storeTagError || storesError;

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
        <h1 className="text-3xl font-bold mb-6">Changelog</h1>
        <ErrorMessage message="Failed to load stores. Please refresh the page." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Price Change History</h1>
        <p className="text-gray-600">
          Track all price changes across your monitored stores and products
        </p>
      </div>

      <div className="space-y-6">
        <ChangelogFilters
          stores={stores || []}
          availableTags={availableTags}
          selectedStoreId={selectedStoreId}
          selectedTag={selectedTag}
          startDate={startDate}
          endDate={endDate}
          onStoreChange={(storeId) => {
            setSelectedStoreId(storeId);
            if (!storeId) setSelectedTag('');
          }}
          onTagChange={setSelectedTag}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {isLoading ? (
          <div className="card">
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          </div>
        ) : hasError ? (
          <ErrorMessage message="Failed to load changelog data. Please try again." />
        ) : (
          <ChangelogTable entries={displayData || []} />
        )}
      </div>
    </div>
  );
}

export default ChangelogPage;

