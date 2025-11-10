# Phase 3 Implementation Plan

## Overview
Build analytics layer incrementally with tests at each step.

---

## Step 1: Create Time-Series Collection Schema
**Goal:** Set up `price_snapshots` time-series collection with proper configuration

**Implementation:**
- Create `price_snapshots` collection with time-series options
- Define schema: `{ timestamp, store_id, store_name, product_id, variant_id, price, tags[] }`
- Add indexes: timestamp+store_id, timestamp+tags, timestamp+store_id+tags

**Test:**
- Verify collection exists with correct time-series config
- Verify indexes are created
- Insert sample snapshot document and query it back

**Files:**
- `src/database/analytics-schema.js` (new)
- `test/analytics-schema.test.js` (new)

---

## Step 2: Build Transformer Service
**Goal:** Transform product changes into price snapshots

**Implementation:**
- Create transformer service that:
  - Takes a product document as input
  - Extracts each variant with current price
  - Creates price snapshot document for each variant
  - Denormalizes store_name and tags
  - Inserts into `price_snapshots` collection

**Test:**
- Given a product with 2 variants
- When transformer processes it
- Then 2 price snapshots are created with correct fields
- Verify tags are denormalized
- Verify store_name is denormalized

**Files:**
- `src/services/transformer.js` (new)
- `test/transformer.test.js` (new)

---

## Step 3: Integrate Change Stream Listener
**Goal:** Automatically detect product changes and trigger transformer

**Implementation:**
- Create change stream listener on `products` collection
- Watch for insert and update operations
- Filter to only process price changes
- Call transformer service for each change
- Handle errors gracefully

**Test:**
- Mock change stream events
- Verify transformer is called on insert
- Verify transformer is called on update
- Verify transformer NOT called if price unchanged
- Verify error handling

**Files:**
- `src/services/change-listener.js` (new)
- `test/change-listener.test.js` (new)

---

## Step 4: Create Pre-Aggregated Collection Schemas
**Goal:** Set up collections for hourly aggregations

**Implementation:**
- Create `hourly_store_avg` collection with indexes
- Create `hourly_tag_avg` collection with indexes  
- Create `hourly_store_tag_avg` collection with indexes
- Define schemas with fields: window_start, window_hours, avg_price, product_count

**Test:**
- Verify all 3 collections exist
- Verify indexes on each collection
- Insert sample aggregated document into each
- Query back and verify

**Files:**
- Update `src/database/analytics-schema.js`
- Update `test/analytics-schema.test.js`

---

## Step 5: Build Store Aggregation Job
**Goal:** Aggregate price_snapshots by store into hourly windows

**Implementation:**
- Create aggregation service for stores
- Build MongoDB aggregation pipeline:
  - Filter by time window (last hour)
  - Group by store_id and hour window
  - Calculate avg_price and product_count
  - Upsert into `hourly_store_avg`
- Track last processed timestamp

**Test:**
- Given 10 price_snapshots for 2 stores in 1 hour window
- When aggregation runs
- Then 2 documents created in hourly_store_avg
- Verify avg_price calculated correctly
- Verify product_count is correct
- Verify window_start is correct

**Files:**
- `src/services/aggregator-store.js` (new)
- `test/aggregator-store.test.js` (new)

---

## Step 6: Build Tag Aggregation Job
**Goal:** Aggregate price_snapshots by tag across all stores

**Implementation:**
- Create aggregation service for tags
- Build MongoDB aggregation pipeline:
  - Filter by time window (last hour)
  - Unwind tags array
  - Group by tag and hour window
  - Calculate avg_price and product_count
  - Upsert into `hourly_tag_avg`

**Test:**
- Given 10 price_snapshots with various tags in 1 hour window
- When aggregation runs
- Then correct documents created in hourly_tag_avg
- Verify tags are properly unwound and aggregated
- Verify avg_price per tag is correct

**Files:**
- `src/services/aggregator-tag.js` (new)
- `test/aggregator-tag.test.js` (new)

---

## Step 7: Build Store-Tag Aggregation Job
**Goal:** Aggregate price_snapshots by store-tag combination

**Implementation:**
- Create aggregation service for store-tag pairs
- Build MongoDB aggregation pipeline:
  - Filter by time window (last hour)
  - Unwind tags array
  - Group by store_id, tag, and hour window
  - Calculate avg_price and product_count
  - Upsert into `hourly_store_tag_avg`

**Test:**
- Given price_snapshots for 2 stores with overlapping tags
- When aggregation runs
- Then correct store-tag pairs created
- Verify avg_price per store-tag combination
- Verify product_count is correct

**Files:**
- `src/services/aggregator-store-tag.js` (new)
- `test/aggregator-store-tag.test.js` (new)

---

## Step 8: Create Scheduler Service
**Goal:** Run all aggregations hourly on schedule

**Implementation:**
- Create scheduler using node-cron or similar
- Schedule all 3 aggregators to run hourly
- Run them sequentially (store → tag → store-tag)
- Log start/end times and results
- Handle errors and retry logic

**Test:**
- Mock time and trigger scheduler
- Verify all 3 aggregators are called
- Verify they run in correct order
- Verify error in one doesn't block others
- Test with actual time intervals (integration test)

**Files:**
- `src/services/scheduler.js` (new)
- `test/scheduler.test.js` (new)

---


---

## Step 9: Integration Test - End to End
**Goal:** Verify entire pipeline works together

**Implementation:**
- Create integration test that:
  - Inserts product with variants
  - Waits for change stream to trigger
  - Verifies price_snapshots created
  - Manually triggers aggregation
  - Verifies all 3 pre-aggregated collections populated
  - Verifies aggregated values are correct

**Test:**
- Full pipeline test with real MongoDB instance
- Test with multiple products, stores, and tags
- Verify data flows correctly through all steps
- Verify aggregated data matches expected calculations

**Files:**
- `test/integration.test.js` (new)

---

## Step 10: Add to Main Application
**Goal:** Integrate analytics into main.js startup

**Implementation:**
- Initialize analytics schema on startup
- Start change stream listener
- Start scheduler
- Add graceful shutdown for change stream and scheduler
- Add logging for all analytics operations

**Test:**
- Start application and verify all services start
- Verify logs show proper initialization
- Test graceful shutdown
- Verify no memory leaks on restart

**Files:**
- Update `src/main.js`
- Update existing tests

---

## Summary

**Total New Files:** 13
- 6 service files
- 6 test files  
- 1 integration test

**Testing Strategy:**
- Unit tests for each service
- Integration test for full pipeline
- Each step builds on previous steps
- Can verify correctness at each stage

