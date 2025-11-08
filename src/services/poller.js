import { fetchProducts } from './fetcher.js';
import { parseProduct } from './parser.js';
import { getActiveStores, updateLastPolled, upsertProduct } from '../database/operations.js';

/**
 * Poll a single store and save all products
 */
export async function pollStore(store) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Polling store: ${store.store_name} (${store.store_url})`);
  console.log('='.repeat(60));

  try {
    // Fetch all products from the store
    const products = await fetchProducts(store.store_url);

    console.log(`\nProcessing ${products.length} products...`);

    let saved = 0;
    let errors = 0;

    // Process each product
    for (const product of products) {
      try {
        const { productData, variantsData } = parseProduct(product);
        await upsertProduct(productData, variantsData, store._id.toString());
        saved++;

        if (saved % 50 === 0) {
          console.log(`  Progress: ${saved}/${products.length} products saved`);
        }
      } catch (error) {
        errors++;
        console.error(`  ✗ Error saving product ${product.id}:`, error.message);
      }
    }

    // Update last polled timestamp
    await updateLastPolled(store._id.toString());

    console.log(`\n✓ Store polling complete:`);
    console.log(`  - Saved: ${saved} products`);
    console.log(`  - Errors: ${errors} products`);

    return { saved, errors };
  } catch (error) {
    console.error(`✗ Failed to poll store ${store.store_name}:`, error.message);
    throw error;
  }
}

/**
 * Poll all active stores
 */
export async function pollAllStores() {
  console.log('\n🚀 Starting polling cycle...\n');

  const stores = await getActiveStores();

  if (stores.length === 0) {
    console.log('No active stores found.');
    return;
  }

  console.log(`Found ${stores.length} active store(s) to poll\n`);

  const results = {
    totalStores: stores.length,
    successfulStores: 0,
    failedStores: 0,
    totalProducts: 0
  };

  // Poll each store
  for (const store of stores) {
    try {
      const { saved } = await pollStore(store);
      results.successfulStores++;
      results.totalProducts += saved;
    } catch (error) {
      results.failedStores++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Polling cycle complete');
  console.log('='.repeat(60));
  console.log(`Total stores: ${results.totalStores}`);
  console.log(`Successful: ${results.successfulStores}`);
  console.log(`Failed: ${results.failedStores}`);
  console.log(`Total products saved: ${results.totalProducts}`);
  console.log('='.repeat(60));

  return results;
}
