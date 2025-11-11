import { useParams, Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { useStore } from '../hooks/useStores';
import { useStoreProducts } from '../hooks/useProducts';
import ProductGrid from '../components/products/ProductGrid';
import ProductFilters, { PriceSortOption, PriceChangeFilter } from '../components/products/ProductFilters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { formatPollingInterval } from '../utils/time';
import MonitoringSubscribeButton from '../components/monitoring/MonitoringSubscribeButton';

function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data: store } = useStore(storeId);
  const { data: products, isLoading, error, refetch } = useStoreProducts(storeId);
  
  // Filter and sort state
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [priceChangeFilter, setPriceChangeFilter] = useState<PriceChangeFilter>('all');
  const [priceSort, setPriceSort] = useState<PriceSortOption>('none');

  const pollingIntervalText = useMemo(
    () => formatPollingInterval(store?.pollingInterval),
    [store?.pollingInterval]
  );

  const lastUpdatedText = useMemo(() => {
    if (!store?.lastFetch) {
      return null;
    }

    try {
      return new Date(store.lastFetch).toLocaleString();
    } catch {
      return null;
    }
  }, [store?.lastFetch]);
  
  // Extract unique product types from products
  const productTypes = useMemo(() => {
    if (!products) return [];
    const types = new Set<string>();
    products.forEach(product => {
      if (product.productType) {
        types.add(product.productType);
      }
    });
    return Array.from(types).sort();
  }, [products]);
  
  // Apply filters and sorting
  const filteredAndSortedProducts = useMemo(() => {
    if (!products) return [];
    
    // First, filter by product type
    let filtered = [...products];
    if (selectedProductType) {
      filtered = filtered.filter(p => p.productType === selectedProductType);
    }
    
    // Second, filter by price change direction
    if (priceChangeFilter === 'price-up') {
      filtered = filtered.filter(p => p.hasVariantPriceUp);
    } else if (priceChangeFilter === 'price-down') {
      filtered = filtered.filter(p => p.hasVariantPriceDown);
    }
    
    // Finally, apply sorting
    if (priceSort === 'price-asc') {
      filtered.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (priceSort === 'price-desc') {
      filtered.sort((a, b) => b.currentPrice - a.currentPrice);
    }
    
    return filtered;
  }, [products, selectedProductType, priceChangeFilter, priceSort]);

  const subscribeTargets = useMemo(() => {
    if (!storeId) {
      return [];
    }

    if (selectedProductType) {
      return [
        {
          scopeType: 'store_product_type' as const,
          scope: { storeId, productType: selectedProductType },
          label: `${store?.name ?? 'Store'} • ${selectedProductType}`,
        },
      ];
    }

    if (store) {
      return [
        {
          scopeType: 'store' as const,
          scope: { storeId },
          label: store.name,
        },
      ];
    }

    return [];
  }, [storeId, selectedProductType, store]);

  const subscribeDescription = selectedProductType
    ? 'Monitor price changes for this store and product type combination.'
    : 'Monitor price changes across all products in this store.';

  const storeSubscribed = store?.monitoring?.store?.subscribed ?? false;
  const [localStoreSubscribed, setLocalStoreSubscribed] = useState(storeSubscribed);

  useEffect(() => {
    setLocalStoreSubscribed(storeSubscribed);
  }, [storeSubscribed]);

  const storeProductTypeSubscribed = useMemo(() => {
    if (!selectedProductType || !products) {
      return false;
    }

    return products.some(
      (product) =>
        product.productType === selectedProductType &&
        (product.monitoring?.storeProductType?.subscribed ?? false)
    );
  }, [selectedProductType, products]);

  const [localStoreProductTypeSubscribed, setLocalStoreProductTypeSubscribed] = useState(
    storeProductTypeSubscribed
  );

  useEffect(() => {
    setLocalStoreProductTypeSubscribed(storeProductTypeSubscribed);
  }, [storeProductTypeSubscribed, selectedProductType]);

  const subscribeButtonLabel = selectedProductType
    ? localStoreProductTypeSubscribed ? 'Subscribed' : 'Subscribe'
    : localStoreSubscribed ? 'Subscribed' : 'Subscribe';
  const isSubscribeButtonActive = selectedProductType ? localStoreProductTypeSubscribed : localStoreSubscribed;
  const subscribeButtonVariant = isSubscribeButtonActive ? 'success' : 'primary';

  const handleSubscriptionSuccess = () => {
    if (selectedProductType) {
      setLocalStoreProductTypeSubscribed(true);
    } else {
      setLocalStoreSubscribed(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link
          to="/stores"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Stores
        </Link>
        <h1 className="text-3xl font-bold mb-6">Products</h1>
        <ErrorMessage
          message="Failed to load products. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/stores"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Stores
      </Link>

      <div className="mb-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">
            {store?.name || 'Store'} Products
          </h1>
        </div>

        {store && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <Package size={18} className="text-primary-600" />
            <span className="font-medium text-gray-900">
              {products?.length || 0} products
            </span>
            <span className="text-gray-400">·</span>
            <span>Updates every {pollingIntervalText}</span>
            <span className="text-gray-400">·</span>
            <span>
              {lastUpdatedText
                ? `Last updated ${lastUpdatedText}`
                : 'Last updated: Not yet updated'}
            </span>
            <MonitoringSubscribeButton
              targets={subscribeTargets}
              label={subscribeButtonLabel}
              buttonVariant={subscribeButtonVariant}
              buttonSize="sm"
              disabled={subscribeTargets.length === 0}
              description={subscribeDescription}
              onSubscriptionSuccess={handleSubscriptionSuccess}
              className="ml-2"
            />
          </div>
        )}
      </div>

      {products && products.length > 0 && (
        <ProductFilters
          selectedProductType={selectedProductType}
          onProductTypeChange={setSelectedProductType}
          priceChangeFilter={priceChangeFilter}
          onPriceChangeFilterChange={setPriceChangeFilter}
          priceSort={priceSort}
          onPriceSortChange={setPriceSort}
          productTypes={productTypes}
          totalProducts={products.length}
          filteredCount={filteredAndSortedProducts.length}
        />
      )}

      {products && products.length > 0 ? (
        filteredAndSortedProducts.length > 0 ? (
          <ProductGrid products={filteredAndSortedProducts} />
        ) : (
          <EmptyState
            icon={Package}
            title="No products match your filters"
            description="Try adjusting your filters to see more products."
          />
        )
      ) : (
        <EmptyState
          icon={Package}
          title="No products found"
          description="This store doesn't have any products yet. Products will appear here after the first data fetch."
        />
      )}
    </div>
  );
}

export default ProductsPage;

