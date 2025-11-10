# Product Type Dashboard Implementation Plan

## Overview
Add product type dashboard with two aggregation views:
1. Aggregated by product type (across all stores)
2. Aggregated by product type and store

Follow the existing tags implementation pattern for consistency.

---

## 1. Data Processing Layer

### New Aggregation Jobs
Add hourly aggregation jobs to process product type data:

**Aggregate by Product Type (All Stores):**
- Group all products by `product_type` field
- Calculate average price across all stores
- Count total products per product type
- Count how many stores carry each product type

**Aggregate by Product Type + Store:**
- Group products by both `product_type` and `store_id`
- Calculate average price per product type per store
- Count products per product type per store

**Test:**
- Verify aggregations run on schedule
- Verify calculations are correct
- Verify data is written to collections

---

## 2. Database Schema

### New Collections

**`hourly_product_type_avg`** (product type overview)
```
{
  window_start: Date,
  window_hours: Number,
  product_type: String,
  avg_price: Number,
  product_count: Number,
  store_count: Number
}
```
- Index: `{ window_start: 1, product_type: 1 }`

**`hourly_store_product_type_avg`** (product type by store)
```
{
  window_start: Date,
  window_hours: Number,
  store_id: ObjectId,
  product_type: String,
  avg_price: Number,
  product_count: Number
}
```
- Index: `{ window_start: 1, store_id: 1, product_type: 1 }`

**Test:**
- Verify collections are created
- Verify indexes exist
- Insert and query sample documents

---

## 3. Backend API

### New Endpoints

**Product Type Listings:**
- `GET /product-types`
  - Returns all unique product types with product counts
  - Response: `{ count, product_types: [{ product_type, count }] }`

- `GET /stores/:storeId/product-types`
  - Returns product types for specific store
  - Response: `{ store_id, count, product_types: [{ product_type, count }] }`

**Analytics Endpoints:**
- `GET /analytics/product-types/:productType/average-price`
  - Query params: `start_date`, `end_date`, `window_hours`
  - Returns time-series data for product type across all stores
  - Response: `{ count, data: [{ window_start, avg_price, product_count, store_count }] }`

- `GET /analytics/stores/:storeId/product-types/:productType/average-price`
  - Query params: `start_date`, `end_date`, `window_hours`
  - Returns time-series data for product type in specific store
  - Response: `{ count, data: [{ window_start, avg_price, product_count }] }`

**Test:**
- Test each endpoint returns correct data
- Test query parameter validation
- Test error handling for invalid product types or store IDs

---

## 4. Frontend

### New Hooks

**`useProductTypes(storeId?: string)`**
- Fetch all product types or store-specific product types
- Cache for 5 minutes
- Similar to `useTags` hook

**`useAveragePriceByProductType(productType, params)`**
- Fetch analytics data for product type
- Support date range and window size
- Similar to `useAveragePriceByTag` hook

### API Service Updates

Add to `frontend/src/services/api.ts`:
- `getAllProductTypes()`
- `getStoreProductTypes(storeId)`
- `getAveragePriceByProductType(productType, params)`
- `getStoreAveragePriceByProductType(storeId, productType, params)`

### Component Updates

**Filter Component:**
- Add product type dropdown selector
- Load available product types using `useProductTypes()` hook
- Allow selection alongside store and tag filters

**Dashboard Page:**
- Add product type filtering capability
- Display product type analytics charts
- Show two chart views:
  - Product type overview (all stores)
  - Product type by store breakdown

### Type Definitions

Add to `frontend/src/types/index.ts`:
```typescript
export interface ProductType {
  product_type: string;
  count: number;
}
```

**Test:**
- Test hooks fetch and cache data correctly
- Test UI components render product type data
- Test filtering and chart updates

---

## Key Differences from Tags

**Simpler Aggregation:**
- Product type is a single string field (not an array)
- No need to unwind like tags
- Direct grouping by `product_type` field

**Additional Metric:**
- Include `store_count` in product type overview
- Shows how many stores carry each product type

---

## Implementation Order

1. Create database collections and indexes
2. Build aggregation jobs in data processing layer
3. Create backend API endpoints
4. Add frontend hooks and API service methods
5. Update UI components and dashboard
6. Write tests for each layer

---

## Files to Create/Update

**Data Processing:**
- Update `data_processing/src/database/analytics-schema.js`
- Update `data_processing/src/services/aggregator.js`
- Add tests for new aggregations

**Backend:**
- Create `backend/src/api/routes/product-types.js`
- Create `backend/src/api/controllers/product-types.js`
- Update `backend/src/api/controllers/analytics.js`
- Update `backend/src/api/routes/analytics.js`
- Add tests for new endpoints

**Frontend:**
- Create `frontend/src/hooks/useProductTypes.ts`
- Update `frontend/src/hooks/useAnalytics.ts`
- Update `frontend/src/services/api.ts`
- Update `frontend/src/components/charts/ChartFilters.tsx`
- Update `frontend/src/pages/DashboardPage.tsx`
- Update `frontend/src/types/index.ts`
- Add tests for new hooks and components
