# API Reference

## Overview

**Two services expose HTTP APIs:**

| Service | Port | Purpose | Base URL |
|---------|------|---------|----------|
| **Backend API** | 3000 | Read data, manage subscriptions | `http://localhost:3000` |
| **Trigger API** | 3001 | Write data, run aggregations | `http://localhost:3001` |

**Common:**
- All endpoints use JSON.
- No authentication required.
- Standard HTTP status codes.

---

## Backend API (Port 3000)

### Health
- `GET /health`
  Returns `{ status, timestamp }`.

### Stores
- `GET /stores`
  Lists all stores with product counts and `monitoring.store.subscribed` flag.

- `POST /stores`
  Body: `{ store_url, store_name, poll_interval? }`.
  Creates store, triggers initial polling and aggregation.

- `GET /stores/{storeId}`
  Returns single store with product counts and monitoring metadata.

- `DELETE /stores/{storeId}`
  Sets `active: false` and records `deactivated_at`.

- `POST /stores/{storeId}/activate`
  Reactivates store and triggers polling.

- `GET /stores/{storeId}/tags`
  Lists tag counts for one store.

- `GET /stores/{storeId}/product-types`
  Lists product types with `monitoring.productType.subscribed` and `monitoring.storeProductType.subscribed` flags.

### Products
- `GET /stores/{storeId}/products`
  Lists products sorted by `last_polled_at`. Includes `monitoring` block:
  - `store.subscribed` - store-level subscription
  - `product.subscribed` - product-level subscription
  - `productType.subscribed` - product-type subscription (if applicable)
  - `storeProductType.subscribed` - store + product-type subscription (if applicable)

- `GET /products/{productId}`
  Returns product with variants, history, and `monitoring` metadata.

### Price History
- `GET /products/{productId}/price-history`
  Query params: `start_date`, `end_date`, `variant_id` (all optional).
  Returns per-variant price history.

### Analytics
All analytics endpoints accept optional query params: `start_date`, `end_date`, `window_hours`.

- `GET /analytics/stores/{storeId}/average-price`
  Hourly averages per store.

- `GET /analytics/tags/{tag}/average-price`
  Hourly averages per tag.

- `GET /analytics/stores/{storeId}/tags/{tag}/average-price`
  Hourly averages per store + tag.

- `GET /analytics/product-types/{productType}/average-price`
  Hourly averages per product type.

- `GET /analytics/stores/{storeId}/product-types/{productType}/average-price`
  Hourly averages per store + product type.

### Changelogs
- `GET /changelogs/products`
  Query params: `store_id`, `start_date`, `end_date` (all optional).
  Price deltas per variant between snapshots.

- `GET /changelogs/stores/average-price`
  Query params: `store_id`, `start_date`, `end_date` (all optional).
  Changes between consecutive store averages.

- `GET /changelogs/tags/average-price`
  Query params: `tag`, `start_date`, `end_date` (all optional).
  Changes between consecutive tag averages.

- `GET /changelogs/stores/{storeId}/tags/{tag}/average-price`
  Query params: `start_date`, `end_date` (all optional).
  Changes between consecutive store + tag averages.

### Tags and Product Types
- `GET /tags`
  Lists all tags with counts.

- `GET /product-types`
  Lists all product types with counts and `monitoring.productType.subscribed` flags.

### Monitoring (Subscriptions)
- `POST /api/subscriptions`
  Body: `{ scope_type, scope_key, change_type }`.
  Creates subscription with baseline change log.
  Scope types: `product`, `store`, `product_type`, `store_product_type`.

- `GET /api/subscriptions`
  Returns `{ count, subscriptions }` with unread counters and up to 10 recent change logs per subscription.

- `PATCH /api/subscriptions/{id}`
  Body: `{ scope_type?, scope_key?, change_type? }`.
  Updates subscription. Requires both `scope_type` and `scope_key` when changing scope.

- `DELETE /api/subscriptions/{id}`
  Removes subscription and all related change logs.

- `GET /api/change-logs`
  Query params: `subscription_id`, `scope_type`, `read_state`, `since`, `limit`, `offset` (all optional).
  Returns change logs with unread counters.

- `POST /api/change-logs/mark-read`
  Body: `{ ids: string[] }`.
  Marks change logs as read.

---

## Trigger API (Port 3001)

Handles data writes and aggregations. Called by backend when creating/activating stores, or manually via direct HTTP.

- `POST /poll/store/{storeId}`
  Polls one store and runs aggregations for current hour.

- `POST /poll/all`
  Polls all active stores and runs aggregations.

- `POST /aggregate`
  Body: `{ windowStart?: ISO, windowEnd?: ISO }`.
  Rebuilds hourly aggregates for window (defaults to current hour).

- `POST /aggregate/current`
  Rebuilds aggregates for current hour.

