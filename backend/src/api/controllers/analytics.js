import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * Get average price by store
 * GET /analytics/stores/:storeId/average-price
 * Query params:
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 *   - window_hours: Number of hours to group by (default: 1)
 */
export async function getStoreAveragePrice(req, res, next) {
  try {
    const { storeId } = req.params;
    const { start_date, end_date, window_hours = 1 } = req.query;

    // Validate ObjectId
    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const collection = db.collection('hourly_store_avg');

    // Build query filter
    const filter = { store_id: new ObjectId(storeId) };

    // Add date range filter
    if (start_date || end_date) {
      filter.window_start = {};
      if (start_date) {
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid start_date format' });
        }
        filter.window_start.$gte = startDate;
      }
      if (end_date) {
        const endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'Invalid end_date format' });
        }
        filter.window_start.$lte = endDate;
      }
    }

    // Get data
    let results = await collection.find(filter).sort({ window_start: 1 }).toArray();

    // Group by window_hours if specified
    const windowHoursNum = parseInt(window_hours);
    if (windowHoursNum > 1) {
      results = groupByWindowHours(results, windowHoursNum);
    }

    res.json({
      store_id: storeId,
      window_hours: windowHoursNum,
      count: results.length,
      data: results.map(r => ({
        window_start: r.window_start,
        avg_price: r.avg_price,
        product_count: r.product_count
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get average price by tag
 * GET /analytics/tags/:tag/average-price
 * Query params:
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 *   - window_hours: Number of hours to group by (default: 1)
 */
export async function getTagAveragePrice(req, res, next) {
  try {
    const { tag } = req.params;
    const { start_date, end_date, window_hours = 1 } = req.query;

    const db = getDb();
    const collection = db.collection('hourly_tag_avg');

    // Build query filter
    const filter = { tag };

    // Add date range filter
    if (start_date || end_date) {
      filter.window_start = {};
      if (start_date) {
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid start_date format' });
        }
        filter.window_start.$gte = startDate;
      }
      if (end_date) {
        const endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'Invalid end_date format' });
        }
        filter.window_start.$lte = endDate;
      }
    }

    // Get data
    let results = await collection.find(filter).sort({ window_start: 1 }).toArray();

    // Group by window_hours if specified
    const windowHoursNum = parseInt(window_hours);
    if (windowHoursNum > 1) {
      results = groupByWindowHours(results, windowHoursNum);
    }

    res.json({
      tag,
      window_hours: windowHoursNum,
      count: results.length,
      data: results.map(r => ({
        window_start: r.window_start,
        avg_price: r.avg_price,
        product_count: r.product_count
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get average price by store and tag
 * GET /analytics/stores/:storeId/tags/:tag/average-price
 * Query params:
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 *   - window_hours: Number of hours to group by (default: 1)
 */
export async function getStoreTagAveragePrice(req, res, next) {
  try {
    const { storeId, tag } = req.params;
    const { start_date, end_date, window_hours = 1 } = req.query;

    // Validate ObjectId
    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const collection = db.collection('hourly_store_tag_avg');

    // Build query filter
    const filter = {
      store_id: new ObjectId(storeId),
      tag
    };

    // Add date range filter
    if (start_date || end_date) {
      filter.window_start = {};
      if (start_date) {
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid start_date format' });
        }
        filter.window_start.$gte = startDate;
      }
      if (end_date) {
        const endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'Invalid end_date format' });
        }
        filter.window_start.$lte = endDate;
      }
    }

    // Get data
    let results = await collection.find(filter).sort({ window_start: 1 }).toArray();

    // Group by window_hours if specified
    const windowHoursNum = parseInt(window_hours);
    if (windowHoursNum > 1) {
      results = groupByWindowHours(results, windowHoursNum);
    }

    res.json({
      store_id: storeId,
      tag,
      window_hours: windowHoursNum,
      count: results.length,
      data: results.map(r => ({
        window_start: r.window_start,
        avg_price: r.avg_price,
        product_count: r.product_count
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to group results by window hours
 * @param {Array} results - Array of hourly results
 * @param {number} windowHours - Number of hours to group by
 * @returns {Array} Grouped results
 */
function groupByWindowHours(results, windowHours) {
  if (windowHours <= 1 || results.length === 0) {
    return results;
  }

  const grouped = [];
  let currentGroup = [];
  let currentWindowStart = null;

  for (const result of results) {
    const windowStart = new Date(result.window_start);
    const windowKey = Math.floor(windowStart.getTime() / (windowHours * 60 * 60 * 1000));

    if (currentWindowStart === null || currentWindowStart !== windowKey) {
      if (currentGroup.length > 0) {
        grouped.push(aggregateGroup(currentGroup));
      }
      currentGroup = [result];
      currentWindowStart = windowKey;
    } else {
      currentGroup.push(result);
    }
  }

  if (currentGroup.length > 0) {
    grouped.push(aggregateGroup(currentGroup));
  }

  return grouped;
}

/**
 * Aggregate a group of results
 * @param {Array} group - Array of results to aggregate
 * @returns {Object} Aggregated result
 */
function aggregateGroup(group) {
  const totalPrice = group.reduce((sum, item) => sum + (item.avg_price || 0), 0);
  const maxProductCount = Math.max(...group.map(item => item.product_count || 0));

  return {
    window_start: group[0].window_start,
    avg_price: totalPrice / group.length,
    product_count: maxProductCount
  };
}

