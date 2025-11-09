import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';
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

    res.json({
      count: allStores.length,
      stores: allStores
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

    res.json({ store: storeArray[0] });
  } catch (error) {
    next(error);
  }
}

