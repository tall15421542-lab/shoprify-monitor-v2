import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import triggerRouter from '../src/api/routes.js';
import { ObjectId } from 'mongodb';

describe('Poller Controller Tests', () => {
  let app;
  let server;
  const port = 3099; // Use unique port for testing
  let baseUrl;
  let testStoreId;

  before(async () => {
    // Connect to test database
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');
    await initializeIndexes();
    
    // Create Express app with trigger routes
    app = express();
    app.use(express.json());
    app.use('/api', triggerRouter);
    
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
    const db = getDb();
    await db.collection('stores').deleteMany({});
    await db.collection('products').deleteMany({});
    
    // Create a test store (not a real Shopify store, so polling will fail gracefully)
    const result = await db.collection('stores').insertOne({
      store_url: 'test-store.myshopify.com',
      store_name: 'Test Store for Poller',
      poll_interval: 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    });
    testStoreId = result.insertedId.toString();
  });

  describe('POST /api/poll/store/:storeId', () => {
    it('should return 400 for invalid store ID format', async () => {
      const response = await fetch(`${baseUrl}/api/poll/store/invalid-id`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.strictEqual(data.error, 'Invalid store ID format');
    });

    it('should return 404 for non-existent store', async () => {
      const fakeId = new ObjectId().toString();
      const response = await fetch(`${baseUrl}/api/poll/store/${fakeId}`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 404);
      assert.strictEqual(data.error, 'Store not found');
    });

    it('should return 500 when polling fails (invalid store URL)', async () => {
      // The test store has an invalid URL, so polling will fail
      const response = await fetch(`${baseUrl}/api/poll/store/${testStoreId}`, {
        method: 'POST'
      });

      const data = await response.json();

      // Should return error because the test store URL is not a real Shopify store
      assert.strictEqual(response.status, 500);
      assert.ok(data.error);
      assert.strictEqual(data.error, 'Failed to poll store');
    });

    it('should have correct error response structure', async () => {
      // Test store has invalid URL, so it should return error
      const response = await fetch(`${baseUrl}/api/poll/store/${testStoreId}`, {
        method: 'POST'
      });

      const data = await response.json();

      // Should have error structure
      assert.strictEqual(response.status, 500);
      assert.ok(data.error);
      assert.strictEqual(data.error, 'Failed to poll store');
      assert.ok(data.message);
    });
  });

  describe('POST /api/poll/all', () => {
    it('should complete polling all stores even with failures', async () => {
      // Even with invalid store URLs, the endpoint should respond with results
      const response = await fetch(`${baseUrl}/api/poll/all`, {
        method: 'POST'
      });

      const data = await response.json();

      // Should return 200 with results showing failures
      assert.strictEqual(response.status, 200);
      assert.ok(data.message);
      assert.ok(data.results);
      assert.strictEqual(data.results.total_stores, 1);
      assert.strictEqual(data.results.successful_stores, 0);
      assert.strictEqual(data.results.failed_stores, 1);
    });

    it('should handle case with no stores gracefully', async () => {
      // Remove all stores
      const db = getDb();
      await db.collection('stores').deleteMany({});

      const response = await fetch(`${baseUrl}/api/poll/all`, {
        method: 'POST'
      });

      const data = await response.json();

      // Should succeed with 0 stores
      assert.strictEqual(response.status, 200);
      assert.ok(data.message);
      assert.strictEqual(data.results.total_stores, 0);
    });
  });

  describe('Endpoint availability', () => {
    it('should have poll/store endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/poll/store/${testStoreId}`, {
        method: 'POST'
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });

    it('should have poll/all endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/poll/all`, {
        method: 'POST'
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });
  });
});

