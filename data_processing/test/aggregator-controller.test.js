import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import { createPriceSnapshotsCollection, dropPriceSnapshotsCollection } from '../src/database/analytics-schema.js';
import triggerRouter from '../src/api/routes.js';
import { ObjectId } from 'mongodb';

describe('Aggregator Controller Tests', () => {
  let app;
  let server;
  const port = 3098; // Use unique port for testing
  let baseUrl;

  before(async () => {
    // Connect to test database
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');
    await initializeIndexes();
    
    // Ensure analytics collections exist
    await dropPriceSnapshotsCollection();
    await createPriceSnapshotsCollection();
    
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
    await db.collection('price_snapshots').deleteMany({});
    await db.collection('hourly_store_avg').deleteMany({});
    await db.collection('hourly_tag_avg').deleteMany({});
    await db.collection('hourly_store_tag_avg').deleteMany({});
    await db.collection('hourly_product_type_avg').deleteMany({});
    await db.collection('hourly_store_product_type_avg').deleteMany({});
  });

  describe('POST /api/aggregate/current', () => {
    it('should successfully trigger current hour aggregation', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.message, 'Current hour aggregation completed successfully');
      assert.ok(data.window);
      assert.ok(data.window.start);
      assert.ok(data.window.end);
      assert.ok(data.results);
      assert.ok(typeof data.results.store_averages === 'number');
      assert.ok(typeof data.results.tag_averages === 'number');
      assert.ok(typeof data.results.store_tag_averages === 'number');
      assert.ok(typeof data.results.product_type_averages === 'number');
      assert.ok(typeof data.results.store_product_type_averages === 'number');
    });

    it('should return valid time window for current hour', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // Verify window is for current hour
      const windowStart = new Date(data.window.start);
      const windowEnd = new Date(data.window.end);
      
      // Window should be exactly 1 hour
      const diff = windowEnd - windowStart;
      assert.strictEqual(diff, 60 * 60 * 1000); // 1 hour in milliseconds
      
      // Start should be at the beginning of an hour
      assert.strictEqual(windowStart.getMinutes(), 0);
      assert.strictEqual(windowStart.getSeconds(), 0);
    });

    it('should handle empty data gracefully', async () => {
      // No price snapshots exist, so aggregation should return 0 for all
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.results.store_averages, 0);
      assert.strictEqual(data.results.tag_averages, 0);
      assert.strictEqual(data.results.store_tag_averages, 0);
      assert.strictEqual(data.results.product_type_averages, 0);
      assert.strictEqual(data.results.store_product_type_averages, 0);
    });
  });

  describe('POST /api/aggregate', () => {
    it('should successfully trigger aggregation with custom window', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 2, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setHours(windowEnd.getHours() + 1);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.message, 'Aggregation completed successfully');
      assert.ok(data.window);
      assert.strictEqual(data.window.start, windowStart.toISOString());
      assert.strictEqual(data.window.end, windowEnd.toISOString());
      assert.ok(data.results);
    });

    it('should return 400 for invalid windowStart format', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: 'invalid-date'
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid windowStart'));
    });

    it('should return 400 for invalid windowEnd format', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 1, 0, 0, 0);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString(),
          windowEnd: 'invalid-date'
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid windowEnd'));
    });

    it('should use default windowEnd if not provided', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 1, 0, 0, 0);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // Verify windowEnd is 1 hour after windowStart
      const start = new Date(data.window.start);
      const end = new Date(data.window.end);
      const diff = end - start;
      assert.strictEqual(diff, 60 * 60 * 1000); // 1 hour
    });

    it('should use default windowStart (current hour) if not provided', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // Should default to current hour
      const windowStart = new Date(data.window.start);
      assert.strictEqual(windowStart.getMinutes(), 0);
      assert.strictEqual(windowStart.getSeconds(), 0);
    });
  });

  describe('Aggregation with test data', () => {
    it('should aggregate price snapshots correctly', async () => {
      const db = getDb();
      const storeId = new ObjectId();
      const productId = 12345;
      const variantId = 67890;
      
      // Insert test price snapshots
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 1, 0, 0, 0);
      
      await db.collection('price_snapshots').insertMany([
        {
          timestamp: new Date(windowStart.getTime() + 10 * 60 * 1000), // 10 min after start
          metadata: {
            store_id: storeId,
            product_id: productId,
            variant_id: variantId,
            tags: ['test-tag'],
            product_type: 'Test Type'
          },
          store_name: 'Test Store',
          price: 100.00
        },
        {
          timestamp: new Date(windowStart.getTime() + 20 * 60 * 1000), // 20 min after start
          metadata: {
            store_id: storeId,
            product_id: productId,
            variant_id: variantId + 1,
            tags: ['test-tag'],
            product_type: 'Test Type'
          },
          store_name: 'Test Store',
          price: 200.00
        }
      ]);

      const windowEnd = new Date(windowStart);
      windowEnd.setHours(windowEnd.getHours() + 1);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.results.store_averages, 1); // 1 store
      assert.strictEqual(data.results.tag_averages, 1); // 1 tag
      assert.strictEqual(data.results.store_tag_averages, 1); // 1 store-tag combo
      assert.strictEqual(data.results.product_type_averages, 1); // 1 product type
      assert.strictEqual(data.results.store_product_type_averages, 1); // 1 store-product_type combo
    });
  });

  describe('Endpoint availability', () => {
    it('should have aggregate endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });

    it('should have aggregate/current endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });
  });
});

