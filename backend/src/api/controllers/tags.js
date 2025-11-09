import { getDb } from '../../database/connection.js';

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

