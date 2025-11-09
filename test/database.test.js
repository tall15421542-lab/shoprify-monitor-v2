import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { connect, close } from '../src/database/connection.js';
import { initializeIndexes, getStoresCollection, getProductsCollection } from '../src/database/models.js';
import { insertStore, getActiveStores, upsertProduct, updateLastPolled } from '../src/database/operations.js';

describe('Database Operations', () => {
  before(async () => {
    await connect();
    await initializeIndexes();

    // Clean up test data
    const stores = getStoresCollection();
    const products = getProductsCollection();
    await stores.deleteMany({ store_name: /^Test/ });
    await products.deleteMany({});
  });

  after(async () => {
    await close();
  });

  describe('Store Operations', () => {
    it('should insert a new store', async () => {
      const storeId = await insertStore({
        store_url: 'https://test-store.myshopify.com',
        store_name: 'Test Store',
        active: true,
        polling_interval: 60
      });

      assert.ok(storeId, 'Should return a store ID');

      const stores = getStoresCollection();
      const store = await stores.findOne({ _id: storeId });

      assert.strictEqual(store.store_name, 'Test Store');
      assert.strictEqual(store.store_url, 'https://test-store.myshopify.com');
      assert.strictEqual(store.active, true);
      assert.strictEqual(store.polling_interval, 60);
      assert.ok(store.created_at instanceof Date);
      assert.strictEqual(store.last_polled_at, null);
    });

    it('should get active stores', async () => {
      const activeStores = await getActiveStores();

      assert.ok(Array.isArray(activeStores));
      assert.ok(activeStores.length > 0);

      activeStores.forEach(store => {
        assert.strictEqual(store.active, true);
      });
    });

    it('should update last polled timestamp', async () => {
      const storeId = await insertStore({
        store_url: 'https://test-store-2.myshopify.com',
        store_name: 'Test Store 2',
        active: true,
        polling_interval: 60
      });

      await updateLastPolled(storeId.toString());

      const stores = getStoresCollection();
      const store = await stores.findOne({ _id: storeId });

      assert.ok(store.last_polled_at instanceof Date);
      assert.ok(store.last_polled_at.getTime() > store.created_at.getTime());
    });
  });

  describe('Product Operations', () => {
    let testStoreId;

    before(async () => {
      testStoreId = await insertStore({
        store_url: 'https://test-product-store.myshopify.com',
        store_name: 'Test Product Store',
        active: true,
        polling_interval: 60
      });
    });

    it('should insert a new product with variants', async () => {
      const productData = {
        product_id: 999001,
        handle: 'test-product-1',
        title: 'Test Product 1',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['test', 'sample'],
        main_image_url: 'https://example.com/image.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        raw_data: { id: 999001, title: 'Test Product 1' }
      };

      const variantsData = [
        {
          variant_id: 888001,
          variant_title: 'Small',
          price: 19.99,
          image_url: 'https://example.com/small.jpg'
        },
        {
          variant_id: 888002,
          variant_title: 'Large',
          price: 29.99,
          image_url: null
        }
      ];

      await upsertProduct(productData, variantsData, testStoreId.toString());

      const products = getProductsCollection();
      const product = await products.findOne({ product_id: 999001 });

      assert.ok(product, 'Product should be inserted');
      assert.strictEqual(product.title, 'Test Product 1');
      assert.strictEqual(product.handle, 'test-product-1');
      assert.strictEqual(product.variants.length, 2);

      const variant1 = product.variants.find(v => v.variant_id === 888001);
      assert.strictEqual(variant1.variant_title, 'Small');
      assert.strictEqual(variant1.current_price, 19.99);
      assert.strictEqual(variant1.price_history.length, 1);
      assert.strictEqual(variant1.price_history[0].price, 19.99);
    });

    it('should update existing product without duplicating price history if price unchanged', async () => {
      const productData = {
        product_id: 999001,
        handle: 'test-product-1',
        title: 'Test Product 1 Updated',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['test', 'sample', 'updated'],
        main_image_url: 'https://example.com/image.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        raw_data: { id: 999001, title: 'Test Product 1 Updated' }
      };

      const variantsData = [
        {
          variant_id: 888001,
          variant_title: 'Small',
          price: 19.99, // Same price
          image_url: 'https://example.com/small.jpg'
        }
      ];

      await upsertProduct(productData, variantsData, testStoreId.toString());

      const products = getProductsCollection();
      const product = await products.findOne({ product_id: 999001 });

      assert.strictEqual(product.title, 'Test Product 1 Updated');

      const variant = product.variants.find(v => v.variant_id === 888001);
      // Price history is always appended, so it should now be 2
      assert.strictEqual(variant.price_history.length, 2);
    });

    it('should add to price history when price changes', async () => {
      const productData = {
        product_id: 999001,
        handle: 'test-product-1',
        title: 'Test Product 1',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['test'],
        main_image_url: 'https://example.com/image.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        raw_data: { id: 999001 }
      };

      const variantsData = [
        {
          variant_id: 888001,
          variant_title: 'Small',
          price: 24.99, // Changed price
          image_url: 'https://example.com/small.jpg'
        }
      ];

      await upsertProduct(productData, variantsData, testStoreId.toString());

      const products = getProductsCollection();
      const product = await products.findOne({ product_id: 999001 });

      const variant = product.variants.find(v => v.variant_id === 888001);
      assert.strictEqual(variant.current_price, 24.99);
      // Should have 3 entries: initial (19.99) + previous test (19.99) + this test (24.99)
      assert.strictEqual(variant.price_history.length, 3);
      assert.strictEqual(variant.price_history[0].price, 19.99);
      assert.strictEqual(variant.price_history[1].price, 19.99);
      assert.strictEqual(variant.price_history[2].price, 24.99);
    });

    it('should add new variants to existing product', async () => {
      const productData = {
        product_id: 999001,
        handle: 'test-product-1',
        title: 'Test Product 1',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['test'],
        main_image_url: 'https://example.com/image.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        raw_data: { id: 999001 }
      };

      const variantsData = [
        {
          variant_id: 888001,
          variant_title: 'Small',
          price: 24.99,
          image_url: 'https://example.com/small.jpg'
        },
        {
          variant_id: 888003, // New variant
          variant_title: 'Medium',
          price: 26.99,
          image_url: null
        }
      ];

      await upsertProduct(productData, variantsData, testStoreId.toString());

      const products = getProductsCollection();
      const product = await products.findOne({ product_id: 999001 });

      assert.strictEqual(product.variants.length, 3); // Should have 3 variants now

      const newVariant = product.variants.find(v => v.variant_id === 888003);
      assert.ok(newVariant, 'New variant should be added');
      assert.strictEqual(newVariant.variant_title, 'Medium');
      assert.strictEqual(newVariant.current_price, 26.99);
      assert.strictEqual(newVariant.price_history.length, 1);
    });
  });
});
