import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * Get all unique tags across all stores
 * GET /tags
 */
export async function getAllTags(req, res, next) {
  try {
    const db = getDb();
    const products = db.collection('products');

    // Use aggregation to get all unique tags with counts
    const tagsAggregation = await products.aggregate([
      // Unwind the tags array to get individual tags
      { $unwind: '$tags' },
      // Group by tag and count occurrences
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      // Sort alphabetically
      { $sort: { _id: 1 } },
      // Reshape the output
      {
        $project: {
          _id: 0,
          tag: '$_id',
          count: 1
        }
      }
    ]).toArray();

    res.json({
      count: tagsAggregation.length,
      tags: tagsAggregation
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all unique tags for a specific store
 * GET /stores/:storeId/tags
 */
export async function getStoreTagsHandler(req, res, next) {
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

    // Use aggregation to get all unique tags for this store
    const tagsAggregation = await products.aggregate([
      // Filter by store_id
      { $match: { store_id: new ObjectId(storeId) } },
      // Unwind the tags array to get individual tags
      { $unwind: '$tags' },
      // Group by tag and count occurrences
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      // Sort alphabetically
      { $sort: { _id: 1 } },
      // Reshape the output
      {
        $project: {
          _id: 0,
          tag: '$_id',
          count: 1
        }
      }
    ]).toArray();

    res.json({
      store_id: storeId,
      count: tagsAggregation.length,
      tags: tagsAggregation
    });
  } catch (error) {
    next(error);
  }
}

