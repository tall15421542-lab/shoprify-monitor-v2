import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * Get price history for a product
 * GET /products/:productId/price-history
 * Query params:
 *   - start_date: ISO date string (optional)
 *   - end_date: ISO date string (optional)
 *   - variant_id: Filter by specific variant (optional)
 */
export async function getPriceHistory(req, res, next) {
  try {
    const { productId } = req.params;
    const { start_date, end_date, variant_id } = req.query;

    // Validate ObjectId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({
        error: 'Invalid product ID format'
      });
    }

    const db = getDb();
    const products = db.collection('products');

    // Get the product
    const product = await products.findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Parse date filters
    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid start_date format. Use ISO date string.'
      });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid end_date format. Use ISO date string.'
      });
    }

    // Extract and filter price history
    let variants = product.variants || [];

    // Filter by variant_id if provided
    if (variant_id) {
      variants = variants.filter(v => v.variant_id === variant_id);
    }

    // Apply date filtering to price history
    const variantsWithHistory = variants.map(variant => {
      let priceHistory = variant.price_history || [];

      // Filter by date range
      if (startDate || endDate) {
        priceHistory = priceHistory.filter(entry => {
          const recordedAt = new Date(entry.recorded_at);
          if (startDate && recordedAt < startDate) return false;
          if (endDate && recordedAt > endDate) return false;
          return true;
        });
      }

      return {
        variant_id: variant.variant_id,
        variant_title: variant.variant_title,
        current_price: variant.current_price,
        price_history: priceHistory.map(entry => ({
          price: entry.price,
          recorded_at: entry.recorded_at
        }))
      };
    });

    res.json({
      product_id: productId,
      product_title: product.title,
      handle: product.handle,
      variants: variantsWithHistory,
      total_variants: variantsWithHistory.length
    });
  } catch (error) {
    next(error);
  }
}

