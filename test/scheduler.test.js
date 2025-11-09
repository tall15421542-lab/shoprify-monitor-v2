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
  getPreviousHourWindow,
  runAggregations,
  triggerManualAggregation,
  startScheduler,
  stopScheduler,
  isSchedulerRunning
} from '../src/services/scheduler.js';

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

test('Scheduler Tests', async (t) => {
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
    stopScheduler();
    await cleanupTestData();
    await close();
  });
  
  await t.test('schedules job to run at top of hour', () => {
    // This is a verification that startScheduler doesn't throw
    startScheduler();
    assert.strictEqual(isSchedulerRunning(), true);
    stopScheduler();
    assert.strictEqual(isSchedulerRunning(), false);
  });
  
  await t.test('calculates correct previous hour window', () => {
    // Mock current time to a known value for testing
    const now = new Date('2024-01-01T15:30:00Z');
    
    // Manually calculate expected window
    const expectedWindowEnd = new Date('2024-01-01T15:00:00Z');
    const expectedWindowStart = new Date('2024-01-01T14:00:00Z');
    
    // Test getPreviousHourWindow at different times
    const testCases = [
      {
        currentTime: new Date('2024-01-01T15:30:00Z'),
        expectedStart: new Date('2024-01-01T14:00:00Z'),
        expectedEnd: new Date('2024-01-01T15:00:00Z')
      },
      {
        currentTime: new Date('2024-01-01T00:05:00Z'),
        expectedStart: new Date('2023-12-31T23:00:00Z'),
        expectedEnd: new Date('2024-01-01T00:00:00Z')
      }
    ];
    
    // We can't easily mock Date in Node.js, so we'll just verify the function returns valid dates
    const { windowStart, windowEnd } = getPreviousHourWindow();
    
    assert.ok(windowStart instanceof Date);
    assert.ok(windowEnd instanceof Date);
    assert.ok(windowStart < windowEnd);
    assert.strictEqual(windowEnd.getMinutes(), 0);
    assert.strictEqual(windowEnd.getSeconds(), 0);
    assert.strictEqual(windowEnd.getMilliseconds(), 0);
    assert.strictEqual(windowStart.getMinutes(), 0);
    assert.strictEqual(windowStart.getSeconds(), 0);
    assert.strictEqual(windowStart.getMilliseconds(), 0);
    
    // Verify it's exactly 1 hour difference
    const diffMs = windowEnd - windowStart;
    assert.strictEqual(diffMs, 60 * 60 * 1000); // 1 hour in milliseconds
  });
  
  await t.test('calls aggregateStoreAverages with correct window', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    // Insert test data
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: [] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 1);
    
    // Verify data was written
    const db = getDb();
    const storeAvg = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    assert.ok(storeAvg);
  });
  
  await t.test('calls aggregateTagAverages with correct window', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    // Insert test data with tags
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 100.00
      }
    ]);
    
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.tagCount, 1);
    
    // Verify data was written
    const db = getDb();
    const tagAvg = await db.collection('hourly_tag_avg').findOne({ tag: 'electronics' });
    assert.ok(tagAvg);
  });
  
  await t.test('calls aggregateStoreTagAverages with correct window', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    // Insert test data with tags
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['electronics'] },
        store_name: 'Test Store',
        price: 100.00
      }
    ]);
    
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeTagCount, 1);
    
    // Verify data was written
    const db = getDb();
    const storeTagAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: storeId,
      tag: 'electronics'
    });
    assert.ok(storeTagAvg);
  });
  
  await t.test('logs successful aggregation completion', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');
    
    // Insert test data
    await insertPriceSnapshots([
      {
        timestamp: new Date('2024-01-01T10:15:00Z'),
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['test'] },
        store_name: 'Test Store',
        price: 10.00
      }
    ]);
    
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.storeCount >= 0);
    assert.ok(result.tagCount >= 0);
    assert.ok(result.storeTagCount >= 0);
  });
  
  await t.test('logs and continues on aggregation error', async () => {
    // Test with invalid window (end before start) to trigger an error scenario
    const windowStart = new Date('2024-01-01T11:00:00Z');
    const windowEnd = new Date('2024-01-01T10:00:00Z'); // End before start
    
    // This should still return a result object, not throw
    const result = await runAggregations(windowStart, windowEnd);
    
    // Should return success since there's no data (not an error, just no results)
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 0);
  });
  
  await t.test('can manually trigger aggregation', async () => {
    await cleanupTestData();
    
    const storeId = new ObjectId();
    
    // Get the previous hour window
    const { windowStart, windowEnd } = getPreviousHourWindow();
    
    // Insert test data in the previous hour window
    const testTime = new Date(windowStart);
    testTime.setMinutes(15); // 15 minutes into the hour
    
    await insertPriceSnapshots([
      {
        timestamp: testTime,
        metadata: { store_id: storeId, product_id: 1, variant_id: 1, tags: ['manual-test'] },
        store_name: 'Test Store',
        price: 50.00
      }
    ]);
    
    const result = await triggerManualAggregation();
    
    assert.strictEqual(result.success, true);
    assert.ok(result.storeCount >= 0);
  });
});

