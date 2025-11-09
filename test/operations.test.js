import { test } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import { dropPriceSnapshotsCollection, createPriceSnapshotsCollection, createPriceSnapshotsIndexes } from '../src/database/analytics-schema.js';
import { upsertProduct } from '../src/database/operations.js';

// Helper to clean up test data
async function cleanupTestData() {
  const db = getDb();
  await db.collection('stores').deleteMany({ store_name: /^Test/ });
  await db.collection('products').deleteMany({});
  // For time-series collections, drop and recreate is more reliable
  await dropPriceSnapshotsCollection();
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
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

test('Operations Tests - Direct Price Snapshot Writing', async (t) => {
  await connect();
  await initializeIndexes();
  
  // Drop and recreate to ensure clean schema
  await dropPriceSnapshotsCollection();
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
  
  // Clean once before all tests
  await cleanupTestData();
  
  t.after(async () => {
    await cleanupTestData();
    await close();
  });
  
  await t.test('upsertProduct creates product and price snapshots', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 1');
    
    const productData = {
      product_id: 1001,
      handle: 'test-product-1',
      title: 'Test Product 1',
      product_type: 'Electronics',
      vendor: 'Test Vendor',
      tags: ['tag1', 'tag2'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    const variantsData = [
      {
        variant_id: 2001,
        variant_title: 'Default',
        price: 29.99,
        image_url: null
      }
    ];
    
    const snapshotCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 1'
    );
    
    assert.strictEqual(snapshotCount, 1, 'Should create 1 price snapshot');
    
    // Verify product was created
    const db = getDb();
    const product = await db.collection('products').findOne({
      product_id: 1001,
      store_id: storeId
    });
    
    assert.ok(product, 'Product should be created');
    assert.strictEqual(product.variants.length, 1, 'Should have 1 variant');
    assert.strictEqual(product.variants[0].current_price, 29.99);
    
    // Verify price snapshot was created
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 1001
    }).toArray();
    
    assert.strictEqual(snapshots.length, 1, 'Should create 1 snapshot');
    assert.strictEqual(snapshots[0].price, 29.99);
    assert.strictEqual(snapshots[0].store_name, 'Test Store 1');
    assert.strictEqual(snapshots[0].metadata.variant_id, 2001);
    assert.deepStrictEqual(snapshots[0].metadata.tags, ['tag1', 'tag2']);
  });
  
  await t.test('upsertProduct creates multiple snapshots for multiple variants', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 2');
    
    const productData = {
      product_id: 1002,
      handle: 'test-product-2',
      title: 'Test Product 2',
      product_type: 'Clothing',
      vendor: 'Test Vendor',
      tags: ['clothing', 'sale'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    const variantsData = [
      { variant_id: 2001, variant_title: 'Small', price: 15.99, image_url: null },
      { variant_id: 2002, variant_title: 'Medium', price: 17.99, image_url: null },
      { variant_id: 2003, variant_title: 'Large', price: 19.99, image_url: null }
    ];
    
    const snapshotCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 2'
    );
    
    assert.strictEqual(snapshotCount, 3, 'Should create 3 price snapshots');
    
    // Verify all snapshots were created
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 1002
    }).sort({ price: 1 }).toArray();
    
    assert.strictEqual(snapshots.length, 3);
    assert.strictEqual(snapshots[0].price, 15.99);
    assert.strictEqual(snapshots[0].metadata.variant_id, 2001);
    assert.strictEqual(snapshots[1].price, 17.99);
    assert.strictEqual(snapshots[1].metadata.variant_id, 2002);
    assert.strictEqual(snapshots[2].price, 19.99);
    assert.strictEqual(snapshots[2].metadata.variant_id, 2003);
    
    // All should have same store_name and tags
    snapshots.forEach(snapshot => {
      assert.strictEqual(snapshot.store_name, 'Test Store 2');
      assert.deepStrictEqual(snapshot.metadata.tags, ['clothing', 'sale']);
    });
  });
  
  await t.test('updating existing product creates new snapshots', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 3');
    
    const productData = {
      product_id: 1003,
      handle: 'test-product-3',
      title: 'Test Product 3',
      product_type: 'Electronics',
      vendor: 'Test Vendor',
      tags: ['electronics'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    const variantsData = [
      { variant_id: 3001, variant_title: 'Default', price: 50.00, image_url: null }
    ];
    
    // First insert
    const firstCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 3'
    );
    
    assert.strictEqual(firstCount, 1);
    
    // Update with new price
    variantsData[0].price = 45.00;
    const secondCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 3'
    );
    
    assert.strictEqual(secondCount, 1, 'Should create another snapshot');
    
    // Verify two snapshots exist with different prices
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 1003
    }).sort({ timestamp: 1 }).toArray();
    
    assert.strictEqual(snapshots.length, 2, 'Should have 2 snapshots');
    assert.strictEqual(snapshots[0].price, 50.00, 'First snapshot should have original price');
    assert.strictEqual(snapshots[1].price, 45.00, 'Second snapshot should have updated price');
    
    // Verify product price history was updated
    const product = await db.collection('products').findOne({
      product_id: 1003
    });
    
    assert.strictEqual(product.variants[0].price_history.length, 2);
    assert.strictEqual(product.variants[0].current_price, 45.00);
  });
  
  await t.test('handles products with no tags (empty array)', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 4');
    
    const productData = {
      product_id: 1004,
      handle: 'test-product-4',
      title: 'Test Product 4',
      product_type: 'Other',
      vendor: 'Test Vendor',
      tags: [],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    const variantsData = [
      { variant_id: 4001, variant_title: 'Default', price: 10.00, image_url: null }
    ];
    
    const snapshotCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 4'
    );
    
    assert.strictEqual(snapshotCount, 1);
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 1004
    });
    
    assert.deepStrictEqual(snapshot.metadata.tags, []);
  });
  
  await t.test('snapshots have consistent timestamps with product', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 5');
    
    const productData = {
      product_id: 1005,
      handle: 'test-product-5',
      title: 'Test Product 5',
      product_type: 'Electronics',
      vendor: 'Test Vendor',
      tags: ['test'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    const variantsData = [
      { variant_id: 5001, variant_title: 'Default', price: 100.00, image_url: null }
    ];
    
    const beforeTime = new Date();
    await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 5'
    );
    const afterTime = new Date();
    
    const db = getDb();
    const product = await db.collection('products').findOne({
      product_id: 1005
    });
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 1005
    });
    
    // Verify timestamps are within expected range
    assert.ok(product.last_polled_at >= beforeTime);
    assert.ok(product.last_polled_at <= afterTime);
    assert.ok(snapshot.timestamp >= beforeTime);
    assert.ok(snapshot.timestamp <= afterTime);
    
    // Price history timestamp should also match
    assert.ok(product.variants[0].price_history[0].recorded_at >= beforeTime);
    assert.ok(product.variants[0].price_history[0].recorded_at <= afterTime);
  });
  
  await t.test('bulk insert works correctly with many variants', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 6');
    
    const productData = {
      product_id: 1006,
      handle: 'test-product-6',
      title: 'Test Product 6',
      product_type: 'Clothing',
      vendor: 'Test Vendor',
      tags: ['bulk-test'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      raw_data: {}
    };
    
    // Create 20 variants
    const variantsData = [];
    for (let i = 1; i <= 20; i++) {
      variantsData.push({
        variant_id: 6000 + i,
        variant_title: `Variant ${i}`,
        price: 10.00 + i,
        image_url: null
      });
    }
    
    const snapshotCount = await upsertProduct(
      productData, 
      variantsData, 
      storeId.toString(),
      'Test Store 6'
    );
    
    assert.strictEqual(snapshotCount, 20, 'Should create 20 snapshots');
    
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 1006
    }).toArray();
    
    assert.strictEqual(snapshots.length, 20);
    
    // Verify all variant_ids are present
    const variantIds = snapshots.map(s => s.metadata.variant_id).sort((a, b) => a - b);
    for (let i = 1; i <= 20; i++) {
      assert.strictEqual(variantIds[i - 1], 6000 + i);
    }
  });
});

