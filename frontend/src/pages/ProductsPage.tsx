import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { useStore } from '../hooks/useStores';
import { useStoreProducts } from '../hooks/useProducts';
import ProductGrid from '../components/products/ProductGrid';
import ProductFilters, { PriceSortOption, PriceChangeFilter } from '../components/products/ProductFilters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';

function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data: store } = useStore(storeId);
  const { data: products, isLoading, error, refetch } = useStoreProducts(storeId);
  
  // Filter and sort state
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [priceChangeFilter, setPriceChangeFilter] = useState<PriceChangeFilter>('all');
  const [priceSort, setPriceSort] = useState<PriceSortOption>('none');
  
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
        <h1 className="text-3xl font-bold mb-2">
          {store?.name || 'Store'} Products
        </h1>
        {store && (
          <p className="text-gray-600">
            {products?.length || 0} products • Updates every {store.pollingInterval} hours
          </p>
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

