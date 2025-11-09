import { getDb } from '../database/connection.js';
import { ObjectId } from 'mongodb';

/**
 * NOTE: Change stream functionality has been removed.
 * Price snapshots are now written directly during product upsert operations.
 * This manual transformation function is kept for backfilling/migration scenarios.
 */

/**
 * Manually transform a product to price snapshots (useful for testing)
 */
export async function transformProduct(productId, storeId) {
  const db = getDb();
  const productsCollection = db.collection('products');
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const storesCollection = db.collection('stores');

  // Get the product
  const product = await productsCollection.findOne({
    product_id: productId,
    store_id: new ObjectId(storeId)
  });

  if (!product) {
    throw new Error(`Product ${productId} not found in store ${storeId}`);
  }

  if (!product.variants || product.variants.length === 0) {
    console.log(`Product ${productId} has no variants`);
    return 0;
  }

  // Get store information
  const store = await storesCollection.findOne({ _id: product.store_id });
  
  if (!store) {
    throw new Error(`Store not found for product ${productId}`);
  }

  // Transform variants into snapshots
  const snapshots = product.variants.map(variant => ({
    timestamp: new Date(),
    metadata: {
      store_id: product.store_id,
      product_id: product.product_id,
      variant_id: variant.variant_id,
      tags: product.tags || []
    },
    store_name: store.store_name,
    price: variant.current_price
  }));

  // Insert snapshots
  await priceSnapshotsCollection.insertMany(snapshots);
  console.log(`✓ Manually created ${snapshots.length} price snapshot(s) for product ${productId}`);
  
  return snapshots.length;
}

