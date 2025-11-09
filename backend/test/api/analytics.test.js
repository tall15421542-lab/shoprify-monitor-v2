import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Analytics Endpoints', () => {
  let app;
  let server;
  const port = 3005;
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
    await db.collection('hourly_store_avg').deleteMany({});
    await db.collection('hourly_tag_avg').deleteMany({});
    await db.collection('hourly_store_tag_avg').deleteMany({});

    // Create a test store
    const storeResult = await db.collection('stores').insertOne({
      store_url: 'https://test-analytics.myshopify.com',
      store_name: 'Test Analytics Store',
      poll_interval: 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    });
    testStoreId = storeResult.insertedId;

    // Create test analytics data
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Store averages
    await db.collection('hourly_store_avg').insertMany([
      {
        store_id: testStoreId,
        avg_price: 25.99,
        product_count: 10,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        store_id: testStoreId,
        avg_price: 27.99,
        product_count: 12,
        window_start: oneHourAgo,
        window_end: now,
        created_at: oneHourAgo
      }
    ]);

    // Tag averages
    await db.collection('hourly_tag_avg').insertMany([
      {
        tag: 'electronics',
        avg_price: 99.99,
        product_count: 5,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        tag: 'electronics',
        avg_price: 104.99,
        product_count: 6,
        window_start: oneHourAgo,
        window_end: now,
        created_at: oneHourAgo
      }
    ]);

    // Store-tag averages
    await db.collection('hourly_store_tag_avg').insertMany([
      {
        store_id: testStoreId,
        tag: 'electronics',
        avg_price: 89.99,
        product_count: 3,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        store_id: testStoreId,
        tag: 'electronics',
        avg_price: 94.99,
        product_count: 4,
        window_start: oneHourAgo,
        window_end: now,
        created_at: oneHourAgo
      }
    ]);
  });

  describe('GET /analytics/stores/:storeId/average-price', () => {
    it('should return average prices for a store', async () => {
      const response = await fetch(`${baseUrl}/analytics/stores/${testStoreId}/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, testStoreId.toString());
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.data.length, 2);
      assert.strictEqual(data.data[0].avg_price, 25.99);
      assert.strictEqual(data.data[1].avg_price, 27.99);
    });

    it('should filter by start_date', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const startDate = twoHoursAgo.toISOString();

      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/average-price?start_date=${encodeURIComponent(startDate)}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      // Should return data since start_date is before or at our test data
      assert.ok(data.count >= 1);
    });

    it('should filter by end_date', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = oneHourAgo.toISOString();

      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/average-price?end_date=${encodeURIComponent(endDate)}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 1);
    });

    it('should group by window_hours', async () => {
      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/average-price?window_hours=2`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.window_hours, 2);
      // Should group the 2 hourly results into 1
      assert.ok(data.count >= 1);
    });

    it('should return empty array for non-existent store', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await fetch(`${baseUrl}/analytics/stores/${fakeId}/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
    });

    it('should return 400 for invalid store ID', async () => {
      const response = await fetch(`${baseUrl}/analytics/stores/invalid-id/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
    });
  });

  describe('GET /analytics/tags/:tag/average-price', () => {
    it('should return average prices for a tag', async () => {
      const response = await fetch(`${baseUrl}/analytics/tags/electronics/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.tag, 'electronics');
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.data.length, 2);
      assert.strictEqual(data.data[0].avg_price, 99.99);
      assert.strictEqual(data.data[1].avg_price, 104.99);
    });

    it('should filter by date range', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const response = await fetch(
        `${baseUrl}/analytics/tags/electronics/average-price?start_date=${encodeURIComponent(twoHoursAgo.toISOString())}&end_date=${encodeURIComponent(oneHourAgo.toISOString())}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 1);
    });

    it('should return empty array for non-existent tag', async () => {
      const response = await fetch(`${baseUrl}/analytics/tags/nonexistent/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
    });
  });

  describe('GET /analytics/stores/:storeId/tags/:tag/average-price', () => {
    it('should return average prices for store and tag', async () => {
      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/tags/electronics/average-price`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, testStoreId.toString());
      assert.strictEqual(data.tag, 'electronics');
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.data.length, 2);
      assert.strictEqual(data.data[0].avg_price, 89.99);
      assert.strictEqual(data.data[1].avg_price, 94.99);
    });

    it('should filter by date range', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/tags/electronics/average-price?start_date=${encodeURIComponent(twoHoursAgo.toISOString())}&end_date=${encodeURIComponent(oneHourAgo.toISOString())}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 1);
    });

    it('should group by window_hours', async () => {
      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/tags/electronics/average-price?window_hours=2`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.window_hours, 2);
    });

    it('should return empty array for non-existent combination', async () => {
      const response = await fetch(
        `${baseUrl}/analytics/stores/${testStoreId}/tags/nonexistent/average-price`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
    });

    it('should return 400 for invalid store ID', async () => {
      const response = await fetch(
        `${baseUrl}/analytics/stores/invalid-id/tags/electronics/average-price`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
    });
  });
});

