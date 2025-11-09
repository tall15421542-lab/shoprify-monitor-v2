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
  Lists every store with product counts.
- `POST /stores`  
  Body: `{ store_url: string, store_name: string, poll_interval?: number }`.  
  Creates a store, marks it active, and kicks off initial polling plus aggregation.
- `GET /stores/{storeId}`  
  Returns a single store with product counts.
- `DELETE /stores/{storeId}`  
  Sets `active` to `false` and records `deactivated_at`.
- `POST /stores/{storeId}/activate`  
  Reactivates a store and triggers polling plus aggregation.
- `GET /stores/{storeId}/tags`  
  Lists tag counts for one store.
- `GET /stores/{storeId}/product-types`  
  Lists product type counts for one store.

## Products
- `GET /stores/{storeId}/products`  
  Lists all products for a store, sorted by `last_polled_at`.
- `GET /products/{productId}`  
  Returns one product including embedded variants and history.

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
  Lists all product types with counts across stores.

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

