import { ObjectId } from 'mongodb';
import { getStoresCollection, getProductsCollection } from './models.js';

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
 */
export async function upsertProduct(productData, variantsData, storeId) {
  const products = getProductsCollection();
  const currentTime = new Date();

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
      store_id: new ObjectId(storeId),
      variants: []
    }
  };

  await products.updateOne(
    { product_id: productData.product_id, store_id: new ObjectId(storeId) },
    productUpdate,
    { upsert: true }
  );

  // Now handle each variant
  for (const variant of variantsData) {
    // Check if variant already exists in the product
    const existingProduct = await products.findOne({
      product_id: productData.product_id,
      store_id: new ObjectId(storeId),
      'variants.variant_id': variant.variant_id
    });

    if (existingProduct) {
      // Variant exists: update current state and append price history
      await products.updateOne(
        {
          product_id: productData.product_id,
          store_id: new ObjectId(storeId)
        },
        {
          $set: {
            'variants.$[elem].variant_title': variant.variant_title,
            'variants.$[elem].current_price': variant.price,
            'variants.$[elem].image_url': variant.image_url
          },
          $push: {
            'variants.$[elem].price_history': {
              price: variant.price,
              recorded_at: currentTime
            }
          }
        },
        {
          arrayFilters: [{ 'elem.variant_id': variant.variant_id }]
        }
      );
    } else {
      // New variant: add it to the variants array with initial price history
      await products.updateOne(
        {
          product_id: productData.product_id,
          store_id: new ObjectId(storeId)
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
        }
      );
    }
  }
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
