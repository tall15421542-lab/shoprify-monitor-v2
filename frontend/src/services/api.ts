import axios from 'axios';
import type {
  Store,
  AddStoreData,
  Tag,
  ProductType,
  Product,
  AnalyticsParams,
  AveragePriceData,
  ChangelogEntry,
  ChangelogParams,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store APIs
export const getStores = async (): Promise<Store[]> => {
  const response = await api.get<{ count: number; stores: any[] }>('/stores');
  // Transform backend format to frontend format
  return response.data.stores.map(store => ({
    _id: store._id,
    name: store.store_name,
    url: store.store_url,
    status: store.active ? 'active' : 'paused',
    pollingInterval: store.polling_interval || 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
  }));
};

export const addStore = async (data: AddStoreData): Promise<Store> => {
  // Transform frontend format to backend format
  const backendData = {
    store_name: data.name,
    store_url: data.url,
    poll_interval: data.pollingInterval || 60,
  };
  
  const response = await api.post<{ message: string; store: any }>('/stores', backendData);
  const store = response.data.store;
  
  // Transform backend format to frontend format
  return {
    _id: store._id,
    name: store.store_name,
    url: store.store_url,
    status: store.active ? 'active' : 'paused',
    pollingInterval: store.poll_interval || 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
  };
};

export const getStore = async (storeId: string): Promise<Store> => {
  const response = await api.get<{ store: any }>(`/stores/${storeId}`);
  const store = response.data.store;
  // Transform backend format to frontend format
  return {
    _id: store._id,
    name: store.store_name,
    url: store.store_url,
    status: store.active ? 'active' : 'paused',
    pollingInterval: store.polling_interval || 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
  };
};

// Tag APIs
export const getAllTags = async (): Promise<Tag[]> => {
  const response = await api.get<{ count: number; tags: Tag[] }>('/tags');
  return response.data.tags;
};

export const getStoreTags = async (storeId: string): Promise<Tag[]> => {
  const response = await api.get<{ store_id: string; count: number; tags: Tag[] }>(`/stores/${storeId}/tags`);
  return response.data.tags;
};

// Product Type APIs
export const getAllProductTypes = async (): Promise<ProductType[]> => {
  const response = await api.get<{ count: number; product_types: ProductType[] }>('/product-types');
  return response.data.product_types;
};

export const getStoreProductTypes = async (storeId: string): Promise<ProductType[]> => {
  const response = await api.get<{ store_id: string; count: number; product_types: ProductType[] }>(`/stores/${storeId}/product-types`);
  return response.data.product_types;
};

// Product APIs
export const getStoreProducts = async (storeId: string): Promise<Product[]> => {
  const response = await api.get<{ store_id: string; store_name: string; count: number; products: any[] }>(`/stores/${storeId}/products`);
  // Transform backend format to frontend format
  return response.data.products.map(product => {
    // Calculate averaged price change across all variants
    let currentPrice = 0;
    let previousPrice: number | undefined = undefined;
    let priceChange: number | undefined = undefined;
    let priceChangePercent: number | undefined = undefined;
    let hasVariantPriceUp = false;
    let hasVariantPriceDown = false;

    if (product.variants && product.variants.length > 0) {
      // Find the lowest current price variant for display
      const lowestPriceVariant = product.variants.reduce((min: any, v: any) => 
        v.current_price < min.current_price ? v : min
      , product.variants[0]);
      
      currentPrice = lowestPriceVariant.current_price || 0;
      
      // Calculate average price change across ALL variants
      const variantChanges: Array<{ priceChange: number; priceChangePercent: number }> = [];
      
      product.variants.forEach((variant: any) => {
        if (variant.price_history && variant.price_history.length > 1) {
          const currentVariantPrice = variant.current_price;
          const previousVariantPrice = variant.price_history[variant.price_history.length - 2]?.price;
          
          if (previousVariantPrice !== undefined && currentVariantPrice !== previousVariantPrice) {
            const variantPriceChange = currentVariantPrice - previousVariantPrice;
            const variantPriceChangePercent = (variantPriceChange / previousVariantPrice) * 100;
            
            variantChanges.push({
              priceChange: variantPriceChange,
              priceChangePercent: variantPriceChangePercent
            });
            
            // Track if any variants went up or down
            if (currentVariantPrice > previousVariantPrice) {
              hasVariantPriceUp = true;
            } else if (currentVariantPrice < previousVariantPrice) {
              hasVariantPriceDown = true;
            }
          }
        }
      });
      
      // Calculate averages if we have any price changes
      if (variantChanges.length > 0) {
        const totalPriceChange = variantChanges.reduce((sum, v) => sum + v.priceChange, 0);
        const totalPriceChangePercent = variantChanges.reduce((sum, v) => sum + v.priceChangePercent, 0);
        
        priceChange = totalPriceChange / variantChanges.length;
        priceChangePercent = totalPriceChangePercent / variantChanges.length;
        
        // Calculate average previous price for reference
        previousPrice = currentPrice - priceChange;
      }
    }

    return {
      _id: product._id,
      storeId: product.store_id,
      shopifyId: product.product_id?.toString() || '',
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags || [],
      variants: product.variants?.map((v: any) => ({
        id: v.variant_id?.toString() || '',
        title: v.variant_title,
        price: v.current_price?.toString() || '0',
        sku: '',
        available: true,
      })) || [],
      images: product.main_image_url ? [{
        id: '1',
        src: product.main_image_url,
        alt: product.title,
      }] : [],
      currentPrice,
      previousPrice,
      priceChange,
      priceChangePercent,
      hasVariantPriceUp,
      hasVariantPriceDown,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
    };
  });
};

export const getProduct = async (productId: string): Promise<Product> => {
  const response = await api.get<{ product: any }>(`/products/${productId}`);
  const product = response.data.product;
  
  // Calculate averaged price change across all variants (same logic as getStoreProducts)
  let currentPrice = 0;
  let previousPrice: number | undefined = undefined;
  let priceChange: number | undefined = undefined;
  let priceChangePercent: number | undefined = undefined;
  let hasVariantPriceUp = false;
  let hasVariantPriceDown = false;

  if (product.variants && product.variants.length > 0) {
    // Find the lowest current price variant for display
    const lowestPriceVariant = product.variants.reduce((min: any, v: any) => 
      v.current_price < min.current_price ? v : min
    , product.variants[0]);
    
    currentPrice = lowestPriceVariant.current_price || 0;
    
    // Calculate average price change across ALL variants
    const variantChanges: Array<{ priceChange: number; priceChangePercent: number }> = [];
    
    product.variants.forEach((variant: any) => {
      if (variant.price_history && variant.price_history.length > 1) {
        const currentVariantPrice = variant.current_price;
        const previousVariantPrice = variant.price_history[variant.price_history.length - 2]?.price;
        
        if (previousVariantPrice !== undefined && currentVariantPrice !== previousVariantPrice) {
          const variantPriceChange = currentVariantPrice - previousVariantPrice;
          const variantPriceChangePercent = (variantPriceChange / previousVariantPrice) * 100;
          
          variantChanges.push({
            priceChange: variantPriceChange,
            priceChangePercent: variantPriceChangePercent
          });
          
          // Track if any variants went up or down
          if (currentVariantPrice > previousVariantPrice) {
            hasVariantPriceUp = true;
          } else if (currentVariantPrice < previousVariantPrice) {
            hasVariantPriceDown = true;
          }
        }
      }
    });
    
    // Calculate averages if we have any price changes
    if (variantChanges.length > 0) {
      const totalPriceChange = variantChanges.reduce((sum, v) => sum + v.priceChange, 0);
      const totalPriceChangePercent = variantChanges.reduce((sum, v) => sum + v.priceChangePercent, 0);
      
      priceChange = totalPriceChange / variantChanges.length;
      priceChangePercent = totalPriceChangePercent / variantChanges.length;
      
      // Calculate average previous price for reference
      previousPrice = currentPrice - priceChange;
    }
  }
  
  // Transform backend format to frontend format
  return {
    _id: product._id,
    storeId: product.store_id,
    shopifyId: product.product_id?.toString() || '',
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    productType: product.product_type,
    tags: product.tags || [],
    variants: product.variants?.map((v: any) => ({
      id: v.variant_id?.toString() || '',
      title: v.variant_title,
      price: v.current_price?.toString() || '0',
      sku: '',
      available: true,
    })) || [],
    images: product.main_image_url ? [{
      id: '1',
      src: product.main_image_url,
      alt: product.title,
    }] : [],
    currentPrice,
    previousPrice,
    priceChange,
    priceChangePercent,
    hasVariantPriceUp,
    hasVariantPriceDown,
    createdAt: new Date(product.created_at),
    updatedAt: new Date(product.updated_at),
  };
};

// Price History APIs
export const getProductPriceHistory = async (
  productId: string,
  params: { startDate: Date; endDate: Date }
): Promise<any> => {
  const response = await api.get<{
    product_id: string;
    product_title: string;
    variants: Array<{
      variant_id: number;
      variant_title: string;
      current_price: number;
      price_history: Array<{
        price: number;
        recorded_at: string;
      }>;
    }>;
  }>(`/products/${productId}/price-history`, {
    params: {
      start_date: params.startDate.toISOString(),
      end_date: params.endDate.toISOString(),
    },
  });
  
  // Return both flattened array (for backward compatibility) and by-variant data
  return {
    allHistory: response.data.variants.flatMap(variant =>
      variant.price_history.map(entry => ({
        timestamp: new Date(entry.recorded_at),
        price: entry.price,
        variant: variant.variant_title,
      }))
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    byVariant: response.data.variants.map(variant => ({
      variantId: variant.variant_id,
      variantTitle: variant.variant_title,
      currentPrice: variant.current_price,
      priceHistory: variant.price_history.map(entry => ({
        timestamp: new Date(entry.recorded_at),
        price: entry.price,
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    })),
  };
};

// Analytics APIs
export const getAveragePriceByStore = async (
  storeId: string,
  params: AnalyticsParams
): Promise<AveragePriceData[]> => {
  const response = await api.get<{
    store_id: string;
    window_hours: number;
    count: number;
    data: Array<{
      window_start: string;
      avg_price: number;
      product_count: number;
    }>;
  }>(`/analytics/stores/${storeId}/average-price`, {
    params: {
      start_date: params.startDate.toISOString(),
      end_date: params.endDate.toISOString(),
      window_hours: params.windowHours || 24,
    },
  });
  
  // Transform backend format to frontend format
  return response.data.data.map(item => ({
    timestamp: new Date(item.window_start),
    averagePrice: item.avg_price,
    productCount: item.product_count,
  }));
};

export const getAveragePriceByTag = async (
  tag: string,
  params: AnalyticsParams
): Promise<AveragePriceData[]> => {
  const response = await api.get<{
    tag: string;
    window_hours: number;
    count: number;
    data: Array<{
      window_start: string;
      avg_price: number;
      product_count: number;
    }>;
  }>(`/analytics/tags/${encodeURIComponent(tag)}/average-price`, {
    params: {
      start_date: params.startDate.toISOString(),
      end_date: params.endDate.toISOString(),
      window_hours: params.windowHours || 24,
    },
  });
  
  // Transform backend format to frontend format
  return response.data.data.map(item => ({
    timestamp: new Date(item.window_start),
    averagePrice: item.avg_price,
    productCount: item.product_count,
  }));
};

export const getAveragePriceByStoreAndTag = async (
  storeId: string,
  tag: string,
  params: AnalyticsParams
): Promise<AveragePriceData[]> => {
  const response = await api.get<{
    store_id: string;
    tag: string;
    window_hours: number;
    count: number;
    data: Array<{
      window_start: string;
      avg_price: number;
      product_count: number;
    }>;
  }>(
    `/analytics/stores/${storeId}/tags/${encodeURIComponent(tag)}/average-price`,
    {
      params: {
        start_date: params.startDate.toISOString(),
        end_date: params.endDate.toISOString(),
        window_hours: params.windowHours || 24,
      },
    }
  );

  // Transform backend format to frontend format
  return response.data.data.map(item => ({
    timestamp: new Date(item.window_start),
    averagePrice: item.avg_price,
    productCount: item.product_count,
  }));
};

export const getAveragePriceByProductType = async (
  productType: string,
  params: AnalyticsParams
): Promise<AveragePriceData[]> => {
  const response = await api.get<{
    product_type: string;
    window_hours: number;
    count: number;
    data: Array<{
      window_start: string;
      avg_price: number;
      product_count: number;
      store_count?: number;
    }>;
  }>(`/analytics/product-types/${encodeURIComponent(productType)}/average-price`, {
    params: {
      start_date: params.startDate.toISOString(),
      end_date: params.endDate.toISOString(),
      window_hours: params.windowHours || 24,
    },
  });

  // Transform backend format to frontend format
  return response.data.data.map(item => ({
    timestamp: new Date(item.window_start),
    averagePrice: item.avg_price,
    productCount: item.product_count,
  }));
};

export const getAveragePriceByStoreAndProductType = async (
  storeId: string,
  productType: string,
  params: AnalyticsParams
): Promise<AveragePriceData[]> => {
  const response = await api.get<{
    store_id: string;
    product_type: string;
    window_hours: number;
    count: number;
    data: Array<{
      window_start: string;
      avg_price: number;
      product_count: number;
    }>;
  }>(
    `/analytics/stores/${storeId}/product-types/${encodeURIComponent(productType)}/average-price`,
    {
      params: {
        start_date: params.startDate.toISOString(),
        end_date: params.endDate.toISOString(),
        window_hours: params.windowHours || 24,
      },
    }
  );

  // Transform backend format to frontend format
  return response.data.data.map(item => ({
    timestamp: new Date(item.window_start),
    averagePrice: item.avg_price,
    productCount: item.product_count,
  }));
};

// Changelog APIs
export const getProductChangelogs = async (params: ChangelogParams): Promise<ChangelogEntry[]> => {
  const response = await api.get<ChangelogEntry[]>('/changelogs/products', {
    params: {
      ...params,
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
    },
  });
  return response.data;
};

export const getStoreChangelogs = async (
  storeId: string,
  params: ChangelogParams
): Promise<ChangelogEntry[]> => {
  const response = await api.get<ChangelogEntry[]>(`/changelogs/stores/${storeId}`, {
    params: {
      ...params,
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
    },
  });
  return response.data;
};

export const getTagChangelogs = async (
  tag: string,
  params: ChangelogParams
): Promise<ChangelogEntry[]> => {
  const response = await api.get<ChangelogEntry[]>(`/changelogs/tags/${tag}`, {
    params: {
      ...params,
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
    },
  });
  return response.data;
};

export const getStoreTagChangelogs = async (
  storeId: string,
  tag: string,
  params: ChangelogParams
): Promise<ChangelogEntry[]> => {
  const response = await api.get<ChangelogEntry[]>(`/changelogs/stores/${storeId}/tags/${tag}`, {
    params: {
      ...params,
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
    },
  });
  return response.data;
};

// Update APIs - Manual Polling and Aggregation
export interface UpdateResult {
  pollResult: {
    total_stores?: number;
    successful_stores?: number;
    failed_stores?: number;
    total_products?: number;
    products_saved?: number;
    errors?: number;
    price_snapshots?: number;
    store_id?: string;
    store_name?: string;
  };
  aggregationResult: {
    store_averages: number;
    tag_averages: number;
    store_tag_averages: number;
  };
}

/**
 * Update all stores - Poll all stores and aggregate current hour data
 */
export const updateAllStores = async (): Promise<UpdateResult> => {
  // First poll all stores
  const pollResponse = await api.post('/poll/all');
  
  // Then aggregate current hour data
  const aggregationResponse = await api.post('/aggregate/current');
  
  return {
    pollResult: pollResponse.data.results || {},
    aggregationResult: aggregationResponse.data.results || {},
  };
};

/**
 * Update a single store - Poll the store and aggregate current hour data
 */
export const updateStore = async (storeId: string): Promise<UpdateResult> => {
  // First poll the specific store
  const pollResponse = await api.post(`/poll/store/${storeId}`);
  
  // Then aggregate current hour data
  const aggregationResponse = await api.post('/aggregate/current');
  
  return {
    pollResult: pollResponse.data.results || {},
    aggregationResult: aggregationResponse.data.results || {},
  };
};

export default api;

