import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import * as connection from '../src/database/connection.js';
import * as aggregatorService from '../src/services/aggregator.js';
import * as monitoringService from '../src/services/monitoring.js';

function createWriteCollection() {
  const state = { ops: [] };
  return {
    state,
    async bulkWrite(operations) {
      state.ops.push(...operations);
    }
  };
}

function detectAggregationType(pipeline) {
  const groupStage = pipeline.find((stage) => stage.$group);
  if (!groupStage) {
    return 'store';
  }

  const groupId = groupStage.$group._id;
  if (typeof groupId === 'string' && groupId.includes('tags')) {
    return 'tag';
  }
  if (typeof groupId === 'string' && groupId.includes('product_type')) {
    return 'productType';
  }
  if (groupId && groupId.store_id && groupId.product_type) {
    return 'storeProductType';
  }
  if (groupId && groupId.store_id && groupId.tag) {
    return 'storeTag';
  }
  return 'store';
}

function setupMockDb({
  activeStores = [],
  storeAggregationResults = [],
  tagAggregationResults = [],
  storeTagAggregationResults = [],
  productTypeAggregationResults = [],
  storeProductTypeAggregationResults = []
} = {}) {
  const hourlyStoreAvg = createWriteCollection();
  const hourlyTagAvg = createWriteCollection();
  const hourlyStoreTagAvg = createWriteCollection();
  const hourlyProductTypeAvg = createWriteCollection();
  const hourlyStoreProductTypeAvg = createWriteCollection();

  const aggregationResultsMap = {
    store: storeAggregationResults,
    tag: tagAggregationResults,
    storeTag: storeTagAggregationResults,
    productType: productTypeAggregationResults,
    storeProductType: storeProductTypeAggregationResults
  };

  const collections = {
    stores: {
      find: () => ({
        toArray: async () => activeStores
      })
    },
    price_snapshots: {
      aggregate: (pipeline) => ({
        toArray: async () => aggregationResultsMap[detectAggregationType(pipeline)] || []
      })
    },
    hourly_store_avg: hourlyStoreAvg,
    hourly_tag_avg: hourlyTagAvg,
    hourly_store_tag_avg: hourlyStoreTagAvg,
    hourly_product_type_avg: hourlyProductTypeAvg,
    hourly_store_product_type_avg: hourlyStoreProductTypeAvg
  };

  mock.method(connection, 'getDb', () => ({
    collection(name) {
      const collection = collections[name];
      if (!collection) {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return collection;
    }
  }));

  return {
    hourlyStoreAvg,
    hourlyTagAvg,
    hourlyStoreTagAvg,
    hourlyProductTypeAvg,
    hourlyStoreProductTypeAvg
  };
}

describe('Aggregator service', () => {
  let evaluateMock;

  beforeEach(() => {
    mock.restoreAll();
    evaluateMock = mock.method(monitoringService, 'evaluateAggregatedSubscriptions', async () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('aggregateStoreAverages returns 0 when there are no active stores', async () => {
    setupMockDb({
      activeStores: []
    });

    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    const count = await aggregatorService.aggregateStoreAverages(windowStart, windowEnd);

    assert.strictEqual(count, 0);
    assert.strictEqual(evaluateMock.mock.calls.length, 0);
  });

  it('aggregateStoreAverages writes aggregated results and triggers subscription evaluation', async () => {
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    const storeId = 'store-1';

    const collections = setupMockDb({
      activeStores: [{ _id: storeId }],
      storeAggregationResults: [
        {
          store_id: storeId,
          avg_price: 15,
          product_count: 2,
          window_start: windowStart
        }
      ]
    });

    const count = await aggregatorService.aggregateStoreAverages(windowStart, windowEnd);

    assert.strictEqual(count, 1);
    assert.strictEqual(collections.hourlyStoreAvg.state.ops.length, 1);

    const [operation] = collections.hourlyStoreAvg.state.ops;
    assert.deepStrictEqual(operation.updateOne.filter, {
      store_id: storeId,
      window_start: windowStart
    });
    assert.deepStrictEqual(operation.updateOne.update.$set.avg_price, 15);
    assert.deepStrictEqual(operation.updateOne.update.$set.window_end, windowEnd);
    assert.strictEqual(operation.updateOne.upsert, true);

    assert.strictEqual(evaluateMock.mock.calls.length, 1);
    const [scopeType, records, detectedAt] = evaluateMock.mock.calls[0].arguments;
    assert.strictEqual(scopeType, 'store');
    assert.strictEqual(records.length, 1);
    assert.strictEqual(detectedAt.toISOString(), windowEnd.toISOString());
  });

  it('aggregateTagAverages persists tag-level results', async () => {
    const collections = setupMockDb({
      activeStores: [{ _id: 'store-1' }],
      tagAggregationResults: [
        {
          tag: 'electronics',
          avg_price: 120,
          product_count: 3,
          window_start: new Date('2024-01-01T10:00:00Z')
        },
        {
          tag: 'sale',
          avg_price: 80,
          product_count: 2,
          window_start: new Date('2024-01-01T10:00:00Z')
        }
      ]
    });

    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    const count = await aggregatorService.aggregateTagAverages(windowStart, windowEnd);

    assert.strictEqual(count, 2);
    assert.strictEqual(collections.hourlyTagAvg.state.ops.length, 2);
    assert.strictEqual(evaluateMock.mock.calls.length, 0);
  });

  it('aggregateProductTypeAverages evaluates subscriptions for product types', async () => {
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    setupMockDb({
      activeStores: [{ _id: 'store-1' }],
      productTypeAggregationResults: [
        {
          product_type: 'Hoodie',
          avg_price: 55,
          product_count: 4,
          store_count: 2,
          window_start: windowStart
        }
      ]
    });

    const count = await aggregatorService.aggregateProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 1);
    assert.strictEqual(evaluateMock.mock.calls.length, 1);
    const [scopeType, records] = evaluateMock.mock.calls[0].arguments;
    assert.strictEqual(scopeType, 'product_type');
    assert.strictEqual(records[0].product_type, 'Hoodie');
  });

  it('aggregateStoreProductTypeAverages evaluates subscriptions for store/product-type combinations', async () => {
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    setupMockDb({
      activeStores: [{ _id: 'store-42' }],
      storeProductTypeAggregationResults: [
        {
          store_id: 'store-42',
          product_type: 'Sneakers',
          avg_price: 95,
          product_count: 5,
          window_start: windowStart
        }
      ]
    });

    const count = await aggregatorService.aggregateStoreProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 1);
    assert.strictEqual(evaluateMock.mock.calls.length, 1);
    const [scopeType, records] = evaluateMock.mock.calls[0].arguments;
    assert.strictEqual(scopeType, 'store_product_type');
    assert.strictEqual(records[0].product_type, 'Sneakers');
    assert.strictEqual(records[0].store_id, 'store-42');
  });
});

import { test } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import {
  dropPriceSnapshotsCollection,
  createPriceSnapshotsCollection,
  createPriceSnapshotsIndexes,
  createHourlyStoreAvgCollection,
  createHourlyStoreAvgIndexes,
  createHourlyTagAvgCollection,
  createHourlyTagAvgIndexes,
  createHourlyStoreTagAvgCollection,
  createHourlyStoreTagAvgIndexes,
  createHourlyProductTypeAvgCollection,
  createHourlyProductTypeAvgIndexes,
  createHourlyStoreProductTypeAvgCollection,
  createHourlyStoreProductTypeAvgIndexes
} from '../src/database/analytics-schema.js';
import {
  aggregateStoreAverages,
  aggregateTagAverages,
  aggregateStoreTagAverages,
  aggregateProductTypeAverages,
  aggregateStoreProductTypeAverages
} from '../src/services/aggregator.js';

// Helper to clean up test data
async function cleanupTestData() {
  const db = getDb();
  await db.collection('stores').deleteMany({});
  await db.collection('price_snapshots').deleteMany({});
  await db.collection('hourly_store_avg').deleteMany({});
  await db.collection('hourly_tag_avg').deleteMany({});
  await db.collection('hourly_store_tag_avg').deleteMany({});
  await db.collection('hourly_product_type_avg').deleteMany({});
  await db.collection('hourly_store_product_type_avg').deleteMany({});
}

async function ensureStoresForSnapshots(snapshots) {
  const db = getDb();
  const storesCollection = db.collection('stores');

  const uniqueStores = new Map();
  for (const snapshot of snapshots) {
    const storeId = snapshot?.metadata?.store_id;
    if (storeId) {
      const stringId = storeId.toString();
      if (!uniqueStores.has(stringId)) {
        uniqueStores.set(stringId, storeId);
      }
    }
  }

  if (uniqueStores.size === 0) {
    return;
  }

  const bulkOps = Array.from(uniqueStores.values()).map((storeId) => ({
    updateOne: {
      filter: { _id: storeId },
      update: {
        $setOnInsert: {
          _id: storeId,
          store_name: `Store ${storeId.toString().slice(-4)}`,
          store_url: `https://${storeId.toString()}.example.com`,
          active: true,
          created_at: new Date(),
          last_polled_at: null
        }
      },
      upsert: true
    }
  }));

  await storesCollection.bulkWrite(bulkOps, { ordered: false });
}

async function setStoreActiveStatus(storeId, isActive) {
  const db = getDb();
  await db.collection('stores').updateOne(
    { _id: storeId },
    {
      $set: {
        active: isActive,
        deactivated_at: isActive ? null : new Date()
      }
    }
  );
}

// Helper to insert test price snapshots
async function insertPriceSnapshots(snapshots) {
  const db = getDb();
  await ensureStoresForSnapshots(snapshots);
  await db.collection('price_snapshots').insertMany(snapshots);
}

test('Aggregator Tests', async (t) => {
  await connect();
  await initializeIndexes();

  // Set up collections
  await dropPriceSnapshotsCollection();
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
  await createHourlyStoreAvgCollection();
  await createHourlyStoreAvgIndexes();
  await createHourlyTagAvgCollection();
  await createHourlyTagAvgIndexes();
  await createHourlyStoreTagAvgCollection();
  await createHourlyStoreTagAvgIndexes();
  await createHourlyProductTypeAvgCollection();
  await createHourlyProductTypeAvgIndexes();
  await createHourlyStoreProductTypeAvgCollection();
  await createHourlyStoreProductTypeAvgIndexes();

  t.after(async () => {
    await cleanupTestData();
    await close();
  });
  
  // Store Averages Tests
  await t.test('queries price_snapshots for specific hour window', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    // Insert snapshots within window
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, tags: [] },
        store_name: 'Test Store',
        price: 20.00
      }
    ]);
    
    // Insert snapshot outside window (should not be included)
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T11:15:00Z'),
        metadata: { store_id: storeId, product_id: 3, variant_id: 3, tags: [] },
        store_name: 'Test Store',
        price: 30.00
      }
    ]);
    
    const count = await aggregateStoreAverages(windowStart, windowEnd);
    assert.strictEqual(count, 1);
    
    const db = getDb();
    const result = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.strictEqual(result.avg_price, 15.00); // (10 + 20) / 2
  });
  
  await t.test('groups snapshots by store_id', async () => {
    await cleanupTestData();
    
    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Store 1',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, tags: [] },
        store_name: 'Store 2',
        price: 20.00
      }
    ]);
    
    const count = await aggregateStoreAverages(windowStart, windowEnd);
    assert.strictEqual(count, 2);
  });

  await t.test('skips inactive stores when aggregating store averages', async () => {
    await cleanupTestData();

    const activeStoreId = new ObjectId();
    const inactiveStoreId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: activeStoreId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Active Store',
        price: 10.0
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: inactiveStoreId, product_id: 2, variant_id: 2, tags: [] },
        store_name: 'Inactive Store',
        price: 20.0
      }
    ]);

    await setStoreActiveStatus(inactiveStoreId, false);

    const count = await aggregateStoreAverages(windowStart, windowEnd);
    assert.strictEqual(count, 1);

    const db = getDb();
    const activeResult = await db.collection('hourly_store_avg').findOne({ store_id: activeStoreId });
    const inactiveResult = await db.collection('hourly_store_avg').findOne({ store_id: inactiveStoreId });

    assert.ok(activeResult);
    assert.strictEqual(inactiveResult, null);
  });
  
  await t.test('calculates average price per store', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 2, tags: [] },
        store_name: 'Test Store',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 3, tags: [] },
        store_name: 'Test Store',
        price: 30.00
      }
    ]);
    
    await aggregateStoreAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.strictEqual(result.avg_price, 20.00); // (10 + 20 + 30) / 3
  });
  
  await t.test('counts unique products per store', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 2, tags: [] },
        store_name: 'Test Store',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 3, tags: [] },
        store_name: 'Test Store',
        price: 30.00
      }
    ]);
    
    await aggregateStoreAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.strictEqual(result.product_count, 2); // 2 unique products (1 and 2)
  });
  
  await t.test('writes to hourly_store_avg with window_start', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    await aggregateStoreAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.ok(result);
    assert.deepStrictEqual(result.window_start, windowStart);
    assert.deepStrictEqual(result.window_end, windowEnd);
  });
  
  await t.test('uses upsert to prevent duplicates', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    // Run aggregation twice
    await aggregateStoreAverages(windowStart, windowEnd);
    await aggregateStoreAverages(windowStart, windowEnd);
    
    const db = getDb();
    const count = await db.collection('hourly_store_avg').countDocuments({ store_id: storeId });
    
    assert.strictEqual(count, 1); // Should still be 1 document
  });
  
  await t.test('handles empty time window (no data)', async () => {
    await cleanupTestData();
    
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    const count = await aggregateStoreAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 0);
  });
  
  await t.test('handles single store with multiple products', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, tags: [] },
        store_name: 'Test Store',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 3, variant_id: 3, tags: [] },
        store_name: 'Test Store',
        price: 30.00
      }
    ]);
    
    await aggregateStoreAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.strictEqual(result.product_count, 3);
    assert.strictEqual(result.avg_price, 20.00);
  });
  
  await t.test('handles multiple stores in same window', async () => {
    await cleanupTestData();
    
    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const store3Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Store 1',
        price: 10.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, tags: [] },
        store_name: 'Store 2',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: store3Id, product_id: 3, variant_id: 3, tags: [] },
        store_name: 'Store 3',
        price: 30.00
      }
    ]);
    
    const count = await aggregateStoreAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 3);
    
    const db = getDb();
    const results = await db.collection('hourly_store_avg').find({}).toArray();
    
    assert.strictEqual(results.length, 3);
  });
  
  // Tag Averages Tests
  await t.test('unwinds tags array from snapshots', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['electronics', 'gadgets'] },
        store_name: 'Test Store',
        price: 100.00
      }
    ]);
    
    const count = await aggregateTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 2); // 2 tags
  });
  
  await t.test('groups snapshots by tag across all stores', async () => {
    await cleanupTestData();
    
    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Store 1',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, tags: ['electronics'] },
        store_name: 'Store 2',
        price: 200.00
      }
    ]);
    
    await aggregateTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'electronics' });
    
    assert.ok(result);
    assert.strictEqual(result.avg_price, 150.00); // (100 + 200) / 2
  });

  await t.test('skips tag aggregates for inactive stores', async () => {
    await cleanupTestData();

    const activeStoreId = new ObjectId();
    const inactiveStoreId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: activeStoreId, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Active Store',
        price: 100.0
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: inactiveStoreId, product_id: 2, variant_id: 2, tags: ['electronics'] },
        store_name: 'Inactive Store',
        price: 200.0
      }
    ]);

    await setStoreActiveStatus(inactiveStoreId, false);

    await aggregateTagAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'electronics' });

    assert.ok(result);
    assert.strictEqual(result.avg_price, 100.0);
    assert.strictEqual(result.product_count, 1);
  });
  
  await t.test('calculates average price per tag', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 40.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 3, variant_id: 3, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 60.00
      }
    ]);
    
    await aggregateTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'clothing' });
    
    assert.strictEqual(result.avg_price, 40.00); // (20 + 40 + 60) / 3
  });
  
  await t.test('counts unique products per tag', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 2, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 25.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 3, tags: ['clothing'] },
        store_name: 'Test Store',
        price: 30.00
      }
    ]);
    
    await aggregateTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'clothing' });
    
    assert.strictEqual(result.product_count, 2); // 2 unique products
  });
  
  await t.test('writes to hourly_tag_avg with window_start', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['test'] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    await aggregateTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'test' });
    
    assert.ok(result);
    assert.deepStrictEqual(result.window_start, windowStart);
    assert.deepStrictEqual(result.window_end, windowEnd);
  });
  
  await t.test('handles products with multiple tags', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['summer', 'sale', 'new'] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);
    
    const count = await aggregateTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 3);
    
    const db = getDb();
    const results = await db.collection('hourly_tag_avg').find({}).toArray();
    
    assert.strictEqual(results.length, 3);
    results.forEach(result => {
      assert.strictEqual(result.avg_price, 50.00);
      assert.strictEqual(result.product_count, 1);
    });
  });
  
  await t.test('handles products with no tags (skips)', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);
    
    const count = await aggregateTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 0); // No tags to aggregate
  });
  
  await t.test('aggregates same tag from different stores', async () => {
    await cleanupTestData();
    
    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, tags: ['popular'] },
        store_name: 'Store 1',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, tags: ['popular'] },
        store_name: 'Store 2',
        price: 200.00
      }
    ]);
    
    await aggregateTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_tag_avg').findOne({ tag: 'popular' });
    
    assert.strictEqual(result.avg_price, 150.00);
    assert.strictEqual(result.product_count, 2);
  });
  
  // Store-Tag Averages Tests
  await t.test('unwinds tags and groups by store_id + tag', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['tag1', 'tag2'] },
        store_name: 'Test Store',
        price: 100.00
      }
    ]);
    
    const count = await aggregateStoreTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 2); // 2 store-tag combinations
  });
  
  await t.test('calculates average price per store-tag pair', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 200.00
      }
    ]);
    
    await aggregateStoreTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_tag_avg').findOne({
      store_id: storeId,
      tag: 'electronics'
    });
    
    assert.strictEqual(result.avg_price, 150.00);
  });
  
  await t.test('counts unique products per store-tag pair', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 2, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 150.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 3, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 200.00
      }
    ]);
    
    await aggregateStoreTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_tag_avg').findOne({
      store_id: storeId,
      tag: 'electronics'
    });
    
    assert.strictEqual(result.product_count, 2); // 2 unique products
  });
  
  await t.test('writes to hourly_store_tag_avg with window_start', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['test'] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    await aggregateStoreTagAverages(windowStart, windowEnd);
    
    const db = getDb();
    const result = await db.collection('hourly_store_tag_avg').findOne({
      store_id: storeId,
      tag: 'test'
    });
    
    assert.ok(result);
    assert.deepStrictEqual(result.window_start, windowStart);
    assert.deepStrictEqual(result.window_end, windowEnd);
  });
  
  await t.test('handles one store with multiple tags', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['summer', 'sale'] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);
    
    const count = await aggregateStoreTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 2);
    
    const db = getDb();
    const results = await db.collection('hourly_store_tag_avg').find({ store_id: storeId }).toArray();
    
    assert.strictEqual(results.length, 2);
  });
  
  await t.test('handles same tag in different stores (separate documents)', async () => {
    await cleanupTestData();
    
    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, tags: ['popular'] },
        store_name: 'Store 1',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, tags: ['popular'] },
        store_name: 'Store 2',
        price: 200.00
      }
    ]);
    
    const count = await aggregateStoreTagAverages(windowStart, windowEnd);
    
    assert.strictEqual(count, 2); // 2 separate store-tag combinations
    
    const db = getDb();
    const store1Result = await db.collection('hourly_store_tag_avg').findOne({
      store_id: store1Id,
      tag: 'popular'
    });
    const store2Result = await db.collection('hourly_store_tag_avg').findOne({
      store_id: store2Id,
      tag: 'popular'
    });
    
    assert.strictEqual(store1Result.avg_price, 100.00);
    assert.strictEqual(store2Result.avg_price, 200.00);
  });

  // Product Type Averages Tests
  await t.test('groups snapshots by product_type across all stores', async () => {
    await cleanupTestData();

    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, product_type: 'T-Shirt', tags: [] },
        store_name: 'Store 1',
        price: 20.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, product_type: 'T-Shirt', tags: [] },
        store_name: 'Store 2',
        price: 30.00
      }
    ]);

    await aggregateProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_product_type_avg').findOne({ product_type: 'T-Shirt' });

    assert.ok(result);
    assert.strictEqual(result.avg_price, 25.00); // (20 + 30) / 2
    assert.strictEqual(result.store_count, 2); // 2 different stores
  });

  await t.test('calculates average price per product_type', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Hoodie', tags: [] },
        store_name: 'Test Store',
        price: 40.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, product_type: 'Hoodie', tags: [] },
        store_name: 'Test Store',
        price: 50.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 3, variant_id: 3, product_type: 'Hoodie', tags: [] },
        store_name: 'Test Store',
        price: 60.00
      }
    ]);

    await aggregateProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_product_type_avg').findOne({ product_type: 'Hoodie' });

    assert.strictEqual(result.avg_price, 50.00); // (40 + 50 + 60) / 3
  });

  await t.test('counts unique products and stores per product_type', async () => {
    await cleanupTestData();

    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, product_type: 'Jacket', tags: [] },
        store_name: 'Store 1',
        price: 100.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 2, product_type: 'Jacket', tags: [] },
        store_name: 'Store 1',
        price: 110.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 3, product_type: 'Jacket', tags: [] },
        store_name: 'Store 2',
        price: 120.00
      }
    ]);

    await aggregateProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_product_type_avg').findOne({ product_type: 'Jacket' });

    assert.strictEqual(result.product_count, 2); // 2 unique products
    assert.strictEqual(result.store_count, 2); // 2 unique stores
  });

  await t.test('writes to hourly_product_type_avg with window_start', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Shoes', tags: [] },
        store_name: 'Test Store',
        price: 80.00
      }
    ]);

    await aggregateProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_product_type_avg').findOne({ product_type: 'Shoes' });

    assert.ok(result);
    assert.deepStrictEqual(result.window_start, windowStart);
    assert.deepStrictEqual(result.window_end, windowEnd);
  });

  await t.test('handles products without product_type (skips)', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);

    const count = await aggregateProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 0); // No product types to aggregate
  });

  await t.test('handles multiple product types in same window', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Hat', tags: [] },
        store_name: 'Test Store',
        price: 15.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, product_type: 'Scarf', tags: [] },
        store_name: 'Test Store',
        price: 25.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 3, variant_id: 3, product_type: 'Gloves', tags: [] },
        store_name: 'Test Store',
        price: 35.00
      }
    ]);

    const count = await aggregateProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 3);
  });

  // Store-Product-Type Averages Tests
  await t.test('groups snapshots by store_id + product_type', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Shirt', tags: [] },
        store_name: 'Test Store',
        price: 30.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, product_type: 'Pants', tags: [] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);

    const count = await aggregateStoreProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 2); // 2 store-product-type combinations
  });

  await t.test('calculates average price per store-product-type pair', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Dress', tags: [] },
        store_name: 'Test Store',
        price: 60.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 2, product_type: 'Dress', tags: [] },
        store_name: 'Test Store',
        price: 80.00
      }
    ]);

    await aggregateStoreProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_store_product_type_avg').findOne({
      store_id: storeId,
      product_type: 'Dress'
    });

    assert.strictEqual(result.avg_price, 70.00);
  });

  await t.test('counts unique products per store-product-type pair', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Sweater', tags: [] },
        store_name: 'Test Store',
        price: 45.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 2, product_type: 'Sweater', tags: [] },
        store_name: 'Test Store',
        price: 50.00
      },
      {
        timestamp: new Date('2024-01-01T10:45:00Z'),
        metadata: { store_id: storeId, product_id: 2, variant_id: 3, product_type: 'Sweater', tags: [] },
        store_name: 'Test Store',
        price: 55.00
      }
    ]);

    await aggregateStoreProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_store_product_type_avg').findOne({
      store_id: storeId,
      product_type: 'Sweater'
    });

    assert.strictEqual(result.product_count, 2); // 2 unique products
  });

  await t.test('writes to hourly_store_product_type_avg with window_start', async () => {
    await cleanupTestData();

    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, product_type: 'Coat', tags: [] },
        store_name: 'Test Store',
        price: 120.00
      }
    ]);

    await aggregateStoreProductTypeAverages(windowStart, windowEnd);

    const db = getDb();
    const result = await db.collection('hourly_store_product_type_avg').findOne({
      store_id: storeId,
      product_type: 'Coat'
    });

    assert.ok(result);
    assert.deepStrictEqual(result.window_start, windowStart);
    assert.deepStrictEqual(result.window_end, windowEnd);
  });

  await t.test('handles same product_type in different stores (separate documents)', async () => {
    await cleanupTestData();

    const store1Id = new ObjectId();
    const store2Id = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: store1Id, product_id: 1, variant_id: 1, product_type: 'Sneakers', tags: [] },
        store_name: 'Store 1',
        price: 90.00
      },
      {
        timestamp: new Date('2024-01-01T10:30:00Z'),
        metadata: { store_id: store2Id, product_id: 2, variant_id: 2, product_type: 'Sneakers', tags: [] },
        store_name: 'Store 2',
        price: 110.00
      }
    ]);

    const count = await aggregateStoreProductTypeAverages(windowStart, windowEnd);

    assert.strictEqual(count, 2); // 2 separate store-product-type combinations

    const db = getDb();
    const store1Result = await db.collection('hourly_store_product_type_avg').findOne({
      store_id: store1Id,
      product_type: 'Sneakers'
    });
    const store2Result = await db.collection('hourly_store_product_type_avg').findOne({
      store_id: store2Id,
      product_type: 'Sneakers'
    });

    assert.strictEqual(store1Result.avg_price, 90.00);
    assert.strictEqual(store2Result.avg_price, 110.00);
  });
});


