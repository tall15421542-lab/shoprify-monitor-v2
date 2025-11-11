import { ObjectId } from 'mongodb';
import { getStoresCollection, getProductsCollection, getPriceSnapshotsCollection } from './models.js';
import { getClient } from './connection.js';

/**
 * Create a price snapshot document
 * @param {Object} productData - Product data
 * @param {Object} variant - Variant data
 * @param {ObjectId} storeId - Store ID
 * @param {string} storeName - Store name (denormalized for analytics)
 * @param {Array} tags - Product tags
 * @param {Date} timestamp - Timestamp for the snapshot
 * @returns {Object} Price snapshot document
 */
function createPriceSnapshot(productData, variant, storeId, storeName, tags, timestamp) {
  return {
    timestamp: timestamp,
    metadata: {
      store_id: storeId,
      product_id: productData.product_id,
      variant_id: variant.variant_id,
      product_type: productData.product_type || null,
      tags: tags || []
    },
    store_name: storeName,
    price: variant.price
  };
}

/**
 * Get all active stores that need to be polled
 */
export async function getActiveStores() {
  const stores = getStoresCollection();
  return await stores.find({ active: true }).toArray();
}

/**
 * Update last polled timestamp for a store
 */
export async function updateLastPolled(storeId) {
  const stores = getStoresCollection();
  await stores.updateOne(
    { _id: new ObjectId(storeId) },
    { $set: { last_polled_at: new Date() } }
  );
}

/**
 * Save or update product with embedded variants and price history
 * Also writes price snapshots for analytics
 * Uses MongoDB transactions for product data (critical), snapshots written separately (best-effort)
 * Note: Time-series collections cannot be used in transactions per MongoDB limitation
 * @param {Object} productData - Product data
 * @param {Array} variantsData - Array of variant data
 * @param {string} storeId - Store ID
 * @param {string} storeName - Store name (for denormalized analytics data)
 */
export async function upsertProduct(productData, variantsData, storeId, storeName) {
  const client = getClient();
  const products = getProductsCollection();
  const priceSnapshots = getPriceSnapshotsCollection();
  const currentTime = new Date();
  const storeObjectId = new ObjectId(storeId);

  // Collect price snapshots during product update
  const snapshots = [];

  // Start a session for transaction (product data only)
  const session = client.startSession();

  try {
    // Execute product operations within a transaction for atomicity
    await session.withTransaction(async () => {
      // First, upsert the base product document
      const productUpdate = {
        $set: {
          handle: productData.handle,
          title: productData.title,
          product_type: productData.product_type,
          vendor: productData.vendor,
          tags: productData.tags,
          main_image_url: productData.main_image_url,
          created_at: productData.created_at,
          updated_at: productData.updated_at,
          last_polled_at: currentTime,
          raw_data: productData.raw_data
        },
        $setOnInsert: {
          product_id: productData.product_id,
          store_id: storeObjectId,
          variants: []
        }
      };

      await products.updateOne(
        { product_id: productData.product_id, store_id: storeObjectId },
        productUpdate,
        { upsert: true, session }
      );

      // Now handle each variant
      for (const variant of variantsData) {
        // Check if variant already exists in the product
        const existingProduct = await products.findOne({
          product_id: productData.product_id,
          store_id: storeObjectId,
          'variants.variant_id': variant.variant_id
        }, { session });

        if (existingProduct) {
          // Variant exists: update current state and append price history
          await products.updateOne(
            {
              product_id: productData.product_id,
              store_id: storeObjectId
            },
            {
              $set: {
                'variants.$[elem].variant_title': variant.variant_title,
                'variants.$[elem].current_price': variant.price,
                'variants.$[elem].image_url': variant.image_url
              },
              $push: {
                'variants.$[elem].price_history': {
                  $each: [{
                    price: variant.price,
                    recorded_at: currentTime
                  }],
                  $slice: -1000  // Keep only last 1000 price points to prevent unbounded growth
                }
              }
            },
            {
              arrayFilters: [{ 'elem.variant_id': variant.variant_id }],
              session
            }
          );
        } else {
          // New variant: add it to the variants array with initial price history
          await products.updateOne(
            {
              product_id: productData.product_id,
              store_id: storeObjectId
            },
            {
              $push: {
                variants: {
                  variant_id: variant.variant_id,
                  variant_title: variant.variant_title,
                  current_price: variant.price,
                  image_url: variant.image_url,
                  price_history: [
                    {
                      price: variant.price,
                      recorded_at: currentTime
                    }
                  ]
                }
              }
            },
            { session }
          );
        }

        // Prepare price snapshot for this variant
        const snapshot = createPriceSnapshot(
          productData,
          variant,
          storeObjectId,
          storeName,
          productData.tags,
          currentTime
        );
        snapshots.push(snapshot);
      }
    }, {
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary'
    });
  } finally {
    // Always end the session
    await session.endSession();
  }

  // Write analytics snapshots OUTSIDE transaction
  // Time-series collections cannot be used in transactions (MongoDB limitation)
  // This is best-effort: if it fails, product data is already committed
  if (snapshots.length > 0) {
    try {
      await priceSnapshots.insertMany(snapshots);
    } catch (error) {
      // Log but don't fail - analytics gaps are tolerable, product data corruption is not
      console.error('Failed to insert price snapshots (analytics):', error.message);
    }
  }

  return snapshots.length; // Return number of snapshots created
}

/**
 * Insert a new store
 */
export async function insertStore(storeData) {
  const stores = getStoresCollection();
  const result = await stores.insertOne({
    ...storeData,
    created_at: new Date(),
    last_polled_at: null
  });
  return result.insertedId;
}
