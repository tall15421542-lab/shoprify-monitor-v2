import { test } from 'node:test';
import assert from 'node:assert';
import { connect, close, getDb } from '../src/database/connection.js';
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
  createHourlyStoreProductTypeAvgIndexes,
  initializeAnalyticsSchema
} from '../src/database/analytics-schema.js';

// Helper function to clean up test collections
async function cleanupTestCollections() {
  const db = getDb();
  const collections = [
    'price_snapshots',
    'hourly_store_avg',
    'hourly_tag_avg',
    'hourly_store_tag_avg',
    'hourly_product_type_avg',
    'hourly_store_product_type_avg'
  ];

  for (const collectionName of collections) {
    try {
      await db.collection(collectionName).drop();
    } catch (err) {
      // Collection might not exist, ignore error
    }
  }
}

test('Analytics Schema Tests', async (t) => {
  // Connect to database before all tests
  await connect();
  
  t.after(async () => {
    await cleanupTestCollections();
    await close();
  });
  
  await t.test('creates price_snapshots as time-series collection', async () => {
    await cleanupTestCollections();
    await createPriceSnapshotsCollection();
    
    const db = getDb();
    const collections = await db.listCollections({ name: 'price_snapshots' }).toArray();
    
    assert.strictEqual(collections.length, 1, 'price_snapshots collection should exist');
    assert.strictEqual(collections[0].name, 'price_snapshots');
    assert.strictEqual(collections[0].type, 'timeseries', 'should be a time-series collection');
  });
  
  await t.test('sets correct time-series options', async () => {
    const db = getDb();
    const collections = await db.listCollections({ name: 'price_snapshots' }).toArray();
    
    assert.ok(collections[0].options.timeseries, 'should have timeseries options');
    assert.strictEqual(collections[0].options.timeseries.timeField, 'timestamp');
    assert.strictEqual(collections[0].options.timeseries.metaField, 'metadata');
    assert.strictEqual(collections[0].options.timeseries.granularity, 'hours');
  });
  
  await t.test('creates compound index on timestamp + metadata.store_id', async () => {
    await createPriceSnapshotsIndexes();
    
    const db = getDb();
    const collection = db.collection('price_snapshots');
    const indexes = await collection.indexes();
    
    const timestoreIndex = indexes.find(idx => idx.name === 'timestamp_store_id_idx');
    assert.ok(timestoreIndex, 'timestamp_store_id_idx should exist');
    assert.deepStrictEqual(timestoreIndex.key, { timestamp: 1, 'metadata.store_id': 1 });
  });
  
  await t.test('creates compound index on timestamp + tags', async () => {
    const db = getDb();
    const collection = db.collection('price_snapshots');
    const indexes = await collection.indexes();
    
    const timestampTagsIndex = indexes.find(idx => idx.name === 'timestamp_tags_idx');
    assert.ok(timestampTagsIndex, 'timestamp_tags_idx should exist');
    assert.deepStrictEqual(timestampTagsIndex.key, { timestamp: 1, 'metadata.tags': 1 });
  });
  
  await t.test('creates compound index on timestamp + metadata.store_id + tags', async () => {
    const db = getDb();
    const collection = db.collection('price_snapshots');
    const indexes = await collection.indexes();
    
    const compoundIndex = indexes.find(idx => idx.name === 'timestamp_store_id_tags_idx');
    assert.ok(compoundIndex, 'timestamp_store_id_tags_idx should exist');
    assert.deepStrictEqual(compoundIndex.key, { timestamp: 1, 'metadata.store_id': 1, 'metadata.tags': 1 });
  });
  
  await t.test('creates hourly_store_avg collection', async () => {
    await createHourlyStoreAvgCollection();
    
    const db = getDb();
    const collections = await db.listCollections({ name: 'hourly_store_avg' }).toArray();
    
    assert.strictEqual(collections.length, 1, 'hourly_store_avg collection should exist');
    assert.strictEqual(collections[0].name, 'hourly_store_avg');
  });
  
  await t.test('creates index on store_id + window_start', async () => {
    await createHourlyStoreAvgIndexes();
    
    const db = getDb();
    const collection = db.collection('hourly_store_avg');
    const indexes = await collection.indexes();
    
    const storeWindowIndex = indexes.find(idx => idx.name === 'store_id_window_start_idx');
    assert.ok(storeWindowIndex, 'store_id_window_start_idx should exist');
    assert.deepStrictEqual(storeWindowIndex.key, { store_id: 1, window_start: 1 });
    assert.strictEqual(storeWindowIndex.unique, true, 'index should be unique');
  });
  
  await t.test('creates hourly_tag_avg collection', async () => {
    await createHourlyTagAvgCollection();
    
    const db = getDb();
    const collections = await db.listCollections({ name: 'hourly_tag_avg' }).toArray();
    
    assert.strictEqual(collections.length, 1, 'hourly_tag_avg collection should exist');
    assert.strictEqual(collections[0].name, 'hourly_tag_avg');
  });
  
  await t.test('creates index on tag + window_start', async () => {
    await createHourlyTagAvgIndexes();
    
    const db = getDb();
    const collection = db.collection('hourly_tag_avg');
    const indexes = await collection.indexes();
    
    const tagWindowIndex = indexes.find(idx => idx.name === 'tag_window_start_idx');
    assert.ok(tagWindowIndex, 'tag_window_start_idx should exist');
    assert.deepStrictEqual(tagWindowIndex.key, { tag: 1, window_start: 1 });
    assert.strictEqual(tagWindowIndex.unique, true, 'index should be unique');
  });
  
  await t.test('creates hourly_store_tag_avg collection', async () => {
    await createHourlyStoreTagAvgCollection();
    
    const db = getDb();
    const collections = await db.listCollections({ name: 'hourly_store_tag_avg' }).toArray();
    
    assert.strictEqual(collections.length, 1, 'hourly_store_tag_avg collection should exist');
    assert.strictEqual(collections[0].name, 'hourly_store_tag_avg');
  });
  
  await t.test('creates index on store_id + tag + window_start', async () => {
    await createHourlyStoreTagAvgIndexes();

    const db = getDb();
    const collection = db.collection('hourly_store_tag_avg');
    const indexes = await collection.indexes();

    const storeTagWindowIndex = indexes.find(idx => idx.name === 'store_id_tag_window_start_idx');
    assert.ok(storeTagWindowIndex, 'store_id_tag_window_start_idx should exist');
    assert.deepStrictEqual(storeTagWindowIndex.key, { store_id: 1, tag: 1, window_start: 1 });
    assert.strictEqual(storeTagWindowIndex.unique, true, 'index should be unique');
  });

  await t.test('creates compound index on timestamp + product_type', async () => {
    const db = getDb();
    const collection = db.collection('price_snapshots');
    const indexes = await collection.indexes();

    const timestampProductTypeIndex = indexes.find(idx => idx.name === 'timestamp_product_type_idx');
    assert.ok(timestampProductTypeIndex, 'timestamp_product_type_idx should exist');
    assert.deepStrictEqual(timestampProductTypeIndex.key, { timestamp: 1, 'metadata.product_type': 1 });
  });

  await t.test('creates compound index on timestamp + store_id + product_type', async () => {
    const db = getDb();
    const collection = db.collection('price_snapshots');
    const indexes = await collection.indexes();

    const compoundProductTypeIndex = indexes.find(idx => idx.name === 'timestamp_store_id_product_type_idx');
    assert.ok(compoundProductTypeIndex, 'timestamp_store_id_product_type_idx should exist');
    assert.deepStrictEqual(compoundProductTypeIndex.key, { timestamp: 1, 'metadata.store_id': 1, 'metadata.product_type': 1 });
  });

  await t.test('creates hourly_product_type_avg collection', async () => {
    await createHourlyProductTypeAvgCollection();

    const db = getDb();
    const collections = await db.listCollections({ name: 'hourly_product_type_avg' }).toArray();

    assert.strictEqual(collections.length, 1, 'hourly_product_type_avg collection should exist');
    assert.strictEqual(collections[0].name, 'hourly_product_type_avg');
  });

  await t.test('creates index on product_type + window_start', async () => {
    await createHourlyProductTypeAvgIndexes();

    const db = getDb();
    const collection = db.collection('hourly_product_type_avg');
    const indexes = await collection.indexes();

    const productTypeWindowIndex = indexes.find(idx => idx.name === 'product_type_window_start_idx');
    assert.ok(productTypeWindowIndex, 'product_type_window_start_idx should exist');
    assert.deepStrictEqual(productTypeWindowIndex.key, { product_type: 1, window_start: 1 });
    assert.strictEqual(productTypeWindowIndex.unique, true, 'index should be unique');
  });

  await t.test('creates hourly_store_product_type_avg collection', async () => {
    await createHourlyStoreProductTypeAvgCollection();

    const db = getDb();
    const collections = await db.listCollections({ name: 'hourly_store_product_type_avg' }).toArray();

    assert.strictEqual(collections.length, 1, 'hourly_store_product_type_avg collection should exist');
    assert.strictEqual(collections[0].name, 'hourly_store_product_type_avg');
  });

  await t.test('creates index on store_id + product_type + window_start', async () => {
    await createHourlyStoreProductTypeAvgIndexes();

    const db = getDb();
    const collection = db.collection('hourly_store_product_type_avg');
    const indexes = await collection.indexes();

    const storeProductTypeWindowIndex = indexes.find(idx => idx.name === 'store_id_product_type_window_start_idx');
    assert.ok(storeProductTypeWindowIndex, 'store_id_product_type_window_start_idx should exist');
    assert.deepStrictEqual(storeProductTypeWindowIndex.key, { store_id: 1, product_type: 1, window_start: 1 });
    assert.strictEqual(storeProductTypeWindowIndex.unique, true, 'index should be unique');
  });
});

