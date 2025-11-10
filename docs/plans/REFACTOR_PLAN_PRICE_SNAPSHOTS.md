# Refactor Plan: Direct Price Snapshot Writing

## Overview
Change from **Change Data Capture (CDC)** approach to **Direct Write** approach for price snapshots.

### Current Approach (CDC)
```
Poll Shopify → Save to products → Change Stream detects → Transform → Write to price_snapshots
```

### New Approach (Direct Write)
```
Poll Shopify → Save to products + Write to price_snapshots (simultaneously)
```

## Why This Change?

### Problems with CDC Approach
- **Requires MongoDB replica set** (not available in standalone/dev environments)
- **Added complexity** (extra service to manage)
- **Added latency** (change detection → transform → write)
- **Less reliable** (change stream can fail independently)

### Benefits of Direct Write
- **Works with standalone MongoDB** (no replica set required)
- **Simpler architecture** (one less service)
- **Immediate writes** (no latency between product save and snapshot)
- **More reliable** (single transaction path)

---

## High-Level Changes

### 1. Modify `upsertProduct()` Function
**Location:** `src/database/operations.js`

**Change:** Add price snapshot writes directly in the upsert function

**Logic:**
- When saving/updating a product in `products` collection
- Loop through each variant
- For each variant, also write to `price_snapshots` collection
- Use the same timestamp for both operations

**Key Points:**
- Reuse store information already available
- Leverage existing variant loop (lines 58-115)
- No need to fetch store separately

---

### 2. Remove/Deprecate Change Stream Transformer
**Location:** `src/services/transformer.js`

**Options:**
- **Option A:** Delete the file entirely
- **Option B:** Keep `transformProduct()` manual function for backfilling, remove change stream logic

**Recommendation:** Keep manual transform function for data migration/backfill scenarios

**What to Remove:**
- `startTransformer()` function
- `stopTransformer()` function
- Change stream logic (lines 10-72)

**What to Keep:**
- `transformProduct()` function (useful for manual backfilling)

---

### 3. Update Main Application
**Location:** `src/main.js`

**Changes:**
- Remove transformer import (if fully deleted)
- Remove transformer start/stop calls (already commented out)
- Remove transformer from shutdown handlers (lines 70, 80)

---

### 4. Update Poller Service (Optional Enhancement)
**Location:** `src/services/poller.js`

**Optional:** Add logging for price snapshot creation
- Track how many snapshots created per poll
- Add to success metrics

---

## Implementation Steps

### Step 1: Create Helper Function
Create `createPriceSnapshot()` helper in `operations.js`:
- Takes: product, variant, store info, timestamp
- Returns: snapshot document ready for insertion
- Encapsulates snapshot document structure

### Step 2: Modify `upsertProduct()`
- Add parameter to accept store information (or fetch it once at the start)
- In the variant loop, collect snapshot documents
- After variant updates, bulk insert all snapshots
- Use `insertMany()` for efficiency

### Step 3: Update Transformer Service
- Remove change stream functions
- Keep `transformProduct()` for backfilling
- Add comment explaining manual function purpose

### Step 4: Update Tests
- Update `operations.test.js` to verify snapshot creation
- Update or remove `transformer.test.js` (depending on what's kept)
- Update `analytics-integration.test.js` to use new flow

### Step 5: Clean Up Main
- Remove transformer service references
- Update startup/shutdown logic

---

## Testing Considerations

### Unit Tests
- Test `upsertProduct()` creates correct snapshots
- Test snapshot document structure matches schema
- Test bulk insert works correctly
- Test error handling if snapshot write fails

### Integration Tests
- Verify full poll → save → snapshot flow
- Verify aggregations still work with new snapshots
- Test with multiple products and variants
- Test with missing/null price values

### Edge Cases
- Product with no variants
- Variant with null price
- Snapshot write fails but product saves successfully
- Store information not found

---

## Files to Modify

1. **`src/database/operations.js`** - Add snapshot writing to upsertProduct
2. **`src/services/transformer.js`** - Remove/simplify change stream logic
3. **`src/main.js`** - Remove transformer service references
4. **`src/services/poller.js`** (optional) - Add snapshot metrics
5. **`test/transformer.test.js`** - Update or remove tests
6. **`test/analytics-integration.test.js`** - Update to use new flow

---

## Expected Outcomes

✅ Simpler architecture (one less service)
✅ Works with standalone MongoDB
✅ Faster price snapshot creation
✅ More reliable data flow
✅ Easier to debug and test
✅ Same analytics capabilities

## Summary

**From:**
```javascript
Poll → Save products → [Change Stream] → Transform → Save snapshots
```

**To:**
```javascript
Poll → Save products + Save snapshots (together)
```

This refactor simplifies the architecture while maintaining all analytics functionality and eliminating the MongoDB replica set requirement.

