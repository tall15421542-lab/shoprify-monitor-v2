import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close } from '../../src/database/connection.js';

describe('Store Management Endpoints', () => {
  let app;
  let server;
  const port = 3002; // Use different port for testing
  let baseUrl;

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
    // Clean up test data before each test
    const { getDb } = await import('../../src/database/connection.js');
    const db = getDb();
    await db.collection('stores').deleteMany({});
    await db.collection('products').deleteMany({});
  });

  describe('POST /stores', () => {
    it('should add a new store successfully', async () => {
      const storeData = {
        store_url: 'https://test-store.myshopify.com',
        store_name: 'Test Store',
        poll_interval: 60
      };

      const response = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const data = await response.json();

      assert.strictEqual(response.status, 201);
      assert.ok(data.message.includes('Store added successfully'));
      assert.ok(data.store._id);
      assert.strictEqual(data.store.store_url, storeData.store_url);
      assert.strictEqual(data.store.store_name, storeData.store_name);
      assert.strictEqual(data.store.active, true);
      assert.strictEqual(data.store.product_count, 0); // New stores should have 0 products
    });

    it('should return 400 if store_url is missing', async () => {
      const storeData = {
        store_name: 'Test Store'
      };

      const response = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('required'));
    });

    it('should return 400 if store_name is missing', async () => {
      const storeData = {
        store_url: 'https://test-store.myshopify.com'
      };

      const response = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('required'));
    });

    it('should accept any store_url format (validation not implemented)', async () => {
      const storeData = {
        store_url: 'https://invalid-url.com',
        store_name: 'Test Store'
      };

      const response = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const data = await response.json();

      // Currently accepts any URL (no validation implemented)
      assert.strictEqual(response.status, 201);
      assert.ok(data.message.includes('Store added successfully'));
    });

    it('should return 409 if store already exists', async () => {
      const storeData = {
        store_url: 'https://duplicate-store.myshopify.com',
        store_name: 'Duplicate Store'
      };

      // Add store first time
      await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      // Try to add same store again
      const response = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const data = await response.json();

      assert.strictEqual(response.status, 409);
      assert.ok(data.error.includes('already exists'));
    });
  });

  describe('GET /stores', () => {
    it('should return empty array when no stores exist', async () => {
      const response = await fetch(`${baseUrl}/stores`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
      assert.strictEqual(data.stores.length, 0);
    });

    it('should return all stores', async () => {
      // Add two stores
      const store1 = {
        store_url: 'https://store1.myshopify.com',
        store_name: 'Store 1'
      };
      const store2 = {
        store_url: 'https://store2.myshopify.com',
        store_name: 'Store 2'
      };

      await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store1)
      });

      await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store2)
      });

      // Get all stores
      const response = await fetch(`${baseUrl}/stores`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.stores.length, 2);
      
      // Verify stores are returned (most recent first)
      const storeUrls = data.stores.map(s => s.store_url);
      assert.ok(storeUrls.includes(store1.store_url));
      assert.ok(storeUrls.includes(store2.store_url));
      
      // Verify each store has product_count field
      data.stores.forEach(store => {
        assert.ok(store.hasOwnProperty('product_count'));
        assert.strictEqual(typeof store.product_count, 'number');
      });
    });

    it('should return correct product count when products exist', async () => {
      // Add a store
      const storeData = {
        store_url: 'https://store-with-products.myshopify.com',
        store_name: 'Store With Products'
      };

      const addResponse = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const addData = await addResponse.json();
      const storeId = addData.store._id;

      // Manually add some products to the store in the database
      const { getDb } = await import('../../src/database/connection.js');
      const { ObjectId } = await import('mongodb');
      const db = getDb();
      
      await db.collection('products').insertMany([
        {
          store_id: new ObjectId(storeId),
          product_id: 'prod1',
          title: 'Product 1',
          handle: 'product-1',
          variants: []
        },
        {
          store_id: new ObjectId(storeId),
          product_id: 'prod2',
          title: 'Product 2',
          handle: 'product-2',
          variants: []
        },
        {
          store_id: new ObjectId(storeId),
          product_id: 'prod3',
          title: 'Product 3',
          handle: 'product-3',
          variants: []
        }
      ]);

      // Get all stores and verify product count
      const response = await fetch(`${baseUrl}/stores`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 1);
      assert.strictEqual(data.stores[0].product_count, 3);
    });
  });

  describe('GET /stores/:storeId', () => {
    it('should return a single store by ID', async () => {
      // Add a store
      const storeData = {
        store_url: 'https://single-store.myshopify.com',
        store_name: 'Single Store'
      };

      const addResponse = await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      const addData = await addResponse.json();
      const storeId = addData.store._id;

      // Get the store by ID
      const response = await fetch(`${baseUrl}/stores/${storeId}`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.store);
      assert.strictEqual(data.store.store_url, storeData.store_url);
      assert.strictEqual(data.store.store_name, storeData.store_name);
      assert.ok(data.store.hasOwnProperty('product_count'));
      assert.strictEqual(typeof data.store.product_count, 'number');
    });

    it('should return 404 for non-existent store', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
      const response = await fetch(`${baseUrl}/stores/${fakeId}`);
      const data = await response.json();

      assert.strictEqual(response.status, 404);
      assert.ok(data.error.includes('not found'));
    });

    it('should return 400 for invalid store ID format', async () => {
      const response = await fetch(`${baseUrl}/stores/invalid-id`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid'));
    });
  });
});

