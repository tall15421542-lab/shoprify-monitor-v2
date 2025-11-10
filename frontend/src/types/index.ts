// Store Types
export interface MonitoringFlag {
  subscribed: boolean;
}

export interface Store {
  _id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  pollingInterval: number;
  lastFetch?: Date;
  productCount?: number;
  monitoring?: {
    store?: MonitoringFlag;
  };
}

export interface AddStoreData {
  name: string;
  url: string;
  pollingInterval?: number;
}

// Tag Types
export interface Tag {
  tag: string;
  count: number;
}

// Product Type Types
export interface ProductType {
  product_type: string;
  count: number;
  monitoring?: {
    productType?: MonitoringFlag;
    storeProductType?: MonitoringFlag;
  };
}

// Product Types
export interface Product {
  _id: string;
  storeId: string;
  shopifyId: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  variants: Variant[];
  images: ProductImage[];
  currentPrice: number;
  previousPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  hasVariantPriceUp?: boolean;
  hasVariantPriceDown?: boolean;
  createdAt: Date;
  updatedAt: Date;
  monitoring?: {
    store?: MonitoringFlag;
    product?: MonitoringFlag;
    productType?: MonitoringFlag;
    storeProductType?: MonitoringFlag;
  };
}

export interface Variant {
  id: string;
  title: string;
  price: string;
  sku: string;
  available: boolean;
}

export interface ProductImage {
  id: string;
  src: string;
  alt?: string;
}

// Price History Types
export interface PriceHistory {
  timestamp: Date;
  price: number;
  variant?: string;
}

// Analytics Types
export interface AnalyticsParams {
  startDate: Date;
  endDate: Date;
  windowHours?: number;
}

export interface AveragePriceData {
  timestamp: Date;
  averagePrice: number;
  productCount: number;
}

// Changelog Types
export interface ChangelogEntry {
  _id: string;
  timestamp: Date;
  productId: string;
  productTitle: string;
  storeId: string;
  storeName: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
  tags: string[];
}

export interface ChangelogParams {
  startDate?: Date;
  endDate?: Date;
  storeId?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

// Filter Types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ChartFilters {
  storeId?: string;
  tag?: string;
  windowHours: number;
}

// Monitoring Subscriptions
export type MonitoringScopeType = 'product' | 'store' | 'product_type' | 'store_product_type';
export type MonitoringChangeType = 'price_up' | 'price_down' | 'both';

export interface MonitoringScopeKey {
  storeId?: string;
  productId?: string;
  productType?: string;
}

export interface MonitoringSubscription {
  id: string;
  scopeType: MonitoringScopeType;
  scope: MonitoringScopeKey;
  storeName?: string;
  productName?: string;
  changeType: MonitoringChangeType;
  intervalMinutes: number;
  unreadCount: number;
  unreadUpdatedAt: Date | null;
  unreadChangeLogs: MonitoringChangeLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMonitoringSubscriptionInput {
  scopeType: MonitoringScopeType;
  scope: MonitoringScopeKey;
  changeType: MonitoringChangeType;
  intervalMinutes: number;
}

export interface MonitoringChangeLogEntry {
  id: string;
  subscriptionId: string;
  scopeType: MonitoringScopeType;
  scope: MonitoringScopeKey;
  storeName?: string;
  productName?: string;
  changeType: MonitoringChangeType;
  currentValue: number | null;
  previousValue: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  detectedAt: Date;
  readAt: Date | null;
  isBaseline: boolean;
}

export interface MonitoringUnreadCounter {
  subscriptionId: string;
  unreadCount: number;
  updatedAt: Date | null;
}

export interface MonitoringChangeLogResponse {
  count: number;
  limit: number;
  offset: number;
  entries: MonitoringChangeLogEntry[];
  unreadCounters: MonitoringUnreadCounter[];
}

export interface MonitoringChangeLogParams {
  subscriptionId?: string;
  scopeType?: MonitoringScopeType;
  readState?: 'read' | 'unread';
  since?: Date;
  limit?: number;
  offset?: number;
}

