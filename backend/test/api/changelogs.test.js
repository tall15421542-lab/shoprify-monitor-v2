import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Changelog Endpoints', () => {
  let app;
  let server;
  const port = 3006;
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
    await db.collection('hourly_store_avg').deleteMany({});
    await db.collection('hourly_tag_avg').deleteMany({});
    await db.collection('hourly_store_tag_avg').deleteMany({});

    // Create a test store
    const storeResult = await db.collection('stores').insertOne({
      store_url: 'https://test-changelogs.myshopify.com',
      store_name: 'Test Changelogs Store',
      poll_interval: 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    });
    testStoreId = storeResult.insertedId;

    // Create test product with price changes
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await db.collection('products').insertOne({
      product_id: '12345',
      store_id: testStoreId,
      handle: 'test-product',
      title: 'Test Product',
      product_type: 'Test Type',
      vendor: 'Test Vendor',
      tags: ['electronics'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: twoDaysAgo,
      updated_at: now,
      last_polled_at: now,
      variants: [
        {
          variant_id: '111',
          variant_title: 'Default',
          current_price: 29.99,
          image_url: null,
          price_history: [
            { price: 19.99, recorded_at: twoDaysAgo },
            { price: 24.99, recorded_at: oneDayAgo },
            { price: 29.99, recorded_at: now }
          ]
        }
      ]
    });

    // Create test analytics data with changes
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Store averages
    await db.collection('hourly_store_avg').insertMany([
      {
        store_id: testStoreId,
        avg_price: 25.00,
        product_count: 10,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        store_id: testStoreId,
        avg_price: 27.50,
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
        avg_price: 100.00,
        product_count: 5,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        tag: 'electronics',
        avg_price: 110.00,
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
        avg_price: 90.00,
        product_count: 3,
        window_start: twoHoursAgo,
        window_end: oneHourAgo,
        created_at: twoHoursAgo
      },
      {
        store_id: testStoreId,
        tag: 'electronics',
        avg_price: 95.00,
        product_count: 4,
        window_start: oneHourAgo,
        window_end: now,
        created_at: oneHourAgo
      }
    ]);
  });

  describe('GET /changelogs/products', () => {
    it('should return product price changelogs', async () => {
      const response = await fetch(`${baseUrl}/changelogs/products`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      assert.ok(data.changes.length > 0);
      
      const change = data.changes[0];
      assert.ok(change.product_id);
      assert.ok(change.product_title);
      assert.ok(change.variant_id);
      assert.ok(change.previous_price !== undefined);
      assert.ok(change.new_price !== undefined);
      assert.ok(change.price_change !== undefined);
      assert.ok(change.percent_change !== undefined);
    });

    it('should filter by store_id', async () => {
      const response = await fetch(
        `${baseUrl}/changelogs/products?store_id=${testStoreId}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      
      // All changes should be from the test store
      for (const change of data.changes) {
        assert.strictEqual(change.store_id.toString(), testStoreId.toString());
      }
    });

    it('should filter by date range', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const now = new Date();

      const response = await fetch(
        `${baseUrl}/changelogs/products?start_date=${encodeURIComponent(oneDayAgo.toISOString())}&end_date=${encodeURIComponent(now.toISOString())}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 0);
    });

    it('should return 400 for invalid store_id', async () => {
      const response = await fetch(`${baseUrl}/changelogs/products?store_id=invalid-id`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
    });
  });

  describe('GET /changelogs/stores/average-price', () => {
    it('should return store average price changelogs', async () => {
      const response = await fetch(`${baseUrl}/changelogs/stores/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      assert.ok(data.changes.length > 0);
      
      const change = data.changes[0];
      assert.ok(change.store_id);
      assert.ok(change.previous_avg_price !== undefined);
      assert.ok(change.new_avg_price !== undefined);
      assert.ok(change.price_change !== undefined);
      assert.ok(change.percent_change !== undefined);
    });

    it('should filter by store_id', async () => {
      const response = await fetch(
        `${baseUrl}/changelogs/stores/average-price?store_id=${testStoreId}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
    });

    it('should filter by date range', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const now = new Date();

      const response = await fetch(
        `${baseUrl}/changelogs/stores/average-price?start_date=${encodeURIComponent(twoHoursAgo.toISOString())}&end_date=${encodeURIComponent(now.toISOString())}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 0);
    });
  });

  describe('GET /changelogs/tags/average-price', () => {
    it('should return tag average price changelogs', async () => {
      const response = await fetch(`${baseUrl}/changelogs/tags/average-price`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      assert.ok(data.changes.length > 0);
      
      const change = data.changes[0];
      assert.ok(change.tag);
      assert.ok(change.previous_avg_price !== undefined);
      assert.ok(change.new_avg_price !== undefined);
      assert.ok(change.price_change !== undefined);
    });

    it('should filter by tag', async () => {
      const response = await fetch(
        `${baseUrl}/changelogs/tags/average-price?tag=electronics`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      
      // All changes should be for electronics tag
      for (const change of data.changes) {
        assert.strictEqual(change.tag, 'electronics');
      }
    });
  });

  describe('GET /changelogs/stores/:storeId/tags/:tag/average-price', () => {
    it('should return store-tag average price changelogs', async () => {
      const response = await fetch(
        `${baseUrl}/changelogs/stores/${testStoreId}/tags/electronics/average-price`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count > 0);
      assert.ok(data.changes.length > 0);
      
      const change = data.changes[0];
      assert.ok(change.store_id);
      assert.strictEqual(change.tag, 'electronics');
      assert.ok(change.previous_avg_price !== undefined);
      assert.ok(change.new_avg_price !== undefined);
    });

    it('should filter by date range', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const now = new Date();

      const response = await fetch(
        `${baseUrl}/changelogs/stores/${testStoreId}/tags/electronics/average-price?start_date=${encodeURIComponent(twoHoursAgo.toISOString())}&end_date=${encodeURIComponent(now.toISOString())}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.count >= 0);
    });

    it('should return 400 for invalid store ID', async () => {
      const response = await fetch(
        `${baseUrl}/changelogs/stores/invalid-id/tags/electronics/average-price`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
    });
  });
});

