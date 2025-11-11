# API Reference

## Overview
- Backend API base URL: `http://localhost:3000`.
- Trigger API base URL: `http://localhost:3001`.
- All endpoints speak JSON and do not require authentication.
- Use standard HTTP status codes for success and errors.

## Health
- `GET /health`  
  Returns `{ status, timestamp }` and confirms the service is alive.

## Stores
- `GET /stores`  
  Lists every store with product counts and a `monitoring.store.subscribed` flag indicating whether a store-level monitoring subscription exists.
- `POST /stores`  
  Body: `{ store_url: string, store_name: string, poll_interval?: number }`.  
  Creates a store, marks it active, and kicks off initial polling plus aggregation.
- `GET /stores/{storeId}`  
  Returns a single store with product counts and the same `monitoring.store.subscribed` metadata.
- `DELETE /stores/{storeId}`  
  Sets `active` to `false` and records `deactivated_at`.
- `POST /stores/{storeId}/activate`  
  Reactivates a store and triggers polling plus aggregation.
- `GET /stores/{storeId}/tags`  
  Lists tag counts for one store.
- `GET /stores/{storeId}/product-types`  
  Lists product type counts for one store and, for each entry, includes `monitoring.productType.subscribed` plus `monitoring.storeProductType.subscribed` flags.

## Products
- `GET /stores/{storeId}/products`  
  Lists all products for a store, sorted by `last_polled_at`. Each product also includes a `monitoring` block with:
  - `store.subscribed`: store-level subscription status  
  - `product.subscribed`: product-level subscription status  
  - `productType.subscribed`: product-type subscription status (if the product has a type)  
  - `storeProductType.subscribed`: store + product-type subscription status (if applicable)
- `GET /products/{productId}`  
  Returns one product including embedded variants, history, and the same `monitoring` metadata described above.

## Price History
- `GET /products/{productId}/price-history`  
  Optional query params: `start_date`, `end_date`, `variant_id`.  
  Returns per-variant history with filtered periods.

## Analytics
- `GET /analytics/stores/{storeId}/average-price`  
  Optional query params: `start_date`, `end_date`, `window_hours`.  
  Returns hourly averages per store.
- `GET /analytics/tags/{tag}/average-price`  
  Optional query params: `start_date`, `end_date`, `window_hours`.  
  Returns hourly averages per tag.
- `GET /analytics/stores/{storeId}/tags/{tag}/average-price`  
  Same query params.  
  Returns hourly averages per store and tag pair.
- `GET /analytics/product-types/{productType}/average-price`  
  Same query params.  
  Returns hourly averages per product type across stores.
- `GET /analytics/stores/{storeId}/product-types/{productType}/average-price`  
  Same query params.  
  Returns hourly averages per store plus product type pair.

## Changelogs
- `GET /changelogs/products`  
  Optional query params: `store_id`, `start_date`, `end_date`.  
  Returns price deltas between captured price points per variant.
- `GET /changelogs/stores/average-price`  
  Optional query params: `store_id`, `start_date`, `end_date`.  
  Returns changes between consecutive store averages.
- `GET /changelogs/tags/average-price`  
  Optional query params: `tag`, `start_date`, `end_date`.  
  Returns changes between consecutive tag averages.
- `GET /changelogs/stores/{storeId}/tags/{tag}/average-price`  
  Optional query params: `start_date`, `end_date`.  
  Returns changes between consecutive store and tag averages.

## Tags and Product Types
- `GET /tags`  
  Lists all tags with counts across stores.
- `GET /product-types`  
  Lists all product types with counts across stores and provides `monitoring.productType.subscribed` for each entry.

## Trigger API
- `POST /poll/store/{storeId}`  
  Polls one store, writes products, and runs aggregations for the current hour.
- `POST /poll/all`  
  Polls every active store and runs aggregations for the current hour.
- `POST /aggregate`  
  Body: `{ windowStart?: ISO string, windowEnd?: ISO string }`.  
  Rebuilds hourly store, tag, and store-tag averages for the window (defaults to current hour).
- `POST /aggregate/current`  
  Rebuilds the current hour window using live data.

## Monitoring
- `POST /api/subscriptions`  
  Body: `{ scope_type, scope_key, change_type }`.  
  Creates a subscription and records a baseline change log row.  
  Scope types include `product`, `store`, `product_type`, and `store_product_type`.
- `GET /api/subscriptions`  
  Returns `{ count, subscriptions }` with unread counters and up to ten unread change logs per subscription.
- `PATCH /api/subscriptions/{id}`  
  Updates scope or change type.  
  Requires both `scope_type` and `scope_key` when changing the scope.
- `DELETE /api/subscriptions/{id}`  
  Removes the subscription and all related change logs.
- `GET /api/change-logs`  
  Query params: `subscription_id`, `scope_type`, `read_state`, `since`, `limit`, `offset`.  
  Returns change log entries plus unread counters per subscription.
- `POST /api/change-logs/mark-read`  
  Body: `{ ids: string[] }`.  
  Marks change logs as read and updates unread counters.

