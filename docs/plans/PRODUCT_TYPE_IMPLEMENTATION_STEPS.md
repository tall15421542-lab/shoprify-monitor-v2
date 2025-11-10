# Product Type Dashboard - Implementation Steps

## Step 1: Database Collections Setup
**Goal:** Create new MongoDB collections with proper indexes

**Tasks:**
- Add `hourly_product_type_avg` collection schema
  - Fields: window_start, window_hours, product_type, avg_price, product_count, store_count
  - Index: `{ window_start: 1, product_type: 1 }`

- Add `hourly_store_product_type_avg` collection schema
  - Fields: window_start, window_hours, store_id, product_type, avg_price, product_count
  - Index: `{ window_start: 1, store_id: 1, product_type: 1 }`

**Test Verification:**
```bash
# Run database schema tests
npm test -- analytics-schema.test.js

# Verify:
# - Collections are created successfully
# - Indexes exist and are correct
# - Sample documents can be inserted and queried
```

---

## Step 2: Data Aggregation Jobs
**Goal:** Build hourly jobs to aggregate product type data

**Tasks:**
- Add product type aggregation (all stores)
  - Group by `product_type`
  - Calculate avg price, product count, store count

- Add product type + store aggregation
  - Group by `product_type` and `store_id`
  - Calculate avg price, product count per store

**Test Verification:**
```bash
# Run aggregator tests
npm test -- aggregator.test.js

# Verify:
# - Aggregations calculate correct averages
# - Product counts are accurate
# - Store counts match expected values
# - Jobs run on schedule
# - Data written to correct collections
```

---

## Step 3: Backend API - Product Type Listings
**Goal:** Create endpoints to list available product types

**Tasks:**
- `GET /product-types` - all product types
- `GET /stores/:storeId/product-types` - store-specific product types

**Test Verification:**
```bash
# Run product-types API tests
npm test -- product-types.test.js

# Verify:
# - Returns all unique product types with counts
# - Store-specific endpoint filters correctly
# - Handles invalid store IDs with proper errors
# - Response format matches specification
```

---

## Step 4: Backend API - Analytics Endpoints
**Goal:** Create time-series analytics endpoints for product types

**Tasks:**
- `GET /analytics/product-types/:productType/average-price`
- `GET /analytics/stores/:storeId/product-types/:productType/average-price`

**Test Verification:**
```bash
# Run analytics API tests
npm test -- analytics.test.js

# Verify:
# - Returns correct time-series data
# - Query params (start_date, end_date, window_hours) work
# - Handles invalid product types gracefully
# - Aggregated data matches expected values
# - Date filtering works correctly
```

---

## Step 5: Frontend API Service
**Goal:** Add API client methods for product type endpoints

**Tasks:**
- Add `getAllProductTypes()` method
- Add `getStoreProductTypes(storeId)` method
- Add `getAveragePriceByProductType(productType, params)` method
- Add `getStoreAveragePriceByProductType(storeId, productType, params)` method

**Test Verification:**
```bash
# Run frontend API service tests
npm test -- api.test.ts

# Verify:
# - Methods call correct endpoints
# - Parameters are properly formatted
# - Error handling works
# - Response types match TypeScript definitions
```

---

## Step 6: Frontend Hooks
**Goal:** Create React hooks for fetching product type data

**Tasks:**
- Create `useProductTypes(storeId?)` hook
  - Fetch all or store-specific product types
  - Cache for 5 minutes

- Create `useAveragePriceByProductType(productType, params)` hook
  - Fetch analytics data
  - Handle loading and error states

**Test Verification:**
```bash
# Run hooks tests
npm test -- useProductTypes.test.ts
npm test -- useAnalytics.test.ts

# Verify:
# - Hooks fetch data correctly
# - Caching works (no duplicate requests)
# - Loading states update properly
# - Error states handled correctly
# - Re-fetching works on stale data
```

---

## Step 7: Frontend UI Components
**Goal:** Update dashboard to display product type analytics

**Tasks:**
- Add product type dropdown to filter component
- Update dashboard page to show product type charts
  - All stores view
  - Per-store breakdown view
- Add TypeScript type definitions

**Test Verification:**
```bash
# Run component tests
npm test -- ChartFilters.test.tsx
npm test -- DashboardPage.test.tsx

# Verify:
# - Product type dropdown renders with data
# - Selecting product type updates charts
# - Charts display correct data
# - Filtering works with other filters (store, tag)
# - Loading states show correctly
# - Error states handled gracefully
```

---

## Step 8: Integration Testing
**Goal:** Verify end-to-end workflow

**Tasks:**
- Test complete data flow from aggregation to UI
- Test multiple filter combinations
- Verify performance with real data volumes

**Test Verification:**
```bash
# Run all tests across layers
cd data_processing && npm test
cd ../backend && npm test
cd ../frontend && npm test

# Manual verification:
# - Run aggregation jobs manually
# - Check database for populated data
# - Start backend server
# - Start frontend dev server
# - Test UI with various product types
# - Verify charts update correctly
# - Test edge cases (no data, single product type, etc.)
```

---

## Summary Test Commands

**Data Processing Layer:**
```bash
cd data_processing
npm test
```

**Backend Layer:**
```bash
cd backend
npm test
npm run test:integration  # if available
```

**Frontend Layer:**
```bash
cd frontend
npm test
npm run test:coverage  # check coverage
```

---

## Success Criteria

Each step is complete when:
1. All tests pass
2. Code follows existing patterns (tags implementation)
3. Error handling is implemented
4. TypeScript types are defined (frontend)
5. No console errors or warnings
6. Performance is acceptable

---

## Notes

- Follow existing tags implementation as reference
- Product type is simpler than tags (single string, not array)
- Include `store_count` in product type overview aggregation
- Ensure proper error handling at each layer
- Keep UI consistent with existing dashboard design
