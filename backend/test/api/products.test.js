import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Products Endpoints', () => {
  let app;
  let server;
  const port = 3003;
  let baseUrl;
  let testStoreId;

  before(async () => {
    // Connect to test database
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');
    
    app = createApp();
    server = app.listen(port);
    baseUrl = `http://localhost:${port}`;
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await close();
  });

  beforeEach(async () => {
    // Clean up test data
    const db = getDb();
    await db.collection('stores').deleteMany({});
    await db.collection('products').deleteMany({});
    await db.collection('subscriptions').deleteMany({});

    // Create a test store
    const result = await db.collection('stores').insertOne({
      store_url: 'https://test-products.myshopify.com',
      store_name: 'Test Products Store',
      poll_interval: 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    });
    testStoreId = result.insertedId;
  });

  describe('GET /stores/:storeId/products', () => {
    it('should return empty array when store has no products', async () => {
      const response = await fetch(`${baseUrl}/stores/${testStoreId}/products`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
      assert.strictEqual(data.products.length, 0);
      assert.strictEqual(data.store_id, testStoreId.toString());
    });

    it('should return all products for a store', async () => {
      const db = getDb();
      
      // Add test products
      const product1 = {
        product_id: '12345',
        store_id: testStoreId,
        handle: 'test-product-1',
        title: 'Test Product 1',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['tag1', 'tag2'],
        main_image_url: 'https://example.com/image1.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        last_polled_at: new Date(),
        variants: [
          {
            variant_id: '111',
            variant_title: 'Small',
            current_price: 19.99,
            image_url: null,
            price_history: [
              { price: 19.99, recorded_at: new Date() }
            ]
          }
        ]
      };

      const product2 = {
        product_id: '67890',
        store_id: testStoreId,
        handle: 'test-product-2',
        title: 'Test Product 2',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['tag3'],
        main_image_url: 'https://example.com/image2.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        last_polled_at: new Date(),
        variants: [
          {
            variant_id: '222',
            variant_title: 'Medium',
            current_price: 29.99,
            image_url: null,
            price_history: [
              { price: 29.99, recorded_at: new Date() }
            ]
          }
        ]
      };

      await db.collection('products').insertMany([product1, product2]);

      // Get products
      const response = await fetch(`${baseUrl}/stores/${testStoreId}/products`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.products.length, 2);
      assert.strictEqual(data.store_name, 'Test Products Store');
      
      // Verify product data
      const titles = data.products.map(p => p.title);
      assert.ok(titles.includes('Test Product 1'));
      assert.ok(titles.includes('Test Product 2'));
    });

    it('should return 404 for non-existent store', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await fetch(`${baseUrl}/stores/${fakeId}/products`);
      const data = await response.json();

      assert.strictEqual(response.status, 404);
      assert.ok(data.error.includes('not found'));
    });

    it('should return 400 for invalid store ID format', async () => {
      const response = await fetch(`${baseUrl}/stores/invalid-id/products`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid'));
    });

    it('should include monitoring flags for store products', async () => {
      const db = getDb();
      const storeIdString = testStoreId.toString();

      const insertResult = await db.collection('products').insertMany([
          {
            product_id: 'subscribed-product',
            store_id: testStoreId,
            handle: 'subscribed-product',
            title: 'Subscribed Product',
            product_type: 'Tracked Type',
            vendor: 'Vendor',
            tags: [],
            main_image_url: 'https://example.com/1.jpg',
            created_at: new Date(),
            updated_at: new Date(),
            last_polled_at: new Date(),
            variants: []
          },
          {
            product_id: 'plain-product',
            store_id: testStoreId,
            handle: 'plain-product',
            title: 'Plain Product',
            vendor: 'Vendor',
            tags: [],
            main_image_url: 'https://example.com/2.jpg',
            created_at: new Date(),
            updated_at: new Date(),
            last_polled_at: new Date(),
            variants: []
          }
        ]);

      const productWithTypeId = insertResult.insertedIds[0];
      const productWithoutTypeId = insertResult.insertedIds[1];

      await db.collection('subscriptions').insertMany([
        {
          scope_type: 'store',
          scope_key: { store_id: storeIdString },
          scope_hash: `store:${storeIdString}`,
          change_type: 'both',
          interval_minutes: 60,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'product',
          scope_key: { store_id: storeIdString, product_id: productWithTypeId.toString() },
          scope_hash: `product:${storeIdString}:${productWithTypeId.toString()}`,
          change_type: 'price_up',
          interval_minutes: 30,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'product_type',
          scope_key: { product_type: 'Tracked Type' },
          scope_hash: 'product_type:Tracked Type',
          change_type: 'both',
          interval_minutes: 45,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'store_product_type',
          scope_key: { store_id: storeIdString, product_type: 'Tracked Type' },
          scope_hash: `store_product_type:${storeIdString}:Tracked Type`,
          change_type: 'both',
          interval_minutes: 45,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${testStoreId}/products`);
      const data = await response.json();

      const subscribedProduct = data.products.find(
        (product) => product._id === productWithTypeId.toString()
      );
      assert.ok(subscribedProduct);
      assert.ok(subscribedProduct.monitoring);
      assert.strictEqual(subscribedProduct.monitoring.store.subscribed, true);
      assert.strictEqual(subscribedProduct.monitoring.product.subscribed, true);
      assert.strictEqual(subscribedProduct.monitoring.productType.subscribed, true);
      assert.strictEqual(subscribedProduct.monitoring.storeProductType.subscribed, true);

      const plainProduct = data.products.find(
        (product) => product._id === productWithoutTypeId.toString()
      );
      assert.ok(plainProduct);
      assert.ok(plainProduct.monitoring);
      assert.strictEqual(plainProduct.monitoring.store.subscribed, true);
      assert.strictEqual(plainProduct.monitoring.product.subscribed, false);
      assert.strictEqual(plainProduct.monitoring.productType.subscribed, false);
      assert.strictEqual(plainProduct.monitoring.storeProductType.subscribed, false);
    });
  });

  describe('GET /products/:productId', () => {
    it('should return a single product by ID', async () => {
      const db = getDb();
      
      // Add a test product
      const product = {
        product_id: '12345',
        store_id: testStoreId,
        handle: 'single-product',
        title: 'Single Product',
        product_type: 'Test Type',
        vendor: 'Test Vendor',
        tags: ['tag1'],
        main_image_url: 'https://example.com/image.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        last_polled_at: new Date(),
        variants: [
          {
            variant_id: '111',
            variant_title: 'Default',
            current_price: 19.99,
            image_url: null,
            price_history: [
              { price: 19.99, recorded_at: new Date() }
            ]
          }
        ]
      };

      const result = await db.collection('products').insertOne(product);
      const productId = result.insertedId;

      // Get the product
      const response = await fetch(`${baseUrl}/products/${productId}`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.product);
      assert.strictEqual(data.product.title, 'Single Product');
      assert.strictEqual(data.product.variants.length, 1);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await fetch(`${baseUrl}/products/${fakeId}`);
      const data = await response.json();

      assert.strictEqual(response.status, 404);
      assert.ok(data.error.includes('not found'));
    });

    it('should return 400 for invalid product ID format', async () => {
      const response = await fetch(`${baseUrl}/products/invalid-id`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid'));
    });

    it('should include monitoring flags for individual product', async () => {
      const db = getDb();
      const storeIdString = testStoreId.toString();

      const { insertedId: productId } = await db.collection('products').insertOne({
        product_id: 'single-subscribed',
        store_id: testStoreId,
        handle: 'single-subscribed',
        title: 'Single Subscribed Product',
        product_type: 'Watched Type',
        vendor: 'Vendor',
        tags: [],
        main_image_url: 'https://example.com/product.jpg',
        created_at: new Date(),
        updated_at: new Date(),
        last_polled_at: new Date(),
        variants: []
      });

      await db.collection('subscriptions').insertMany([
        {
          scope_type: 'store',
          scope_key: { store_id: storeIdString },
          scope_hash: `store:${storeIdString}`,
          change_type: 'both',
          interval_minutes: 60,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'product',
          scope_key: { store_id: storeIdString, product_id: productId.toString() },
          scope_hash: `product:${storeIdString}:${productId.toString()}`,
          change_type: 'both',
          interval_minutes: 60,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'product_type',
          scope_key: { product_type: 'Watched Type' },
          scope_hash: 'product_type:Watched Type',
          change_type: 'price_down',
          interval_minutes: 120,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const response = await fetch(`${baseUrl}/products/${productId.toString()}`);
      const data = await response.json();

      assert.ok(data.product.monitoring);
      assert.strictEqual(data.product.monitoring.store.subscribed, true);
      assert.strictEqual(data.product.monitoring.product.subscribed, true);
      assert.strictEqual(data.product.monitoring.productType.subscribed, true);
      assert.strictEqual(data.product.monitoring.storeProductType.subscribed, false);
    });
  });
});

