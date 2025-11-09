import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Price History Endpoints', () => {
  let app;
  let server;
  const port = 3004;
  let baseUrl;
  let testStoreId;
  let testProductId;

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

    // Create a test store
    const storeResult = await db.collection('stores').insertOne({
      store_url: 'https://test-history.myshopify.com',
      store_name: 'Test History Store',
      poll_interval: 60,
      active: true,
      created_at: new Date(),
      last_polled_at: null
    });
    testStoreId = storeResult.insertedId;

    // Create a test product with price history
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const productResult = await db.collection('products').insertOne({
      product_id: '12345',
      store_id: testStoreId,
      handle: 'test-product',
      title: 'Test Product',
      product_type: 'Test Type',
      vendor: 'Test Vendor',
      tags: ['tag1'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: twoDaysAgo,
      updated_at: now,
      last_polled_at: now,
      variants: [
        {
          variant_id: '111',
          variant_title: 'Small',
          current_price: 29.99,
          image_url: null,
          price_history: [
            { price: 19.99, recorded_at: twoDaysAgo },
            { price: 24.99, recorded_at: oneDayAgo },
            { price: 29.99, recorded_at: now }
          ]
        },
        {
          variant_id: '222',
          variant_title: 'Large',
          current_price: 39.99,
          image_url: null,
          price_history: [
            { price: 34.99, recorded_at: twoDaysAgo },
            { price: 39.99, recorded_at: now }
          ]
        }
      ]
    });
    testProductId = productResult.insertedId;
  });

  describe('GET /products/:productId/price-history', () => {
    it('should return full price history for all variants', async () => {
      const response = await fetch(`${baseUrl}/products/${testProductId}/price-history`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.product_title, 'Test Product');
      assert.strictEqual(data.total_variants, 2);
      assert.strictEqual(data.variants.length, 2);
      
      // Check first variant
      const variant1 = data.variants.find(v => v.variant_id === '111');
      assert.ok(variant1);
      assert.strictEqual(variant1.variant_title, 'Small');
      assert.strictEqual(variant1.current_price, 29.99);
      assert.strictEqual(variant1.price_history.length, 3);
      
      // Check second variant
      const variant2 = data.variants.find(v => v.variant_id === '222');
      assert.ok(variant2);
      assert.strictEqual(variant2.variant_title, 'Large');
      assert.strictEqual(variant2.price_history.length, 2);
    });

    it('should filter price history by start_date', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const startDate = oneDayAgo.toISOString();
      
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?start_date=${encodeURIComponent(startDate)}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      const variant1 = data.variants.find(v => v.variant_id === '111');
      // Should have fewer entries than the original 3
      assert.ok(variant1.price_history.length < 3);
      assert.ok(variant1.price_history.length >= 1);
    });

    it('should filter price history by end_date', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = oneDayAgo.toISOString();
      
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?end_date=${encodeURIComponent(endDate)}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      const variant1 = data.variants.find(v => v.variant_id === '111');
      // Should exclude the most recent entry
      assert.ok(variant1.price_history.length >= 1);
      assert.ok(variant1.price_history.length <= 2);
    });

    it('should filter price history by date range', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const startDate = twoDaysAgo.toISOString();
      const endDate = oneDayAgo.toISOString();
      
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      const variant1 = data.variants.find(v => v.variant_id === '111');
      // Should only include entries within range
      assert.ok(variant1.price_history.length >= 1);
      assert.ok(variant1.price_history.length <= 2);
    });

    it('should filter by variant_id', async () => {
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?variant_id=111`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.variants.length, 1);
      assert.strictEqual(data.variants[0].variant_id, '111');
      assert.strictEqual(data.variants[0].price_history.length, 3);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await fetch(`${baseUrl}/products/${fakeId}/price-history`);
      const data = await response.json();

      assert.strictEqual(response.status, 404);
      assert.ok(data.error.includes('not found'));
    });

    it('should return 400 for invalid product ID format', async () => {
      const response = await fetch(`${baseUrl}/products/invalid-id/price-history`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid'));
    });

    it('should return 400 for invalid start_date format', async () => {
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?start_date=invalid-date`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid start_date'));
    });

    it('should return 400 for invalid end_date format', async () => {
      const response = await fetch(
        `${baseUrl}/products/${testProductId}/price-history?end_date=invalid-date`
      );
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid end_date'));
    });
  });
});

