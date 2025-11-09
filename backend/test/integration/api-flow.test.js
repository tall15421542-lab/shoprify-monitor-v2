import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';

describe('API Integration Flow', () => {
  let app;
  let server;
  const port = 3010;
  let baseUrl;

  before(async () => {
    // Connect to test database
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');
    
    // Clean up before starting
    const db = getDb();
    await db.collection('stores').deleteMany({});
    await db.collection('products').deleteMany({});
    await db.collection('hourly_store_avg').deleteMany({});
    await db.collection('hourly_tag_avg').deleteMany({});
    await db.collection('hourly_store_tag_avg').deleteMany({});
    
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

  it('should complete full API flow from store creation to analytics', async () => {
    // 1. Add a store
    console.log('\n  1. Adding store...');
    const storeData = {
      store_url: 'https://integration-test.myshopify.com',
      store_name: 'Integration Test Store',
      poll_interval: 60
    };

    const addStoreResponse = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    });

    const addStoreData = await addStoreResponse.json();
    assert.strictEqual(addStoreResponse.status, 201);
    assert.ok(addStoreData.store._id);
    const storeId = addStoreData.store._id;
    console.log(`     ✓ Store created with ID: ${storeId}`);

    // 2. Verify store can be retrieved
    console.log('\n  2. Retrieving stores...');
    const getStoresResponse = await fetch(`${baseUrl}/stores`);
    const getStoresData = await getStoresResponse.json();
    assert.strictEqual(getStoresResponse.status, 200);
    assert.strictEqual(getStoresData.count, 1);
    assert.strictEqual(getStoresData.stores[0]._id.toString(), storeId);
    console.log(`     ✓ Found ${getStoresData.count} store(s)`);

    // 3. Add test products manually
    console.log('\n  3. Adding test products...');
    const db = getDb();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { ObjectId } = await import('mongodb');
    const productResult = await db.collection('products').insertOne({
      product_id: '12345',
      store_id: new ObjectId(storeId),
      handle: 'test-product',
      title: 'Test Product',
      product_type: 'Test Type',
      vendor: 'Test Vendor',
      tags: ['electronics', 'test'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: oneDayAgo,
      updated_at: now,
      last_polled_at: now,
      variants: [
        {
          variant_id: '111',
          variant_title: 'Default',
          current_price: 29.99,
          image_url: null,
          price_history: [
            { price: 19.99, recorded_at: oneDayAgo },
            { price: 29.99, recorded_at: now }
          ]
        }
      ]
    });
    const productId = productResult.insertedId;
    console.log(`     ✓ Product created with ID: ${productId}`);

    // 4. Get products for the store
    console.log('\n  4. Retrieving products for store...');
    const getProductsResponse = await fetch(`${baseUrl}/stores/${storeId}/products`);
    const getProductsData = await getProductsResponse.json();
    assert.strictEqual(getProductsResponse.status, 200);
    assert.strictEqual(getProductsData.count, 1);
    assert.strictEqual(getProductsData.products[0].title, 'Test Product');
    console.log(`     ✓ Found ${getProductsData.count} product(s)`);

    // 5. Get price history
    console.log('\n  5. Retrieving price history...');
    const getPriceHistoryResponse = await fetch(`${baseUrl}/products/${productId}/price-history`);
    const getPriceHistoryData = await getPriceHistoryResponse.json();
    assert.strictEqual(getPriceHistoryResponse.status, 200);
    assert.strictEqual(getPriceHistoryData.variants.length, 1);
    assert.strictEqual(getPriceHistoryData.variants[0].price_history.length, 2);
    console.log(`     ✓ Found price history with ${getPriceHistoryData.variants[0].price_history.length} entries`);

    // 6. Add analytics data
    console.log('\n  6. Adding analytics data...');
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    await db.collection('hourly_store_avg').insertOne({
      store_id: new ObjectId(storeId),
      avg_price: 29.99,
      product_count: 1,
      window_start: oneHourAgo,
      window_end: now,
      created_at: oneHourAgo
    });
    console.log(`     ✓ Analytics data added`);

    // 7. Get analytics
    console.log('\n  7. Retrieving analytics...');
    const getAnalyticsResponse = await fetch(`${baseUrl}/analytics/stores/${storeId}/average-price`);
    const getAnalyticsData = await getAnalyticsResponse.json();
    assert.strictEqual(getAnalyticsResponse.status, 200);
    assert.ok(getAnalyticsData.count >= 1);
    console.log(`     ✓ Found ${getAnalyticsData.count} analytics entry(ies)`);

    // 8. Get changelogs
    console.log('\n  8. Retrieving changelogs...');
    const getChangelogsResponse = await fetch(`${baseUrl}/changelogs/products?store_id=${storeId}`);
    const getChangelogsData = await getChangelogsResponse.json();
    assert.strictEqual(getChangelogsResponse.status, 200);
    assert.ok(getChangelogsData.count >= 1);
    console.log(`     ✓ Found ${getChangelogsData.count} changelog entry(ies)`);

    console.log('\n  ✅ Full API flow completed successfully!\n');
  });
});

