import { ObjectId } from 'mongodb';
import { getDb } from '../../database/connection.js';
import {
  createEmptySubscriptionFlags,
  getProductTypeSubscriptionFlag,
  getStoreProductTypeSubscriptionFlag,
  loadSubscriptionFlags
} from '../../services/subscription-flags.js';

/**
 * Get all unique product types across all stores
 * GET /product-types
 */
export async function getAllProductTypes(req, res, next) {
  try {
    const db = getDb();
    const products = db.collection('products');

    // Use aggregation to get all unique product types with counts
    const productTypesAggregation = await products.aggregate([
      // Filter out products without product_type
      { $match: { product_type: { $exists: true, $ne: null, $ne: '' } } },
      // Group by product_type and count occurrences
      {
        $group: {
          _id: '$product_type',
          count: { $sum: 1 }
        }
      },
      // Sort alphabetically
      { $sort: { _id: 1 } },
      // Reshape the output
      {
        $project: {
          _id: 0,
          product_type: '$_id',
          count: 1
        }
      }
    ]).toArray();

    const productTypeNames = productTypesAggregation
      .map((item) => item?.product_type)
      .filter((value) => typeof value === 'string' && value.trim() !== '');

    const subscriptionFlags = productTypeNames.length > 0
      ? await loadSubscriptionFlags({ productTypes: productTypeNames })
      : createEmptySubscriptionFlags();

    const productTypesWithMonitoring = productTypesAggregation.map((item) => {
      const productType = item?.product_type;
      const productTypeSubscribed = productType
        ? getProductTypeSubscriptionFlag(subscriptionFlags, productType)
        : false;

      return {
        ...item,
        monitoring: {
          productType: {
            subscribed: productTypeSubscribed
          }
        }
      };
    });

    res.json({
      count: productTypesWithMonitoring.length,
      product_types: productTypesWithMonitoring
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all unique product types for a specific store
 * GET /stores/:storeId/product-types
 */
export async function getStoreProductTypesHandler(req, res, next) {
  try {
    const { storeId } = req.params;
    const db = getDb();
    const products = db.collection('products');

    // Validate storeId
    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    // Use aggregation to get all unique product types for this store
    const productTypesAggregation = await products.aggregate([
      // Filter by store_id and ensure product_type exists
      {
        $match: {
          store_id: new ObjectId(storeId),
          product_type: { $exists: true, $ne: null, $ne: '' }
        }
      },
      // Group by product_type and count occurrences
      {
        $group: {
          _id: '$product_type',
          count: { $sum: 1 }
        }
      },
      // Sort alphabetically
      { $sort: { _id: 1 } },
      // Reshape the output
      {
        $project: {
          _id: 0,
          product_type: '$_id',
          count: 1
        }
      }
    ]).toArray();

    const productTypeNames = productTypesAggregation
      .map((item) => item?.product_type)
      .filter((value) => typeof value === 'string' && value.trim() !== '');

    const storeProductTypes = productTypeNames.map((productType) => ({
      storeId,
      productType
    }));

    const subscriptionFlags = productTypeNames.length > 0
      ? await loadSubscriptionFlags({
          productTypes: productTypeNames,
          storeProductTypes
        })
      : createEmptySubscriptionFlags();

    const productTypesWithMonitoring = productTypesAggregation.map((item) => {
      const productType = item?.product_type;
      const productTypeSubscribed = productType
        ? getProductTypeSubscriptionFlag(subscriptionFlags, productType)
        : false;
      const storeProductTypeSubscribed = productType
        ? getStoreProductTypeSubscriptionFlag(subscriptionFlags, storeId, productType)
        : false;

      return {
        ...item,
        monitoring: {
          productType: {
            subscribed: productTypeSubscribed
          },
          storeProductType: {
            subscribed: storeProductTypeSubscribed
          }
        }
      };
    });

    res.json({
      store_id: storeId,
      count: productTypesWithMonitoring.length,
      product_types: productTypesWithMonitoring
    });
  } catch (error) {
    next(error);
  }
}
