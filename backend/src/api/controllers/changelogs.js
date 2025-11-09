import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * Get product price changelogs
 * GET /changelogs/products
 * Query params:
 *   - store_id: Filter by store (optional)
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 */
export async function getProductChangelogs(req, res, next) {
  try {
    const { store_id, start_date, end_date } = req.query;

    const db = getDb();
    const products = db.collection('products');

    // Build query filter
    const filter = {};

    if (store_id) {
      if (!ObjectId.isValid(store_id)) {
        return res.status(400).json({ error: 'Invalid store_id format' });
      }
      filter.store_id = new ObjectId(store_id);
    }

    // Get products with price history
    const allProducts = await products.find(filter).toArray();

    // Extract price changes
    const changes = [];

    for (const product of allProducts) {
      for (const variant of product.variants || []) {
        const priceHistory = variant.price_history || [];
        
        // Calculate changes between consecutive price points
        for (let i = 1; i < priceHistory.length; i++) {
          const prev = priceHistory[i - 1];
          const curr = priceHistory[i];
          
          const changeDate = new Date(curr.recorded_at);
          
          // Apply date filters
          if (start_date) {
            const startDate = new Date(start_date);
            if (isNaN(startDate.getTime())) {
              return res.status(400).json({ error: 'Invalid start_date format' });
            }
            if (changeDate < startDate) continue;
          }
          
          if (end_date) {
            const endDate = new Date(end_date);
            if (isNaN(endDate.getTime())) {
              return res.status(400).json({ error: 'Invalid end_date format' });
            }
            if (changeDate > endDate) continue;
          }

          const priceDiff = curr.price - prev.price;
          const percentChange = prev.price !== 0 ? ((priceDiff / prev.price) * 100) : 0;

          changes.push({
            product_id: product._id,
            product_title: product.title,
            variant_id: variant.variant_id,
            variant_title: variant.variant_title,
            previous_price: prev.price,
            new_price: curr.price,
            price_change: priceDiff,
            percent_change: parseFloat(percentChange.toFixed(2)),
            changed_at: curr.recorded_at,
            store_id: product.store_id
          });
        }
      }
    }

    // Sort by change date (most recent first)
    changes.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

    res.json({
      count: changes.length,
      changes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get store average price changelogs
 * GET /changelogs/stores/average-price
 * Query params:
 *   - store_id: Filter by specific store (optional)
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 */
export async function getStoreAverageChangelogs(req, res, next) {
  try {
    const { store_id, start_date, end_date } = req.query;

    const db = getDb();
    const collection = db.collection('hourly_store_avg');

    // Build query filter
    const filter = {};

    if (store_id) {
      if (!ObjectId.isValid(store_id)) {
        return res.status(400).json({ error: 'Invalid store_id format' });
      }
      filter.store_id = new ObjectId(store_id);
    }

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

    // Get data grouped by store
    const pipeline = [
      { $match: filter },
      { $sort: { store_id: 1, window_start: 1 } }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // Calculate changes
    const changes = [];
    const storeGroups = {};

    // Group by store_id
    for (const result of results) {
      const storeIdStr = result.store_id.toString();
      if (!storeGroups[storeIdStr]) {
        storeGroups[storeIdStr] = [];
      }
      storeGroups[storeIdStr].push(result);
    }

    // Calculate changes for each store
    for (const [storeIdStr, storeData] of Object.entries(storeGroups)) {
      for (let i = 1; i < storeData.length; i++) {
        const prev = storeData[i - 1];
        const curr = storeData[i];

        const priceDiff = curr.avg_price - prev.avg_price;
        const percentChange = prev.avg_price !== 0 ? ((priceDiff / prev.avg_price) * 100) : 0;

        changes.push({
          store_id: curr.store_id,
          previous_avg_price: prev.avg_price,
          new_avg_price: curr.avg_price,
          price_change: priceDiff,
          percent_change: parseFloat(percentChange.toFixed(2)),
          previous_window: prev.window_start,
          current_window: curr.window_start,
          product_count: curr.product_count
        });
      }
    }

    // Sort by window date (most recent first)
    changes.sort((a, b) => new Date(b.current_window) - new Date(a.current_window));

    res.json({
      count: changes.length,
      changes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get tag average price changelogs
 * GET /changelogs/tags/average-price
 * Query params:
 *   - tag: Filter by specific tag (optional)
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 */
export async function getTagAverageChangelogs(req, res, next) {
  try {
    const { tag, start_date, end_date } = req.query;

    const db = getDb();
    const collection = db.collection('hourly_tag_avg');

    // Build query filter
    const filter = {};

    if (tag) {
      filter.tag = tag;
    }

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

    // Get data grouped by tag
    const pipeline = [
      { $match: filter },
      { $sort: { tag: 1, window_start: 1 } }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // Calculate changes
    const changes = [];
    const tagGroups = {};

    // Group by tag
    for (const result of results) {
      if (!tagGroups[result.tag]) {
        tagGroups[result.tag] = [];
      }
      tagGroups[result.tag].push(result);
    }

    // Calculate changes for each tag
    for (const [tagName, tagData] of Object.entries(tagGroups)) {
      for (let i = 1; i < tagData.length; i++) {
        const prev = tagData[i - 1];
        const curr = tagData[i];

        const priceDiff = curr.avg_price - prev.avg_price;
        const percentChange = prev.avg_price !== 0 ? ((priceDiff / prev.avg_price) * 100) : 0;

        changes.push({
          tag: curr.tag,
          previous_avg_price: prev.avg_price,
          new_avg_price: curr.avg_price,
          price_change: priceDiff,
          percent_change: parseFloat(percentChange.toFixed(2)),
          previous_window: prev.window_start,
          current_window: curr.window_start,
          product_count: curr.product_count
        });
      }
    }

    // Sort by window date (most recent first)
    changes.sort((a, b) => new Date(b.current_window) - new Date(a.current_window));

    res.json({
      count: changes.length,
      changes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get store-tag average price changelogs
 * GET /changelogs/stores/:storeId/tags/:tag/average-price
 * Query params:
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 */
export async function getStoreTagAverageChangelogs(req, res, next) {
  try {
    const { storeId, tag } = req.params;
    const { start_date, end_date } = req.query;

    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'Invalid store ID format' });
    }

    const db = getDb();
    const collection = db.collection('hourly_store_tag_avg');

    // Build query filter
    const filter = {
      store_id: new ObjectId(storeId),
      tag
    };

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
    const results = await collection.find(filter).sort({ window_start: 1 }).toArray();

    // Calculate changes
    const changes = [];

    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];

      const priceDiff = curr.avg_price - prev.avg_price;
      const percentChange = prev.avg_price !== 0 ? ((priceDiff / prev.avg_price) * 100) : 0;

      changes.push({
        store_id: curr.store_id,
        tag: curr.tag,
        previous_avg_price: prev.avg_price,
        new_avg_price: curr.avg_price,
        price_change: priceDiff,
        percent_change: parseFloat(percentChange.toFixed(2)),
        previous_window: prev.window_start,
        current_window: curr.window_start,
        product_count: curr.product_count
      });
    }

    // Sort by window date (most recent first)
    changes.sort((a, b) => new Date(b.current_window) - new Date(a.current_window));

    res.json({
      store_id: storeId,
      tag,
      count: changes.length,
      changes
    });
  } catch (error) {
    next(error);
  }
}

