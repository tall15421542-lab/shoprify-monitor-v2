import { getDb } from './connection.js';

/**
 * Drop price_snapshots collection if it exists
 */
export async function dropPriceSnapshotsCollection() {
  const db = getDb();
  try {
    // For time-series collections, we need to drop the collection directly
    const collections = await db.listCollections({ name: 'price_snapshots' }).toArray();
    if (collections.length > 0) {
      await db.collection('price_snapshots').drop();
      console.log('Dropped price_snapshots collection');
    }
  } catch (err) {
    // Collection might not exist, ignore error
    if (err.code !== 26 && err.code !== 48) { // 26 = NamespaceNotFound, 48 = NamespaceExists
      throw err;
    }
  }
}

/**
 * Create the price_snapshots time-series collection
 * This collection stores individual price points over time
 */
export async function createPriceSnapshotsCollection() {
  const db = getDb();
  
  // Check if collection already exists
  const collections = await db.listCollections({ name: 'price_snapshots' }).toArray();
  if (collections.length > 0) {
    console.log('price_snapshots collection already exists');
    return;
  }
  
  // Create time-series collection
  await db.createCollection('price_snapshots', {
    timeseries: {
      timeField: 'timestamp',
      metaField: 'metadata',
      granularity: 'hours'
    }
  });
  
  console.log('Created price_snapshots time-series collection');
}

/**
 * Create indexes on price_snapshots collection for efficient queries
 */
export async function createPriceSnapshotsIndexes() {
  const db = getDb();
  const collection = db.collection('price_snapshots');
  
  // Compound index on timestamp + store_id
  await collection.createIndex(
    { timestamp: 1, 'metadata.store_id': 1 },
    { name: 'timestamp_store_id_idx' }
  );
  
  // Compound index on timestamp + tags (tags are in metadata)
  await collection.createIndex(
    { timestamp: 1, 'metadata.tags': 1 },
    { name: 'timestamp_tags_idx' }
  );
  
  // Compound index on timestamp + store_id + tags
  await collection.createIndex(
    { timestamp: 1, 'metadata.store_id': 1, 'metadata.tags': 1 },
    { name: 'timestamp_store_id_tags_idx' }
  );
  
  console.log('Created indexes on price_snapshots collection');
}

/**
 * Create hourly_store_avg collection for pre-aggregated store averages
 */
export async function createHourlyStoreAvgCollection() {
  const db = getDb();
  
  // Check if collection already exists
  const collections = await db.listCollections({ name: 'hourly_store_avg' }).toArray();
  if (collections.length > 0) {
    console.log('hourly_store_avg collection already exists');
    return;
  }
  
  await db.createCollection('hourly_store_avg');
  console.log('Created hourly_store_avg collection');
}

/**
 * Create indexes on hourly_store_avg collection
 */
export async function createHourlyStoreAvgIndexes() {
  const db = getDb();
  const collection = db.collection('hourly_store_avg');
  
  // Compound index on store_id + window_start (for unique constraint and queries)
  await collection.createIndex(
    { store_id: 1, window_start: 1 },
    { name: 'store_id_window_start_idx', unique: true }
  );
  
  console.log('Created indexes on hourly_store_avg collection');
}

/**
 * Create hourly_tag_avg collection for pre-aggregated tag averages
 */
export async function createHourlyTagAvgCollection() {
  const db = getDb();
  
  // Check if collection already exists
  const collections = await db.listCollections({ name: 'hourly_tag_avg' }).toArray();
  if (collections.length > 0) {
    console.log('hourly_tag_avg collection already exists');
    return;
  }
  
  await db.createCollection('hourly_tag_avg');
  console.log('Created hourly_tag_avg collection');
}

/**
 * Create indexes on hourly_tag_avg collection
 */
export async function createHourlyTagAvgIndexes() {
  const db = getDb();
  const collection = db.collection('hourly_tag_avg');
  
  // Compound index on tag + window_start (for unique constraint and queries)
  await collection.createIndex(
    { tag: 1, window_start: 1 },
    { name: 'tag_window_start_idx', unique: true }
  );
  
  console.log('Created indexes on hourly_tag_avg collection');
}

/**
 * Create hourly_store_tag_avg collection for pre-aggregated store-tag averages
 */
export async function createHourlyStoreTagAvgCollection() {
  const db = getDb();
  
  // Check if collection already exists
  const collections = await db.listCollections({ name: 'hourly_store_tag_avg' }).toArray();
  if (collections.length > 0) {
    console.log('hourly_store_tag_avg collection already exists');
    return;
  }
  
  await db.createCollection('hourly_store_tag_avg');
  console.log('Created hourly_store_tag_avg collection');
}

/**
 * Create indexes on hourly_store_tag_avg collection
 */
export async function createHourlyStoreTagAvgIndexes() {
  const db = getDb();
  const collection = db.collection('hourly_store_tag_avg');
  
  // Compound index on store_id + tag + window_start (for unique constraint and queries)
  await collection.createIndex(
    { store_id: 1, tag: 1, window_start: 1 },
    { name: 'store_id_tag_window_start_idx', unique: true }
  );
  
  console.log('Created indexes on hourly_store_tag_avg collection');
}

/**
 * Initialize all analytics collections and indexes
 */
export async function initializeAnalyticsSchema() {
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
  await createHourlyStoreAvgCollection();
  await createHourlyStoreAvgIndexes();
  await createHourlyTagAvgCollection();
  await createHourlyTagAvgIndexes();
  await createHourlyStoreTagAvgCollection();
  await createHourlyStoreTagAvgIndexes();
  console.log('Analytics schema initialization complete');
}

