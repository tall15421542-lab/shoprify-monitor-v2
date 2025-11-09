// Store Types
export interface Store {
  _id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  pollingInterval: number;
  lastFetch?: Date;
  productCount?: number;
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

