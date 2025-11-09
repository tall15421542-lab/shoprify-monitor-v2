# Database Schema

## Overview
- All services use a single MongoDB database named `shopify_monitor`.
- Documents follow an embedded model so reads stay fast and aggregates stay cheap.
- Time-series collections back the analytics layer for hourly rollups.

## Core Collections

### stores
- Tracks each Shopify storefront that should be polled.
- Key fields: `_id`, `store_url`, `store_name`, `poll_interval`, `active`, `created_at`, `last_polled_at`, `deactivated_at`.
- Indexes: unique index on `store_url`, secondary index on `{ active: 1, last_polled_at: 1 }`.

### products
- Holds normalized product data with embedded variants and history.
- Key fields: `_id`, `product_id` (Shopify id), `store_id` (`stores._id`), `handle`, `title`, `product_type`, `vendor`, `tags`, `main_image_url`, `created_at`, `updated_at`, `last_polled_at`, `raw_data`.
- Each `variants` entry stores `variant_id`, `variant_title`, `current_price`, `image_url`, and a `price_history` array of `{ price, recorded_at }`.
- Indexes: unique compound on `{ product_id, store_id }` plus helpers on `store_id`, `variants.variant_id`, `handle`, `vendor`, and `product_type`.

### price_snapshots (time-series)
- Records every variant price that is captured during polling.
- Key fields: `timestamp`, `price`, `store_name`, and `metadata` containing `store_id`, `product_id`, `variant_id`, `product_type`, `tags`.
- Time-series options: `timeField` = `timestamp`, `metaField` = `metadata`, hourly granularity.
- Indexes: compound indexes on timestamp mixed with `metadata.store_id`, `metadata.tags`, and `metadata.product_type` to keep analytics queries fast.

## Aggregated Collections

### hourly_store_avg
- Stores hourly averages across each active store.
- Fields: `store_id`, `window_start`, `window_end`, `avg_price`, `product_count`, `created_at`.
- Unique index on `{ store_id, window_start }`.

### hourly_tag_avg
- Stores hourly averages across each tag.
- Fields: `tag`, `window_start`, `window_end`, `avg_price`, `product_count`, `created_at`.
- Unique index on `{ tag, window_start }`.

### hourly_store_tag_avg
- Tracks hourly averages per store and tag pair.
- Fields: `store_id`, `tag`, `window_start`, `window_end`, `avg_price`, `product_count`, `created_at`.
- Unique index on `{ store_id, tag, window_start }`.

### hourly_product_type_avg
- Tracks hourly averages per product type.
- Fields: `product_type`, `window_start`, `window_end`, `avg_price`, `product_count`, `store_count`, `created_at`.
- Unique index on `{ product_type, window_start }`.

### hourly_store_product_type_avg
- Stores hourly averages per store and product type pair.
- Fields: `store_id`, `product_type`, `window_start`, `window_end`, `avg_price`, `product_count`, `created_at`.
- Unique index on `{ store_id, product_type, window_start }`.

## Relationships
- `products.store_id` references `stores._id`.
- `price_snapshots.metadata.store_id` and `metadata.product_id` reference `stores._id` and `products.product_id`.
- Hourly aggregates are derived from `price_snapshots` during scheduler runs and share ids with their source documents.

## Lifecycle Notes
- Poller inserts new stores with `active: true` and keeps `last_polled_at` fresh after each sweep.
- `upsertProduct` updates product documents, appends variant history, and emits matching snapshot rows in a single transaction.
- Scheduler jobs build every hourly collection and use upserts to avoid duplicates when re-running a window.

