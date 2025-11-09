import { test } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import {
  dropPriceSnapshotsCollection,
  createPriceSnapshotsCollection,
  createPriceSnapshotsIndexes,
  createHourlyStoreAvgCollection,
  createHourlyStoreAvgIndexes,
  createHourlyTagAvgCollection,
  createHourlyTagAvgIndexes,
  createHourlyStoreTagAvgCollection,
  createHourlyStoreTagAvgIndexes
} from '../src/database/analytics-schema.js';
import { transformProduct } from '../src/services/transformer.js';
import { runAggregations } from '../src/services/scheduler.js';

// Helper to clean up test data
async function cleanupTestData() {
  const db = getDb();
  await db.collection('stores').deleteMany({ 
    $or: [
      { store_name: /^Test/ },
      { store_name: /^Integration/ },
      { store_name: /^Fashion/ },
      { store_name: /^Tech/ }
    ]
  });
  await db.collection('products').deleteMany({});
  await db.collection('price_snapshots').deleteMany({});
  await db.collection('hourly_store_avg').deleteMany({});
  await db.collection('hourly_tag_avg').deleteMany({});
  await db.collection('hourly_store_tag_avg').deleteMany({});
}

// Helper to create a test store
async function createTestStore(storeName) {
  const db = getDb();
  const storesCollection = db.collection('stores');
  
  const result = await storesCollection.insertOne({
    store_name: storeName,
    store_url: `https://${storeName.toLowerCase().replace(/\s+/g, '-')}.myshopify.com`,
    active: true,
    polling_interval: 60,
    created_at: new Date(),
    last_polled_at: null
  });
  
  return result.insertedId;
}

// Helper to create a test product
async function createTestProduct(productId, storeId, variants, tags = []) {
  const db = getDb();
  const productsCollection = db.collection('products');
  
  await productsCollection.insertOne({
    product_id: productId,
    store_id: storeId,
    handle: `test-product-${productId}`,
    title: `Test Product ${productId}`,
    product_type: 'Test Type',
    vendor: 'Test Vendor',
    tags: tags,
    main_image_url: 'https://example.com/image.jpg',
    variants: variants,
    created_at: new Date(),
    updated_at: new Date(),
    last_polled_at: new Date(),
    raw_data: {}
  });
}

test('Analytics Integration Tests', async (t) => {
  await connect();
  await initializeIndexes();
  
  // Clean up before starting
  await cleanupTestData();
  
  // Set up collections
  await dropPriceSnapshotsCollection();
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
  await createHourlyStoreAvgCollection();
  await createHourlyStoreAvgIndexes();
  await createHourlyTagAvgCollection();
  await createHourlyTagAvgIndexes();
  await createHourlyStoreTagAvgCollection();
  await createHourlyStoreTagAvgIndexes();
  
  t.after(async () => {
    await cleanupTestData();
    await close();
  });
  
  await t.test('product update triggers transformer and writes to price_snapshots', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Integration Test Store 1');
    const variants = [
      {
        variant_id: 1001,
        variant_title: 'Default',
        current_price: 25.99,
        image_url: null,
        price_history: [{ price: 25.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6001, storeId, variants, ['electronics', 'new']);
    
    // Manually trigger transformer
    const count = await transformProduct(6001, storeId.toString());
    
    assert.strictEqual(count, 1);
    
    // Verify price_snapshots
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 6001
    }).toArray();
    
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].price, 25.99);
    assert.deepStrictEqual(snapshots[0].metadata.tags, ['electronics', 'new']);
  });
  
  await t.test('manual aggregation processes data and writes to hourly_store_avg', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Integration Test Store 2');
    const variants = [
      {
        variant_id: 2001,
        variant_title: 'Small',
        current_price: 15.00,
        image_url: null,
        price_history: [{ price: 15.00, recorded_at: new Date() }]
      },
      {
        variant_id: 2002,
        variant_title: 'Large',
        current_price: 25.00,
        image_url: null,
        price_history: [{ price: 25.00, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6002, storeId, variants, ['clothing']);
    await transformProduct(6002, storeId.toString());
    
    // Get snapshots to determine the time window
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 6002
    }).toArray();
    
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    // Run aggregation
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 1);
    
    // Verify hourly_store_avg
    const storeAvg = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.ok(storeAvg);
    assert.strictEqual(storeAvg.avg_price, 20.00); // (15 + 25) / 2
    assert.strictEqual(storeAvg.product_count, 1); // 1 unique product
  });
  
  await t.test('aggregations write to hourly_tag_avg correctly', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Integration Test Store 3');
    const variants = [
      {
        variant_id: 3001,
        variant_title: 'Default',
        current_price: 100.00,
        image_url: null,
        price_history: [{ price: 100.00, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6003, storeId, variants, ['premium', 'featured']);
    await transformProduct(6003, storeId.toString());
    
    // Get window from snapshots
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 6003
    }).toArray();
    
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    // Run aggregation
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.tagCount, 2); // 2 tags
    
    // Verify hourly_tag_avg
    const premiumTag = await db.collection('hourly_tag_avg').findOne({ tag: 'premium' });
    const featuredTag = await db.collection('hourly_tag_avg').findOne({ tag: 'featured' });
    
    assert.ok(premiumTag);
    assert.ok(featuredTag);
    assert.strictEqual(premiumTag.avg_price, 100.00);
    assert.strictEqual(featuredTag.avg_price, 100.00);
  });
  
  await t.test('aggregations write to hourly_store_tag_avg correctly', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Integration Test Store 4');
    const variants = [
      {
        variant_id: 4001,
        variant_title: 'Default',
        current_price: 50.00,
        image_url: null,
        price_history: [{ price: 50.00, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6004, storeId, variants, ['sale']);
    await transformProduct(6004, storeId.toString());
    
    // Get window from snapshots
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 6004
    }).toArray();
    
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    // Run aggregation
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeTagCount, 1);
    
    // Verify hourly_store_tag_avg
    const storeTagAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: storeId,
      tag: 'sale'
    });
    
    assert.ok(storeTagAvg);
    assert.strictEqual(storeTagAvg.avg_price, 50.00);
    assert.strictEqual(storeTagAvg.product_count, 1);
  });
  
  await t.test('multiple products in same hour aggregate correctly', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Integration Test Store 5');
    
    // Create multiple products
    const variants1 = [
      {
        variant_id: 5001,
        variant_title: 'Default',
        current_price: 10.00,
        image_url: null,
        price_history: [{ price: 10.00, recorded_at: new Date() }]
      }
    ];
    
    const variants2 = [
      {
        variant_id: 5002,
        variant_title: 'Default',
        current_price: 20.00,
        image_url: null,
        price_history: [{ price: 20.00, recorded_at: new Date() }]
      }
    ];
    
    const variants3 = [
      {
        variant_id: 5003,
        variant_title: 'Default',
        current_price: 30.00,
        image_url: null,
        price_history: [{ price: 30.00, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6005, storeId, variants1, ['budget']);
    await createTestProduct(6006, storeId, variants2, ['budget']);
    await createTestProduct(6007, storeId, variants3, ['budget']);
    
    // Transform all products
    await transformProduct(6005, storeId.toString());
    await transformProduct(6006, storeId.toString());
    await transformProduct(6007, storeId.toString());
    
    // Get window from snapshots
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({}).toArray();
    
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    // Run aggregation
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    
    // Verify store average
    const storeAvg = await db.collection('hourly_store_avg').findOne({ store_id: storeId });
    
    assert.ok(storeAvg);
    assert.strictEqual(storeAvg.avg_price, 20.00); // (10 + 20 + 30) / 3
    assert.strictEqual(storeAvg.product_count, 3);
    
    // Verify tag average
    const tagAvg = await db.collection('hourly_tag_avg').findOne({ tag: 'budget' });
    
    assert.ok(tagAvg);
    assert.strictEqual(tagAvg.avg_price, 20.00);
    assert.strictEqual(tagAvg.product_count, 3);
  });
  
  await t.test('products from different stores aggregate separately', async () => {
    await cleanupTestData();
    
    const store1Id = await createTestStore('Integration Test Store A');
    const store2Id = await createTestStore('Integration Test Store B');
    
    const variants1 = [
      {
        variant_id: 7001,
        variant_title: 'Default',
        current_price: 100.00,
        image_url: null,
        price_history: [{ price: 100.00, recorded_at: new Date() }]
      }
    ];
    
    const variants2 = [
      {
        variant_id: 7002,
        variant_title: 'Default',
        current_price: 200.00,
        image_url: null,
        price_history: [{ price: 200.00, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(6008, store1Id, variants1, ['common']);
    await createTestProduct(6009, store2Id, variants2, ['common']);
    
    // Transform both products
    await transformProduct(6008, store1Id.toString());
    await transformProduct(6009, store2Id.toString());
    
    // Get window from snapshots
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({}).toArray();
    
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    // Run aggregation
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 2); // 2 different stores
    
    // Verify store averages are separate
    const store1Avg = await db.collection('hourly_store_avg').findOne({ store_id: store1Id });
    const store2Avg = await db.collection('hourly_store_avg').findOne({ store_id: store2Id });
    
    assert.ok(store1Avg);
    assert.ok(store2Avg);
    assert.strictEqual(store1Avg.avg_price, 100.00);
    assert.strictEqual(store2Avg.avg_price, 200.00);
    
    // Verify tag average combines both stores
    const tagAvg = await db.collection('hourly_tag_avg').findOne({ tag: 'common' });
    
    assert.ok(tagAvg);
    assert.strictEqual(tagAvg.avg_price, 150.00); // (100 + 200) / 2
    assert.strictEqual(tagAvg.product_count, 2);
    
    // Verify store-tag averages are separate
    const store1TagAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: store1Id,
      tag: 'common'
    });
    const store2TagAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: store2Id,
      tag: 'common'
    });
    
    assert.ok(store1TagAvg);
    assert.ok(store2TagAvg);
    assert.strictEqual(store1TagAvg.avg_price, 100.00);
    assert.strictEqual(store2TagAvg.avg_price, 200.00);
  });
  
  await t.test('complete end-to-end pipeline with realistic scenario', async () => {
    await cleanupTestData();
    
    // Scenario: Two stores with multiple products
    const fashionStoreId = await createTestStore('Fashion Boutique');
    const techStoreId = await createTestStore('Tech Hub');
    
    // Fashion store products
    await createTestProduct(7001, fashionStoreId, [
      { variant_id: 8001, variant_title: 'S', current_price: 29.99, image_url: null, price_history: [{ price: 29.99, recorded_at: new Date() }] },
      { variant_id: 8002, variant_title: 'M', current_price: 29.99, image_url: null, price_history: [{ price: 29.99, recorded_at: new Date() }] },
      { variant_id: 8003, variant_title: 'L', current_price: 34.99, image_url: null, price_history: [{ price: 34.99, recorded_at: new Date() }] }
    ], ['clothing', 'summer', 'sale']);
    
    await createTestProduct(7002, fashionStoreId, [
      { variant_id: 8004, variant_title: 'One Size', current_price: 49.99, image_url: null, price_history: [{ price: 49.99, recorded_at: new Date() }] }
    ], ['accessories', 'sale']);
    
    // Tech store products
    await createTestProduct(7003, techStoreId, [
      { variant_id: 8005, variant_title: 'Default', current_price: 199.99, image_url: null, price_history: [{ price: 199.99, recorded_at: new Date() }] }
    ], ['electronics', 'featured']);
    
    await createTestProduct(7004, techStoreId, [
      { variant_id: 8006, variant_title: 'Black', current_price: 89.99, image_url: null, price_history: [{ price: 89.99, recorded_at: new Date() }] },
      { variant_id: 8007, variant_title: 'White', current_price: 89.99, image_url: null, price_history: [{ price: 89.99, recorded_at: new Date() }] }
    ], ['electronics', 'accessories']);
    
    // Transform all products
    await transformProduct(7001, fashionStoreId.toString());
    await transformProduct(7002, fashionStoreId.toString());
    await transformProduct(7003, techStoreId.toString());
    await transformProduct(7004, techStoreId.toString());
    
    // Verify price_snapshots count
    const db = getDb();
    const totalSnapshots = await db.collection('price_snapshots').countDocuments({});
    assert.strictEqual(totalSnapshots, 7); // 3 + 1 + 1 + 2 = 7 variants
    
    // Get window and run aggregation
    const snapshots = await db.collection('price_snapshots').find({}).toArray();
    const snapshotTime = snapshots[0].timestamp;
    const windowStart = new Date(snapshotTime);
    windowStart.setMinutes(0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);
    
    const result = await runAggregations(windowStart, windowEnd);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 2);
    
    // Verify Fashion Boutique aggregates
    const fashionStoreAvg = await db.collection('hourly_store_avg').findOne({ store_id: fashionStoreId });
    assert.ok(fashionStoreAvg);
    assert.strictEqual(fashionStoreAvg.product_count, 2); // 2 products
    // Average: (29.99 + 29.99 + 34.99 + 49.99) / 4 = 36.24
    assert.ok(Math.abs(fashionStoreAvg.avg_price - 36.24) < 0.01);
    
    // Verify Tech Hub aggregates
    const techStoreAvg = await db.collection('hourly_store_avg').findOne({ store_id: techStoreId });
    assert.ok(techStoreAvg);
    assert.strictEqual(techStoreAvg.product_count, 2); // 2 products
    // Average: (199.99 + 89.99 + 89.99) / 3 = 126.66 (rounded)
    assert.ok(Math.abs(techStoreAvg.avg_price - 126.66) < 0.01);
    
    // Verify tag aggregates
    const saleTag = await db.collection('hourly_tag_avg').findOne({ tag: 'sale' });
    assert.ok(saleTag);
    assert.strictEqual(saleTag.product_count, 2); // 2 products with 'sale' tag
    
    const electronicsTag = await db.collection('hourly_tag_avg').findOne({ tag: 'electronics' });
    assert.ok(electronicsTag);
    assert.strictEqual(electronicsTag.product_count, 2); // 2 products with 'electronics' tag
    
    // Verify store-tag aggregates
    const fashionSaleAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: fashionStoreId,
      tag: 'sale'
    });
    assert.ok(fashionSaleAvg);
    
    const techElectronicsAvg = await db.collection('hourly_store_tag_avg').findOne({
      store_id: techStoreId,
      tag: 'electronics'
    });
    assert.ok(techElectronicsAvg);
  });
});

