# Phase 3: Analytics Database Design

## Database Choice

**Decision: MongoDB with Time-Series Collections and Scheduled Aggregation**

Rationale:
- Already using MongoDB as source database (no migration needed)
- Time-series collections optimize storage and queries for price data
- Aggregation pipeline handles complex tag aggregations across thousands of stores
- Scheduled aggregation provides eventual consistency without race conditions
- Easy to replay and fix if aggregation logic needs updates

## Schema Design

### Existing Collections (unchanged from Phase 1)

**stores collection**
- Stores basic store information
- Fields: store_url, store_name, active, polling_interval, timestamps

**products collection**
- Stores current product state with embedded variants
- Each variant has price_history array
- Source of truth for all product data

### New Collections for Analytics

**price_snapshots collection (Time-Series)**
- Purpose: Flatten price data for efficient time-range queries
- Time-series optimized with hourly granularity
- Each document represents one variant price at one point in time
- Denormalizes store_name and tags for faster aggregation
- Fields: timestamp, store_id, store_name, product_id, variant_id, price, tags array

**hourly_store_avg collection (Pre-Aggregated)**
- Purpose: Fast queries for average price by store
- Each document represents one store in one hour window
- Fields: store_id, store_name, window_start, window_hours, avg_price, product_count

**hourly_tag_avg collection (Pre-Aggregated)**
- Purpose: Fast queries for average price by tag across all stores
- Each document represents one tag in one hour window
- Handles tag aggregation across thousands of stores efficiently
- Fields: tag, window_start, window_hours, avg_price, product_count

**hourly_store_tag_avg collection (Pre-Aggregated)**
- Purpose: Fast queries for average price by store and tag combination
- Each document represents one store-tag pair in one hour window
- Fields: store_id, store_name, tag, window_start, window_hours, avg_price, product_count

### Indexes

**price_snapshots indexes:**
- timestamp + store_id (for store time-range queries)
- timestamp + tags (for tag time-range queries)
- timestamp + store_id + tags (for store-tag time-range queries)

**Aggregated collection indexes:**
- store_id + window_start (for store queries)
- tag + window_start (for tag queries)
- store_id + tag + window_start (for store-tag queries)

## Data Flow Architecture

### Flow Overview

Step 1: Poller writes to products collection (existing Phase 1 behavior)

Step 2: Change Stream listener detects product changes

Step 3: Transformer service reads change and writes to price_snapshots collection

Step 4: Scheduled aggregation job (runs hourly) reads price_snapshots and updates pre-aggregated collections

Step 5: API endpoints read from pre-aggregated collections for fast response

## How Incremental Aggregation Works

### Time Window Processing

The aggregation job only processes new data, not historical data:

**Hour by hour processing:**
- 01:00 - Job runs, aggregates 00:00 to 01:00, writes window_start=00:00
- 02:00 - Job runs, aggregates 01:00 to 02:00, writes window_start=01:00
- 03:00 - Job runs, aggregates 02:00 to 03:00, writes window_start=02:00
- Previous hours (00:00, 01:00) are never recalculated

**How it filters data:**
- Query: Find all price_snapshots where timestamp >= 14:00 AND timestamp < 15:00
- Write: One document with window_start=14:00

