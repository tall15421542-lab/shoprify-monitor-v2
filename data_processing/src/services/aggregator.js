import { getDb } from '../database/connection.js';
import { evaluateAggregatedSubscriptions } from './monitoring.js';

let evaluateAggregatedSubscriptionsImpl = evaluateAggregatedSubscriptions;
let getDbImpl = getDb;

export function setEvaluateAggregatedSubscriptionsImplementation(implementation) {
  evaluateAggregatedSubscriptionsImpl =
    typeof implementation === 'function' ? implementation : evaluateAggregatedSubscriptions;
}

export function resetEvaluateAggregatedSubscriptionsImplementation() {
  evaluateAggregatedSubscriptionsImpl = evaluateAggregatedSubscriptions;
}

export function setDatabaseAccessor(accessor) {
  getDbImpl = typeof accessor === 'function' ? accessor : getDb;
}

export function resetDatabaseAccessor() {
  getDbImpl = getDb;
}

async function getActiveStoreIds(db) {
  const storesCollection = db.collection('stores');
  const stores = await storesCollection
    .find({ active: true }, { projection: { _id: 1 } })
    .toArray();
  return stores.map((store) => store._id);
}

/**
 * Aggregate price snapshots into hourly store averages
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function aggregateStoreAverages(windowStart, windowEnd) {
  const db = getDbImpl();
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const hourlyStoreAvgCollection = db.collection('hourly_store_avg');

  const activeStoreIds = await getActiveStoreIds(db);
  if (activeStoreIds.length === 0) {
    console.log('No active stores found for store average aggregation.');
    return 0;
  }

  // Aggregate price snapshots by store_id
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: windowStart,
          $lt: windowEnd
        },
        'metadata.store_id': { $in: activeStoreIds }
      }
    },
    {
      $group: {
        _id: '$metadata.store_id',
        avg_price: { $avg: '$price' },
        product_count: { $addToSet: '$metadata.product_id' }
      }
    },
    {
      $project: {
        _id: 0,
        store_id: '$_id',
        avg_price: 1,
        product_count: { $size: '$product_count' },
        window_start: { $literal: windowStart }
      }
    }
  ];

  const results = await priceSnapshotsCollection.aggregate(pipeline).toArray();

  // Upsert results into hourly_store_avg
  if (results.length > 0) {
    const bulkOps = results.map(result => ({
      updateOne: {
        filter: {
          store_id: result.store_id,
          window_start: windowStart
        },
        update: {
          $set: {
            avg_price: result.avg_price,
            product_count: result.product_count,
            window_start: windowStart,
            window_end: windowEnd,
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await hourlyStoreAvgCollection.bulkWrite(bulkOps);
    await evaluateAggregatedSubscriptionsImpl('store', results, windowEnd);
    console.log(`✓ Aggregated ${results.length} store average(s) for window ${windowStart.toISOString()}`);
  } else {
    console.log(`No data to aggregate for window ${windowStart.toISOString()}`);
  }

  return results.length;
}

/**
 * Aggregate price snapshots into hourly tag averages
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function aggregateTagAverages(windowStart, windowEnd) {
  const db = getDbImpl();
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const hourlyTagAvgCollection = db.collection('hourly_tag_avg');

  const activeStoreIds = await getActiveStoreIds(db);
  if (activeStoreIds.length === 0) {
    console.log('No active stores found for tag average aggregation.');
    return 0;
  }

  // Aggregate price snapshots by tag
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: windowStart,
          $lt: windowEnd
        },
        'metadata.store_id': { $in: activeStoreIds }
      }
    },
    {
      $unwind: '$metadata.tags'
    },
    {
      $group: {
        _id: '$metadata.tags',
        avg_price: { $avg: '$price' },
        product_count: { $addToSet: '$metadata.product_id' }
      }
    },
    {
      $project: {
        _id: 0,
        tag: '$_id',
        avg_price: 1,
        product_count: { $size: '$product_count' },
        window_start: { $literal: windowStart }
      }
    }
  ];

  const results = await priceSnapshotsCollection.aggregate(pipeline).toArray();

  // Upsert results into hourly_tag_avg
  if (results.length > 0) {
    const bulkOps = results.map(result => ({
      updateOne: {
        filter: {
          tag: result.tag,
          window_start: windowStart
        },
        update: {
          $set: {
            avg_price: result.avg_price,
            product_count: result.product_count,
            window_start: windowStart,
            window_end: windowEnd,
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await hourlyTagAvgCollection.bulkWrite(bulkOps);
    console.log(`✓ Aggregated ${results.length} tag average(s) for window ${windowStart.toISOString()}`);
  } else {
    console.log(`No tag data to aggregate for window ${windowStart.toISOString()}`);
  }

  return results.length;
}

/**
 * Aggregate price snapshots into hourly store-tag averages
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function aggregateStoreTagAverages(windowStart, windowEnd) {
  const db = getDbImpl();
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const hourlyStoreTagAvgCollection = db.collection('hourly_store_tag_avg');

  const activeStoreIds = await getActiveStoreIds(db);
  if (activeStoreIds.length === 0) {
    console.log('No active stores found for store-tag average aggregation.');
    return 0;
  }

  // Aggregate price snapshots by store_id + tag
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: windowStart,
          $lt: windowEnd
        },
        'metadata.store_id': { $in: activeStoreIds }
      }
    },
    {
      $unwind: '$metadata.tags'
    },
    {
      $group: {
        _id: {
          store_id: '$metadata.store_id',
          tag: '$metadata.tags'
        },
        avg_price: { $avg: '$price' },
        product_count: { $addToSet: '$metadata.product_id' }
      }
    },
    {
      $project: {
        _id: 0,
        store_id: '$_id.store_id',
        tag: '$_id.tag',
        avg_price: 1,
        product_count: { $size: '$product_count' },
        window_start: { $literal: windowStart }
      }
    }
  ];

  const results = await priceSnapshotsCollection.aggregate(pipeline).toArray();

  // Upsert results into hourly_store_tag_avg
  if (results.length > 0) {
    const bulkOps = results.map(result => ({
      updateOne: {
        filter: {
          store_id: result.store_id,
          tag: result.tag,
          window_start: windowStart
        },
        update: {
          $set: {
            avg_price: result.avg_price,
            product_count: result.product_count,
            window_start: windowStart,
            window_end: windowEnd,
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await hourlyStoreTagAvgCollection.bulkWrite(bulkOps);
    console.log(`✓ Aggregated ${results.length} store-tag average(s) for window ${windowStart.toISOString()}`);
  } else {
    console.log(`No store-tag data to aggregate for window ${windowStart.toISOString()}`);
  }

  return results.length;
}

/**
 * Aggregate price snapshots into hourly product type averages
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function aggregateProductTypeAverages(windowStart, windowEnd) {
  const db = getDbImpl();
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const hourlyProductTypeAvgCollection = db.collection('hourly_product_type_avg');

  const activeStoreIds = await getActiveStoreIds(db);
  if (activeStoreIds.length === 0) {
    console.log('No active stores found for product type average aggregation.');
    return 0;
  }

  // Aggregate price snapshots by product_type
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: windowStart,
          $lt: windowEnd
        },
        'metadata.product_type': { $exists: true, $ne: null },
        'metadata.store_id': { $in: activeStoreIds }
      }
    },
    {
      $group: {
        _id: '$metadata.product_type',
        avg_price: { $avg: '$price' },
        product_count: { $addToSet: '$metadata.product_id' },
        store_count: { $addToSet: '$metadata.store_id' }
      }
    },
    {
      $project: {
        _id: 0,
        product_type: '$_id',
        avg_price: 1,
        product_count: { $size: '$product_count' },
        store_count: { $size: '$store_count' },
        window_start: { $literal: windowStart }
      }
    }
  ];

  const results = await priceSnapshotsCollection.aggregate(pipeline).toArray();

  // Upsert results into hourly_product_type_avg
  if (results.length > 0) {
    const bulkOps = results.map(result => ({
      updateOne: {
        filter: {
          product_type: result.product_type,
          window_start: windowStart
        },
        update: {
          $set: {
            avg_price: result.avg_price,
            product_count: result.product_count,
            store_count: result.store_count,
            window_start: windowStart,
            window_end: windowEnd,
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await hourlyProductTypeAvgCollection.bulkWrite(bulkOps);
    await evaluateAggregatedSubscriptionsImpl('product_type', results, windowEnd);
    console.log(`✓ Aggregated ${results.length} product type average(s) for window ${windowStart.toISOString()}`);
  } else {
    console.log(`No product type data to aggregate for window ${windowStart.toISOString()}`);
  }

  return results.length;
}

/**
 * Aggregate price snapshots into hourly store-product-type averages
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function aggregateStoreProductTypeAverages(windowStart, windowEnd) {
  const db = getDbImpl();
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const hourlyStoreProductTypeAvgCollection = db.collection('hourly_store_product_type_avg');

  const activeStoreIds = await getActiveStoreIds(db);
  if (activeStoreIds.length === 0) {
    console.log('No active stores found for store-product-type average aggregation.');
    return 0;
  }

  // Aggregate price snapshots by store_id + product_type
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: windowStart,
          $lt: windowEnd
        },
        'metadata.product_type': { $exists: true, $ne: null },
        'metadata.store_id': { $in: activeStoreIds }
      }
    },
    {
      $group: {
        _id: {
          store_id: '$metadata.store_id',
          product_type: '$metadata.product_type'
        },
        avg_price: { $avg: '$price' },
        product_count: { $addToSet: '$metadata.product_id' }
      }
    },
    {
      $project: {
        _id: 0,
        store_id: '$_id.store_id',
        product_type: '$_id.product_type',
        avg_price: 1,
        product_count: { $size: '$product_count' },
        window_start: { $literal: windowStart }
      }
    }
  ];

  const results = await priceSnapshotsCollection.aggregate(pipeline).toArray();

  // Upsert results into hourly_store_product_type_avg
  if (results.length > 0) {
    const bulkOps = results.map(result => ({
      updateOne: {
        filter: {
          store_id: result.store_id,
          product_type: result.product_type,
          window_start: windowStart
        },
        update: {
          $set: {
            avg_price: result.avg_price,
            product_count: result.product_count,
            window_start: windowStart,
            window_end: windowEnd,
            created_at: new Date()
          }
        },
        upsert: true
      }
    }));

    await hourlyStoreProductTypeAvgCollection.bulkWrite(bulkOps);
    await evaluateAggregatedSubscriptionsImpl('store_product_type', results, windowEnd);
    console.log(`✓ Aggregated ${results.length} store-product-type average(s) for window ${windowStart.toISOString()}`);
  } else {
    console.log(`No store-product-type data to aggregate for window ${windowStart.toISOString()}`);
  }

  return results.length;
}


