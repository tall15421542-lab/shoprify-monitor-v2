# Database Schema

## Overview
- Database: `shopify_monitor` (MongoDB 5+)
- Embedded documents for fast reads
- Time-series collections for analytics

---

## Core Collections

### stores
Shopify storefronts to poll.

**Fields:**
- `_id` - ObjectId
- `store_url` - string (unique)
- `store_name` - string
- `poll_interval` - number (minutes)
- `active` - boolean
- `created_at` - Date
- `last_polled_at` - Date
- `deactivated_at` - Date (optional)

**Indexes:**
- Unique: `store_url`
- Compound: `{ active: 1, last_polled_at: 1 }`

### products
Normalized product data with embedded variants and price history.

**Fields:**
- `_id` - ObjectId
- `product_id` - string (Shopify ID)
- `store_id` - ObjectId → `stores._id`
- `handle` - string
- `title` - string
- `product_type` - string
- `vendor` - string
- `tags` - string[]
- `main_image_url` - string
- `created_at` - Date
- `updated_at` - Date
- `last_polled_at` - Date
- `raw_data` - object (Shopify JSON)
- `variants` - array of:
  - `variant_id` - string
  - `variant_title` - string
  - `current_price` - number
  - `image_url` - string
  - `price_history` - array of `{ price, recorded_at }`

**Indexes:**
- Unique: `{ product_id, store_id }`
- Single: `store_id`, `variants.variant_id`, `handle`, `vendor`, `product_type`

### price_snapshots (time-series)
Every variant price captured during polling.

**Fields:**
- `timestamp` - Date (timeField)
- `price` - number
- `store_name` - string
- `metadata` - object (metaField):
  - `store_id` - ObjectId
  - `product_id` - string
  - `variant_id` - string
  - `product_type` - string
  - `tags` - string[]

**Time-series config:**
- `timeField: "timestamp"`
- `metaField: "metadata"`
- `granularity: "hours"`

**Indexes:**
- `{ timestamp: 1, "metadata.store_id": 1 }`
- `{ timestamp: 1, "metadata.tags": 1 }`
- `{ timestamp: 1, "metadata.product_type": 1 }`
- `{ "metadata.store_id": 1, timestamp: 1 }`
- `{ "metadata.product_type": 1, timestamp: 1 }`

---

### subscriptions
Price change monitoring subscriptions.

**Fields:**
- `_id` - ObjectId
- `scope_type` - enum: `product`, `store`, `product_type`, `store_product_type`
- `scope_key` - string (ID or composite key)
- `scope_hash` - string (unique, for deduplication)
- `change_type` - enum: `price_up`, `price_down`, `both`
- `created_at` - Date
- `updated_at` - Date
- `store_name` - string (optional, denormalized for product scope)
- `product_name` - string (optional, denormalized for product scope)

**Indexes:**
- Single: `scope_type`
- Unique: `scope_hash`

### change_logs
Price change events for subscriptions.

**Fields:**
- `_id` - ObjectId
- `subscription_id` - ObjectId → `subscriptions._id`
- `scope_type` - enum (same as subscription)
- `scope_key` - string
- `change_type` - enum (same as subscription)
- `previous_value` - number
- `current_value` - number
- `absolute_change` - number
- `percentage_change` - number
- `detected_at` - Date
- `read_at` - Date (optional)
- `is_baseline` - boolean
- `created_at` - Date
- `store_name` - string (optional, denormalized)
- `product_name` - string (optional, denormalized)

**Indexes:**
- Compound: `{ subscription_id: 1, detected_at: -1 }`
- Partial: `{ read_at: 1, detected_at: -1 }` (where `read_at` is null)

### change_read_counters
Unread change log counts.

**Fields:**
- `_id` - ObjectId
- `subscription_id` - ObjectId → `subscriptions._id`
- `unread_count` - number
- `updated_at` - Date

**Indexes:**
- Unique: `subscription_id`

### hourly_store_avg
Hourly price averages per store.

**Fields:**
- `store_id` - ObjectId → `stores._id`
- `window_start` - Date
- `window_end` - Date
- `avg_price` - number
- `product_count` - number
- `created_at` - Date

**Indexes:**
- Unique: `{ store_id, window_start }`

### hourly_tag_avg
Hourly price averages per tag.

**Fields:**
- `tag` - string
- `window_start` - Date
- `window_end` - Date
- `avg_price` - number
- `product_count` - number
- `created_at` - Date

**Indexes:**
- Unique: `{ tag, window_start }`

### hourly_store_tag_avg
Hourly price averages per store + tag.

**Fields:**
- `store_id` - ObjectId → `stores._id`
- `tag` - string
- `window_start` - Date
- `window_end` - Date
- `avg_price` - number
- `product_count` - number
- `created_at` - Date

**Indexes:**
- Unique: `{ store_id, tag, window_start }`

### hourly_product_type_avg
Hourly price averages per product type across all stores.

**Fields:**
- `product_type` - string
- `window_start` - Date
- `window_end` - Date
- `avg_price` - number
- `product_count` - number
- `store_count` - number
- `created_at` - Date

**Indexes:**
- Unique: `{ product_type, window_start }`

### hourly_store_product_type_avg
Hourly price averages per store + product type.

**Fields:**
- `store_id` - ObjectId → `stores._id`
- `product_type` - string
- `window_start` - Date
- `window_end` - Date
- `avg_price` - number
- `product_count` - number
- `created_at` - Date

**Indexes:**
- Unique: `{ store_id, product_type, window_start }`

## Data Flow

**Polling:**
1. Data service polls Shopify stores
2. Writes `products` with embedded variants and price history
3. Writes `price_snapshots` time-series entries
4. Evaluates active `subscriptions` and creates `change_logs`

**Aggregation:**
1. Scheduler runs hourly
2. Reads `price_snapshots` for time window
3. Writes/updates five `hourly_*` collections
4. Uses upserts for idempotency

**Monitoring:**
1. Backend creates `subscriptions` with baseline `change_logs`
2. Data service evaluates subscriptions after each poll
3. Creates new `change_logs` when price changes match criteria
4. Updates `change_read_counters` atomically

## Notes

- All collections use MongoDB replica set for change streams
- Time-series collections optimize storage and query performance
- Denormalized fields (`store_name`, `product_name`) avoid joins in UI
- Unique indexes prevent duplicate data during concurrent writes
- Partial indexes optimize queries for unread change logs

