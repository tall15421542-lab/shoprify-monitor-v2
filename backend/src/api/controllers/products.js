import { getDb } from '../../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * Get all products for a specific store
 * GET /stores/:storeId/products
 */
export async function getStoreProducts(req, res, next) {
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
    const products = db.collection('products');

    // Check if store exists
    const store = await stores.findOne({ _id: new ObjectId(storeId) });
    if (!store) {
      return res.status(404).json({
        error: 'Store not found'
      });
    }

    // Get all products for this store
    const storeProducts = await products
      .find({ store_id: new ObjectId(storeId) })
      .sort({ last_polled_at: -1 })
      .toArray();

    res.json({
      store_id: storeId,
      store_name: store.store_name,
      count: storeProducts.length,
      products: storeProducts
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single product by ID
 * GET /products/:productId
 */
export async function getProductById(req, res, next) {
  try {
    const { productId } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({
        error: 'Invalid product ID format'
      });
    }

    const db = getDb();
    const products = db.collection('products');

    const product = await products.findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
}

