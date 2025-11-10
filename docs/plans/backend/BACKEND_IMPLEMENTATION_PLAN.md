# Backend Implementation Plan (Simplified)

## Goal
Build a REST API that lets users monitor Shopify store prices and view analytics.

**Note:** All backend code will be placed in the `backend/` directory.

## What We're Building

**Scope:** Build REST API endpoints that read from existing MongoDB collections.

**What's Already Done (Phase 1 & 3):**
- ✅ MongoDB database with stores and products collections
- ✅ Shopify data polling and storage
- ✅ Analytics aggregation (price_snapshots, hourly averages)
- ✅ Automatic hourly aggregation jobs
- ✅ Change stream listeners for real-time updates

**What We Need to Build:**
- REST API server using Express
- 5 sets of API endpoints (stores, products, price history, analytics, changelogs)
- Request/response handling and validation
- Error handling
- Tests for all endpoints

### API Endpoints to Build
1. **Store Management** - Add stores, list stores
2. **Product Views** - See products from each store
3. **Price History** - See how prices changed over time
4. **Analytics** - Get average prices by store, tag, or both
5. **Changelogs** - See what prices changed

### Existing Database Collections (Already Built in Phase 1 & 3)
1. **stores** - Store information ✅
2. **products** - Product data with price history ✅
3. **price_snapshots** - Flattened price data (time-series) ✅
4. **hourly_store_avg** - Pre-calculated average by store ✅
5. **hourly_tag_avg** - Pre-calculated average by tag ✅
6. **hourly_store_tag_avg** - Pre-calculated average by store+tag ✅

**Note:** Data aggregation is already handled by Phase 3. We just need to build the REST API to expose this data.

---

## Implementation Steps

### Step 1: Setup Express API Server
**What:** Create basic Express server with routing structure

**Tasks:**
- Create Express app with middleware (CORS, JSON parsing)
- Setup route files for each API section
- Add error handling middleware
- Connect to MongoDB

**Test:**
- Server starts on port 3000
- Health check endpoint returns 200
- Database connection works

**Files:**
- `backend/src/api/server.js` - Express server setup
- `backend/src/api/routes/index.js` - Route registry
- `backend/src/database/connection.js` - Database helper
- `backend/test/api/server.test.js`

---

### Step 2: Store Management Endpoints
**What:** Implement POST /stores and GET /stores

**Tasks:**
- POST /stores - Save store to database, start polling
- GET /stores - Return list of all stores

**Test:**
- Can add new store with valid data
- Duplicate store returns error
- Can retrieve all stores
- Invalid data returns 400 error

**Files:**
- `backend/src/api/routes/stores.js`
- `backend/src/api/controllers/stores.js`
- `backend/test/api/stores.test.js`

---

### Step 3: Products Endpoint
**What:** Implement GET /stores/:storeId/products

**Tasks:**
- Fetch all products for a store
- Return product with variants
- Handle store not found

**Test:**
- Returns products for valid store
- Returns empty array if no products
- Returns 404 for invalid store

**Files:**
- `backend/src/api/routes/products.js`
- `backend/src/api/controllers/products.js`
- `backend/test/api/products.test.js`

---

### Step 4: Price History Endpoint
**What:** Implement GET /products/:productId/price-history

**Tasks:**
- Fetch product from database
- Extract price history from variants
- Filter by date range if provided
- Return formatted response

**Test:**
- Returns all history without date filter
- Returns filtered history with date range
- Returns 404 for invalid product

**Files:**
- `backend/src/api/routes/price-history.js`
- `backend/src/api/controllers/price-history.js`
- `backend/test/api/price-history.test.js`

---

### Step 5: Analytics Endpoints
**What:** Implement GET /analytics/* endpoints

**Tasks:**
- GET /analytics/stores/:storeId/average-price - Query from hourly_store_avg
- GET /analytics/tags/:tag/average-price - Query from hourly_tag_avg
- GET /analytics/stores/:storeId/tags/:tag/average-price - Query from hourly_store_tag_avg
- Support window_hours parameter to group results
- Filter by date range

**Test:**
- Returns correct data for each endpoint
- Date filtering works
- Window grouping works
- Returns empty array if no data

**Files:**
- `backend/src/api/routes/analytics.js`
- `backend/src/api/controllers/analytics.js`
- `backend/test/api/analytics.test.js`

---

### Step 6: Changelog Endpoints
**What:** Implement GET /changelogs/* endpoints

**Tasks:**
- GET /changelogs/products - Return product price changes
- GET /changelogs/stores/average-price - Return store avg changes
- GET /changelogs/tags/average-price - Return tag avg changes
- GET /changelogs/stores/:storeId/tags/:tag/average-price - Return store-tag changes
- All use same data as analytics, just different formatting

**Test:**
- Returns changelog format correctly
- Filters by date work
- Window grouping works
- Store filtering works

**Files:**
- `backend/src/api/routes/changelogs.js`
- `backend/src/api/controllers/changelogs.js`
- `backend/test/api/changelogs.test.js`

---

### Step 7: Integration Test
**What:** Test entire system end-to-end

**Tasks:**
- Add store via API
- Poll products (or use mock data)
- Query all API endpoints
- Verify correct responses

**Test:**
- Complete flow from store add to analytics query works
- All endpoints return correct data

**Files:**
- `backend/test/integration/api-flow.test.js`

---

### Step 8: Add to Main Application
**What:** Wire everything together in main.js

**Tasks:**
- Start Express server on configured port
- Connect to existing MongoDB database
- Register all API routes
- Add graceful shutdown for server
- Add logging for API requests

**Test:**
- Application starts without errors
- API endpoints are accessible
- Graceful shutdown works
- No memory leaks

**Files:**
- `backend/src/main.js` (new)
- Or integrate with existing `src/main.js`

---

## Testing Strategy

**Unit Tests:** Each service and controller tested independently
**Integration Tests:** Full API flow tested end-to-end
**Run tests before each commit**

## File Structure

```
backend/
├── src/
│   ├── main.js
│   ├── database/
│   │   └── connection.js - MongoDB connection helper
│   └── api/
│       ├── server.js - Express app setup
│       ├── routes/
│       │   ├── index.js - Route registry
│       │   ├── stores.js
│       │   ├── products.js
│       │   ├── price-history.js
│       │   ├── analytics.js
│       │   └── changelogs.js
│       └── controllers/
│           ├── stores.js
│           ├── products.js
│           ├── price-history.js
│           ├── analytics.js
│           └── changelogs.js
└── test/
    ├── api/ - API endpoint tests
    │   ├── server.test.js
    │   ├── stores.test.js
    │   ├── products.test.js
    │   ├── price-history.test.js
    │   ├── analytics.test.js
    │   └── changelogs.test.js
    └── integration/
        └── api-flow.test.js
```

## Key Decisions

1. **Use Express** - Simple, well-known REST API framework
2. **Read from existing collections** - All data is already aggregated by Phase 3
3. **MVC pattern** - Separate routes, controllers for clean code
4. **Simple error handling** - Return proper HTTP status codes
5. **Query parameters** - Use for filtering (date range, window_hours, etc.)

## What We're NOT Building

- Authentication (not in requirements)
- Rate limiting (keep it simple)
- Caching layer (pre-aggregation already provides fast queries)
- GraphQL (use REST as specified)
- Real-time websockets (not needed)
- Admin dashboard (just API)
- Data aggregation (already handled by Phase 3)

## Success Criteria

- All API endpoints return correct data format
- Tests pass with >80% coverage
- API responds in <200ms for all queries
- Can handle 1000+ products per store
- Proper error handling with HTTP status codes

