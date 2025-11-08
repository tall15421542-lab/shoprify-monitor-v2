import { getDb } from './connection.js';

/**
 * Initialize all database indexes
 */
export async function initializeIndexes() {
  const db = getDb();

  // Stores collection indexes
  const storesCollection = db.collection('stores');
  await storesCollection.createIndex(
    { store_url: 1 },
    { unique: true }
  );
  await storesCollection.createIndex(
    { active: 1, last_polled_at: 1 }
  );
  console.log('✓ Created indexes for stores collection');

  // Products collection indexes
  const productsCollection = db.collection('products');
  await productsCollection.createIndex(
    { product_id: 1, store_id: 1 },
    { unique: true }
  );
  await productsCollection.createIndex(
    { store_id: 1, last_polled_at: -1 }
  );
  await productsCollection.createIndex(
    { 'variants.variant_id': 1 }
  );
  await productsCollection.createIndex(
    { handle: 1, store_id: 1 }
  );
  await productsCollection.createIndex(
    { vendor: 1, store_id: 1 }
  );
  await productsCollection.createIndex(
    { product_type: 1, store_id: 1 }
  );
  console.log('✓ Created indexes for products collection');
}

/**
 * Get stores collection
 */
export function getStoresCollection() {
  return getDb().collection('stores');
}

/**
 * Get products collection
 */
export function getProductsCollection() {
  return getDb().collection('products');
}
