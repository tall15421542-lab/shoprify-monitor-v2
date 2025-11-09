import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { connect, close } from '../src/database/connection.js';
import { initializeIndexes, getStoresCollection, getProductsCollection } from '../src/database/models.js';
import { insertStore } from '../src/database/operations.js';
import { pollStore, pollAllStores } from '../src/services/poller.js';

describe('Poller', () => {
  let testStoreId;

  before(async () => {
    await connect();
    await initializeIndexes();

    // Clean up any existing test stores with the same URL
    const stores = getStoresCollection();
    const products = getProductsCollection();

    // Find and delete existing store with this URL
    const existingStore = await stores.findOne({ store_url: 'https://mous.co' });
    if (existingStore) {
      await products.deleteMany({ store_id: existingStore._id });
      await stores.deleteOne({ _id: existingStore._id });
    }

    // Create a test store
    testStoreId = await insertStore({
      store_url: 'https://mous.co',
      store_name: 'Test Poller Store',
      active: true,
      polling_interval: 60
    });
  });

  after(async () => {
    // Clean up
    const stores = getStoresCollection();
    const products = getProductsCollection();
    await stores.deleteOne({ _id: testStoreId });
    await products.deleteMany({ store_id: testStoreId });
    await close();
  });

  describe('pollStore', () => {
    it('should poll a store and save products', async () => {
      const stores = getStoresCollection();
      const store = await stores.findOne({ _id: testStoreId });

      const result = await pollStore(store);

      assert.ok(result.saved > 0, 'Should save at least one product');
      assert.strictEqual(result.errors, 0, 'Should have no errors');

      // Verify products were saved
      const products = getProductsCollection();
      const productCount = await products.countDocuments({ store_id: testStoreId });

      assert.ok(productCount > 0, 'Products should be saved to database');
      assert.strictEqual(productCount, result.saved, 'Saved count should match database count');

      // Verify a sample product has correct structure
      const sampleProduct = await products.findOne({ store_id: testStoreId });

      assert.ok(sampleProduct.product_id, 'Product should have product_id');
      assert.ok(sampleProduct.title, 'Product should have title');
      assert.ok(sampleProduct.handle, 'Product should have handle');
      assert.ok(Array.isArray(sampleProduct.variants), 'Product should have variants array');
      assert.ok(sampleProduct.variants.length > 0, 'Product should have at least one variant');

      const variant = sampleProduct.variants[0];
      assert.ok(variant.variant_id, 'Variant should have variant_id');
      assert.ok(typeof variant.current_price === 'number', 'Variant should have numeric price');
      assert.ok(Array.isArray(variant.price_history), 'Variant should have price_history array');
      assert.ok(variant.price_history.length > 0, 'Variant should have at least one price history entry');

      // Verify store was updated
      const updatedStore = await stores.findOne({ _id: testStoreId });
      assert.ok(updatedStore.last_polled_at instanceof Date, 'Store should have last_polled_at timestamp');
    });
  });

  describe('pollAllStores', () => {
    it('should poll all active stores', async () => {
      const result = await pollAllStores();

      assert.ok(result.totalStores > 0, 'Should find at least one store');
      assert.ok(result.successfulStores > 0, 'Should successfully poll at least one store');
      assert.ok(result.totalProducts > 0, 'Should save at least one product');

      // Note: We don't assert failedStores === 0 because there may be other
      // test stores in the database with invalid URLs
    });
  });
});
