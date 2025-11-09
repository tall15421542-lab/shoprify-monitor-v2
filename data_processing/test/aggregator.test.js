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
  createHourlyStoreTagAvgIndexes
} from '../src/database/analytics-schema.js';
import {
  aggregateStoreAverages,
  aggregateTagAverages,
  aggregateStoreTagAverages
} from '../src/services/aggregator.js';

// Helper to clean up test data
async function cleanupTestData() {
  const db = getDb();
  await db.collection('price_snapshots').deleteMany({});
  await db.collection('hourly_store_avg').deleteMany({});
  await db.collection('hourly_tag_avg').deleteMany({});
  await db.collection('hourly_store_tag_avg').deleteMany({});
}

// Helper to insert test price snapshots
async function insertPriceSnapshots(snapshots) {
  const db = getDb();
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
});


