import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

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

    res.json({
      count: productTypesAggregation.length,
      product_types: productTypesAggregation
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

    res.json({
      store_id: storeId,
      count: productTypesAggregation.length,
      product_types: productTypesAggregation
    });
  } catch (error) {
    next(error);
  }
}
