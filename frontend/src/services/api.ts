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
  MonitoringSubscription,
  MonitoringScopeKey,
  CreateMonitoringSubscriptionInput,
  MonitoringChangeLogParams,
  MonitoringChangeLogResponse,
  MonitoringChangeLogEntry,
  MonitoringScopeType,
  MonitoringUnreadCounter,
} from '../types';

const env =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ??
  {};

const API_BASE_URL =
  env.VITE_API_BASE_URL ||
  'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function toScopeKeyPayload(scopeType: MonitoringScopeType, scope: MonitoringScopeKey) {
  switch (scopeType) {
    case 'product':
      if (!scope.storeId || !scope.productId) {
        throw new Error('Product subscriptions require storeId and productId');
      }
      return { store_id: scope.storeId, product_id: scope.productId };
    case 'store':
      if (!scope.storeId) {
        throw new Error('Store subscriptions require storeId');
      }
      return { store_id: scope.storeId };
    case 'product_type':
      if (!scope.productType) {
        throw new Error('Product type subscriptions require productType');
      }
      return { product_type: scope.productType };
    case 'store_product_type':
      if (!scope.storeId || !scope.productType) {
        throw new Error('Store + product type subscriptions require storeId and productType');
      }
      return { store_id: scope.storeId, product_type: scope.productType };
    default:
      throw new Error(`Unsupported scope type: ${scopeType}`);
  }
}

function mapScopeKey(scopeType: MonitoringScopeType, scopeKey: any): MonitoringScopeKey {
  switch (scopeType) {
    case 'product':
      return {
        storeId: scopeKey?.store_id ?? undefined,
        productId: scopeKey?.product_id ?? undefined,
      };
    case 'store':
      return {
        storeId: scopeKey?.store_id ?? undefined,
      };
    case 'product_type':
      return {
        productType: scopeKey?.product_type ?? undefined,
      };
    case 'store_product_type':
      return {
        storeId: scopeKey?.store_id ?? undefined,
        productType: scopeKey?.product_type ?? undefined,
      };
    default:
      return {};
  }
}

function mapMonitoringSubscription(raw: any): MonitoringSubscription {
  return {
    id: raw.id,
    scopeType: raw.scope_type,
    scope: mapScopeKey(raw.scope_type, raw.scope_key),
    storeName: typeof raw.store_name === 'string' ? raw.store_name : undefined,
    productName: typeof raw.product_name === 'string' ? raw.product_name : undefined,
    changeType: raw.change_type,
    intervalMinutes: raw.interval_minutes,
    unreadCount: raw.unread_count ?? 0,
    unreadUpdatedAt: raw.unread_updated_at ? new Date(raw.unread_updated_at) : null,
    unreadChangeLogs: Array.isArray(raw.unread_change_logs)
      ? raw.unread_change_logs.map(mapMonitoringChangeLogEntry)
      : [],
    createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    updatedAt: raw.updated_at ? new Date(raw.updated_at) : new Date(),
  };
}

function mapMonitoringChangeLogEntry(raw: any): MonitoringChangeLogEntry {
  return {
    id: raw.id,
    subscriptionId: raw.subscription_id,
    scopeType: raw.scope_type,
    scope: mapScopeKey(raw.scope_type, raw.scope_key),
    storeName: typeof raw.store_name === 'string' ? raw.store_name : undefined,
    productName: typeof raw.product_name === 'string' ? raw.product_name : undefined,
    changeType: raw.change_type,
    currentValue: typeof raw.current_value === 'number' ? raw.current_value : null,
    previousValue: typeof raw.previous_value === 'number' ? raw.previous_value : null,
    absoluteChange: typeof raw.absolute_change === 'number' ? raw.absolute_change : null,
    percentageChange: typeof raw.percentage_change === 'number' ? raw.percentage_change : null,
    detectedAt: raw.detected_at ? new Date(raw.detected_at) : new Date(),
    readAt: raw.read_at ? new Date(raw.read_at) : null,
    isBaseline: Boolean(raw.is_baseline),
  };
}

function mapUnreadCounter(raw: any): MonitoringUnreadCounter {
  return {
    subscriptionId: raw.subscription_id,
    unreadCount: raw.unread_count ?? 0,
    updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
  };
}

function mapStoreMonitoringFlags(monitoring: any | undefined) {
  return {
    store: {
      subscribed: Boolean(monitoring?.store?.subscribed),
    },
  };
}

function mapProductTypeMonitoringFlags(monitoring: any | undefined) {
  return {
    productType: {
      subscribed: Boolean(monitoring?.productType?.subscribed),
    },
    storeProductType: {
      subscribed: Boolean(monitoring?.storeProductType?.subscribed),
    },
  };
}

function mapProductMonitoringFlags(monitoring: any | undefined) {
  return {
    store: {
      subscribed: Boolean(monitoring?.store?.subscribed),
    },
    product: {
      subscribed: Boolean(monitoring?.product?.subscribed),
    },
    productType: {
      subscribed: Boolean(monitoring?.productType?.subscribed),
    },
    storeProductType: {
      subscribed: Boolean(monitoring?.storeProductType?.subscribed),
    },
  };
}

// Store APIs
export const getStores = async (): Promise<Store[]> => {
  const response = await api.get<{ count: number; stores: any[] }>('/stores');
  // Transform backend format to frontend format
  return response.data.stores.map(store => ({
    _id: store._id,
    name: store.store_name,
    url: store.store_url,
    status: store.active ? 'active' : 'inactive',
    pollingInterval: store.poll_interval ?? store.polling_interval ?? 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
    monitoring: mapStoreMonitoringFlags(store.monitoring),
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
    status: store.active ? 'active' : 'inactive',
    pollingInterval: store.poll_interval ?? store.polling_interval ?? 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
    monitoring: mapStoreMonitoringFlags(store.monitoring),
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
    status: store.active ? 'active' : 'inactive',
    pollingInterval: store.poll_interval ?? store.polling_interval ?? 60,
    lastFetch: store.last_polled_at ? new Date(store.last_polled_at) : undefined,
    productCount: store.product_count,
    monitoring: mapStoreMonitoringFlags(store.monitoring),
  };
};

export const deactivateStore = async (storeId: string): Promise<{ message: string; store: any }> => {
  const response = await api.delete<{ message: string; store: any }>(`/stores/${storeId}`);
  return response.data;
};

export const activateStore = async (storeId: string): Promise<{ message: string; store: any }> => {
  const response = await api.post<{ message: string; store: any }>(`/stores/${storeId}/activate`);
  return response.data;
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
  const response = await api.get<{ count: number; product_types: any[] }>('/product-types');
  return response.data.product_types.map((productType) => ({
    product_type: productType.product_type,
    count: productType.count,
    monitoring: mapProductTypeMonitoringFlags(productType.monitoring),
  }));
};

export const getStoreProductTypes = async (storeId: string): Promise<ProductType[]> => {
  const response = await api.get<{ store_id: string; count: number; product_types: any[] }>(`/stores/${storeId}/product-types`);
  return response.data.product_types.map((productType) => ({
    product_type: productType.product_type,
    count: productType.count,
    monitoring: mapProductTypeMonitoringFlags(productType.monitoring),
  }));
};

// Product APIs
const normalizePriceValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getVariantLatestPrice = (variant: any): number => {
  if (!variant) {
    return 0;
  }

  const history = Array.isArray(variant.price_history) ? variant.price_history : [];
  if (history.length > 0) {
    const latestEntry = history[history.length - 1];
    const latestPrice = normalizePriceValue(latestEntry?.price);
    if (latestPrice !== null) {
      return latestPrice;
    }
  }

  const fallbackPrice = normalizePriceValue(variant.current_price);
  return fallbackPrice ?? 0;
};

const getVariantPreviousPrice = (variant: any): number | undefined => {
  if (!variant) {
    return undefined;
  }

  const history = Array.isArray(variant.price_history) ? variant.price_history : [];
  if (history.length > 1) {
    const previousEntry = history[history.length - 2];
    const previousPrice = normalizePriceValue(previousEntry?.price);
    if (previousPrice !== null) {
      return previousPrice;
    }
  }

  return undefined;
};

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
      const lowestPriceVariant = product.variants.reduce((min: any, v: any) => {
        const minPrice = getVariantLatestPrice(min);
        const variantPrice = getVariantLatestPrice(v);
        return variantPrice < minPrice ? v : min;
      }, product.variants[0]);
      
      currentPrice = getVariantLatestPrice(lowestPriceVariant);
      
      // Calculate average price change across ALL variants
      const variantChanges: Array<{ priceChange: number; priceChangePercent: number }> = [];
      
      product.variants.forEach((variant: any) => {
        if (variant.price_history && variant.price_history.length > 1) {
          const currentVariantPrice = getVariantLatestPrice(variant);
          const previousVariantPrice = getVariantPreviousPrice(variant);
          
          if (
            previousVariantPrice !== undefined &&
            currentVariantPrice !== previousVariantPrice
          ) {
            const variantPriceChange = currentVariantPrice - previousVariantPrice;
            const variantPriceChangePercent =
              previousVariantPrice !== 0 ? (variantPriceChange / previousVariantPrice) * 100 : 0;
            
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
        price: getVariantLatestPrice(v).toString(),
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
      monitoring: mapProductMonitoringFlags(product.monitoring),
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
    const lowestPriceVariant = product.variants.reduce((min: any, v: any) => {
      const minPrice = getVariantLatestPrice(min);
      const variantPrice = getVariantLatestPrice(v);
      return variantPrice < minPrice ? v : min;
    }, product.variants[0]);
    
    currentPrice = getVariantLatestPrice(lowestPriceVariant);
    
    // Calculate average price change across ALL variants
    const variantChanges: Array<{ priceChange: number; priceChangePercent: number }> = [];
    
    product.variants.forEach((variant: any) => {
      if (variant.price_history && variant.price_history.length > 1) {
        const currentVariantPrice = getVariantLatestPrice(variant);
        const previousVariantPrice = getVariantPreviousPrice(variant);
        
        if (
          previousVariantPrice !== undefined &&
          currentVariantPrice !== previousVariantPrice
        ) {
          const variantPriceChange = currentVariantPrice - previousVariantPrice;
          const variantPriceChangePercent =
            previousVariantPrice !== 0 ? (variantPriceChange / previousVariantPrice) * 100 : 0;
          
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
      price: getVariantLatestPrice(v).toString(),
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
    monitoring: mapProductMonitoringFlags(product.monitoring),
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
      currentPrice: getVariantLatestPrice(variant),
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

// Monitoring Subscriptions APIs
export const getMonitoringSubscriptions = async (): Promise<MonitoringSubscription[]> => {
  const response = await api.get<{ count: number; subscriptions: any[] }>('/api/subscriptions');
  return response.data.subscriptions.map(mapMonitoringSubscription);
};

export const createMonitoringSubscription = async (
  input: CreateMonitoringSubscriptionInput
): Promise<MonitoringSubscription> => {
  const payload = {
    scope_type: input.scopeType,
    scope_key: toScopeKeyPayload(input.scopeType, input.scope),
    change_type: input.changeType,
    interval_minutes: input.intervalMinutes,
  };
  const response = await api.post('/api/subscriptions', payload);
  return mapMonitoringSubscription(response.data);
};

export const updateMonitoringSubscription = async (
  subscriptionId: string,
  input: CreateMonitoringSubscriptionInput
): Promise<MonitoringSubscription> => {
  const payload = {
    scope_type: input.scopeType,
    scope_key: toScopeKeyPayload(input.scopeType, input.scope),
    change_type: input.changeType,
    interval_minutes: input.intervalMinutes,
  };
  const response = await api.patch(`/api/subscriptions/${subscriptionId}`, payload);
  return mapMonitoringSubscription(response.data);
};

export const deleteMonitoringSubscription = async (subscriptionId: string): Promise<void> => {
  await api.delete(`/api/subscriptions/${subscriptionId}`);
};

export const getMonitoringChangeLogs = async (
  params: MonitoringChangeLogParams = {}
): Promise<MonitoringChangeLogResponse> => {
  const queryParams: Record<string, string | number> = {};

  if (params.subscriptionId) {
    queryParams.subscription_id = params.subscriptionId;
  }
  if (params.scopeType) {
    queryParams.scope_type = params.scopeType;
  }
  if (params.readState) {
    queryParams.read_state = params.readState;
  }
  if (params.since) {
    queryParams.since = params.since.toISOString();
  }
  if (params.limit) {
    queryParams.limit = params.limit;
  }
  if (params.offset) {
    queryParams.offset = params.offset;
  }

  const response = await api.get<{
    count: number;
    limit: number;
    offset: number;
    entries: any[];
    unread_counters: any[];
  }>('/api/change-logs', {
    params: queryParams,
  });

  return {
    count: response.data.count,
    limit: response.data.limit,
    offset: response.data.offset,
    entries: response.data.entries.map(mapMonitoringChangeLogEntry),
    unreadCounters: response.data.unread_counters.map(mapUnreadCounter),
  };
};

export const markMonitoringChangeLogsRead = async (
  ids: string[]
): Promise<{ updatedIds: string[]; unreadCounters: MonitoringUnreadCounter[] }> => {
  const response = await api.post<{
    updated_ids: string[];
    unread_counters: any[];
  }>('/api/change-logs/mark-read', { ids });

  return {
    updatedIds: response.data.updated_ids || [],
    unreadCounters: (response.data.unread_counters || []).map(mapUnreadCounter),
  };
};

export default api;

