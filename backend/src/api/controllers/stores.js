import { ObjectId } from 'mongodb';
import { getDb } from '../../database/connection.js';
import {
  createEmptySubscriptionFlags,
  getStoreSubscriptionFlag,
  loadSubscriptionFlags
} from '../../services/subscription-flags.js';
import { triggerStorePoll, triggerCurrentHourAggregation } from '../clients/trigger-client.js';

/**
 * Add a new store
 * POST /stores
 */
export async function addStore(req, res, next) {
  try {
    const { store_url, store_name, poll_interval } = req.body;

    // Validate required fields
    if (!store_url || !store_name) {
      return res.status(400).json({
        error: 'Missing required fields: store_url and store_name are required'
      });
    }

    const db = getDb();
    const stores = db.collection('stores');

    // Check if store already exists
    const existingStore = await stores.findOne({ store_url });
    if (existingStore) {
      return res.status(409).json({
        error: 'Store already exists',
        store_id: existingStore._id
      });
    }

    // Insert new store
    const storeData = {
      store_url,
      store_name,
      poll_interval: poll_interval || 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    };

    const result = await stores.insertOne(storeData);
    const newStore = {
      _id: result.insertedId,
      ...storeData
    };

    // Trigger initial poll and aggregation in background via REST API
    // Don't wait for completion to avoid timeout
    setImmediate(async () => {
      try {
        console.log(`\n🚀 Triggering initial poll for new store: ${store_name}`);
        const pollResult = await triggerStorePoll(result.insertedId.toString());
        console.log(`✓ Initial poll triggered:`, pollResult);
        
        // Trigger aggregation for current hour
        console.log(`📊 Triggering initial aggregation for new store: ${store_name}`);
        const aggregationResult = await triggerCurrentHourAggregation();
        console.log(`✓ Initial aggregation triggered:`, aggregationResult);
      } catch (error) {
        console.error(`❌ Error in initial poll/aggregation for ${store_name}:`, error.message);
      }
    });

    res.status(201).json({
      message: 'Store added successfully. Initial polling and aggregation started in background.',
      store: {
        ...newStore,
        product_count: 0 // New stores have no products initially
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all stores
 * GET /stores
 */
export async function getAllStores(req, res, next) {
  try {
    const db = getDb();
    const stores = db.collection('stores');

    // Use aggregation to include product count for each store
    const allStores = await stores.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'store_id',
          as: 'products'
        }
      },
      {
        $addFields: {
          product_count: { $size: '$products' }
        }
      },
      {
        $project: {
          products: 0 // Remove the products array, we only need the count
        }
      },
      {
        $sort: { created_at: -1 }
      }
    ]).toArray();

    const storeIds = allStores
      .map((store) => store?._id?.toString())
      .filter((value) => typeof value === 'string');

    const subscriptionFlags = storeIds.length > 0
      ? await loadSubscriptionFlags({ storeIds })
      : createEmptySubscriptionFlags();

    const storesWithMonitoring = allStores.map((store) => {
      const storeId = store?._id?.toString();
      const storeSubscribed = storeId
        ? getStoreSubscriptionFlag(subscriptionFlags, storeId)
        : false;

      return {
        ...store,
        monitoring: {
          store: {
            subscribed: storeSubscribed
          }
        }
      };
    });

    res.json({
      count: storesWithMonitoring.length,
      stores: storesWithMonitoring
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single store by ID
 * GET /stores/:storeId
 */
export async function getStoreById(req, res, next) {
  try {
    const { storeId } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const stores = db.collection('stores');

    // Use aggregation to include product count
    const storeArray = await stores.aggregate([
      {
        $match: { _id: new ObjectId(storeId) }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'store_id',
          as: 'products'
        }
      },
      {
        $addFields: {
          product_count: { $size: '$products' }
        }
      },
      {
        $project: {
          products: 0 // Remove the products array, we only need the count
        }
      }
    ]).toArray();

    if (storeArray.length === 0) {
      return res.status(404).json({
        error: 'Store not found'
      });
    }

    const storeDoc = storeArray[0];
    const storeIdStr = storeDoc?._id?.toString();
    const subscriptionFlags = storeIdStr
      ? await loadSubscriptionFlags({ storeIds: [storeIdStr] })
      : createEmptySubscriptionFlags();

    const storeSubscribed = storeIdStr
      ? getStoreSubscriptionFlag(subscriptionFlags, storeIdStr)
      : false;

    res.json({
      store: {
        ...storeDoc,
        monitoring: {
          store: {
            subscribed: storeSubscribed
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a store inactive (soft delete)
 * DELETE /stores/:storeId
 */
export async function deactivateStore(req, res, next) {
  try {
    const { storeId } = req.params;

    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const stores = db.collection('stores');

    const updatedStore = await stores.findOneAndUpdate(
      { _id: new ObjectId(storeId), active: true },
      {
        $set: {
          active: false,
          deactivated_at: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!updatedStore) {
      return res.status(404).json({
        error: 'Store not found or already inactive'
      });
    }

    res.json({
      message: 'Store marked inactive successfully',
      store: updatedStore
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reactivate a store and trigger fresh data pulls
 * POST /stores/:storeId/activate
 */
export async function reactivateStore(req, res, next) {
  try {
    const { storeId } = req.params;

    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const stores = db.collection('stores');

    const updatedStore = await stores.findOneAndUpdate(
      { _id: new ObjectId(storeId), active: false },
      {
        $set: {
          active: true,
          deactivated_at: null,
          reactivated_at: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!updatedStore) {
      return res.status(404).json({
        error: 'Store not found or already active'
      });
    }

    setImmediate(async () => {
      try {
        console.log(`\n🚀 Triggering poll for reactivated store: ${updatedStore.store_name}`);
        const pollResult = await triggerStorePoll(storeId);
        console.log(`✓ Reactivated store poll triggered:`, pollResult);

        console.log(`📊 Triggering aggregation for reactivated store: ${updatedStore.store_name}`);
        const aggregationResult = await triggerCurrentHourAggregation();
        console.log(`✓ Reactivated store aggregation triggered:`, aggregationResult);
      } catch (error) {
        console.error(`❌ Error during reactivation tasks for store ${updatedStore.store_name}:`, error.message);
      }
    });

    res.json({
      message: 'Store reactivated successfully',
      store: updatedStore
    });
  } catch (error) {
    next(error);
  }
}

