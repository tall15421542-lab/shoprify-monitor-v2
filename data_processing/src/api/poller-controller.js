import { pollStore, pollAllStores } from '../services/poller.js';
import { getDb } from '../database/connection.js';
import { ObjectId } from 'mongodb';
import { runAggregations } from '../services/scheduler.js';

/**
 * Manually trigger polling for a specific store
 * POST /api/poll/store/:storeId
 */
export async function triggerStorePoll(req, res) {
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

    // Find the store
    const store = await stores.findOne({ _id: new ObjectId(storeId) });
    
    if (!store) {
      return res.status(404).json({
        error: 'Store not found'
      });
    }

    // Trigger polling for this store
    console.log(`\n📡 Manual poll triggered for store: ${store.store_name}`);
    const result = await pollStore(store);

    // Immediately run aggregations for the current hour window
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);

    let aggregationResults;
    try {
      aggregationResults = await runAggregations(windowStart, windowEnd);
    } catch (aggregationError) {
      console.error('Error running aggregations after store poll:', aggregationError);
      aggregationResults = {
        success: false,
        error: aggregationError.message
      };
    }

    res.json({
      message: 'Store polling completed successfully',
      store_id: storeId,
      store_name: store.store_name,
      results: {
        products_saved: result.saved,
        errors: result.errors,
        price_snapshots: result.snapshots
      },
      aggregation: aggregationResults
    });
  } catch (error) {
    console.error('Error in triggerStorePoll:', error);
    res.status(500).json({
      error: 'Failed to poll store',
      message: error.message
    });
  }
}

/**
 * Manually trigger polling for all active stores
 * POST /api/poll/all
 */
export async function triggerAllStoresPoll(req, res) {
  try {
    console.log('\n📡 Manual poll triggered for all stores');
    const results = await pollAllStores();

    // Immediately run aggregations for the current hour window
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);

    let aggregationResults;
    try {
      aggregationResults = await runAggregations(windowStart, windowEnd);
    } catch (aggregationError) {
      console.error('Error running aggregations after polling:', aggregationError);
      aggregationResults = {
        success: false,
        error: aggregationError.message
      };
    }

    res.json({
      message: 'All stores polling completed successfully',
      results: {
        total_stores: results.totalStores,
        successful_stores: results.successfulStores,
        failed_stores: results.failedStores,
        total_products: results.totalProducts
      },
      aggregation: aggregationResults
    });
  } catch (error) {
    console.error('Error in triggerAllStoresPoll:', error);
    res.status(500).json({
      error: 'Failed to poll stores',
      message: error.message
    });
  }
}

