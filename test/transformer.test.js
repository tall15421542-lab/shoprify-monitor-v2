import { test } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { connect, close, getDb } from '../src/database/connection.js';
import { initializeIndexes } from '../src/database/models.js';
import { dropPriceSnapshotsCollection, createPriceSnapshotsCollection, createPriceSnapshotsIndexes } from '../src/database/analytics-schema.js';
import { transformProduct } from '../src/services/transformer.js';

// Helper to clean up test data
async function cleanupTestData() {
  const db = getDb();
  await db.collection('stores').deleteMany({ store_name: /^Test/ });
  await db.collection('products').deleteMany({});
  await db.collection('price_snapshots').deleteMany({});
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

test('Transformer Tests - Manual Backfill Function', async (t) => {
  await connect();
  await initializeIndexes();
  
  // Drop and recreate to ensure clean schema
  await dropPriceSnapshotsCollection();
  await createPriceSnapshotsCollection();
  await createPriceSnapshotsIndexes();
  
  t.after(async () => {
    await cleanupTestData();
    await close();
  });
  
  await t.test('manually transforms product with single variant', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 1');
    const variants = [
      {
        variant_id: 1001,
        variant_title: 'Default',
        current_price: 19.99,
        image_url: null,
        price_history: [{ price: 19.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5001, storeId, variants, ['electronics', 'gadgets']);
    
    const count = await transformProduct(5001, storeId.toString());
    
    assert.strictEqual(count, 1, 'Should create 1 snapshot');
    
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 5001
    }).toArray();
    
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].price, 19.99);
    assert.strictEqual(snapshots[0].store_name, 'Test Store 1');
    assert.strictEqual(snapshots[0].metadata.variant_id, 1001);
    assert.ok(snapshots[0].timestamp instanceof Date);
  });
  
  await t.test('flattens multiple variants into separate documents', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 2');
    const variants = [
      {
        variant_id: 2001,
        variant_title: 'Small',
        current_price: 15.99,
        image_url: null,
        price_history: [{ price: 15.99, recorded_at: new Date() }]
      },
      {
        variant_id: 2002,
        variant_title: 'Medium',
        current_price: 19.99,
        image_url: null,
        price_history: [{ price: 19.99, recorded_at: new Date() }]
      },
      {
        variant_id: 2003,
        variant_title: 'Large',
        current_price: 24.99,
        image_url: null,
        price_history: [{ price: 24.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5002, storeId, variants, ['clothing']);
    
    const count = await transformProduct(5002, storeId.toString());
    
    assert.strictEqual(count, 3, 'Should create 3 snapshots');
    
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 5002
    }).sort({ price: 1 }).toArray();
    
    assert.strictEqual(snapshots.length, 3);
    assert.strictEqual(snapshots[0].price, 15.99);
    assert.strictEqual(snapshots[0].metadata.variant_id, 2001);
    assert.strictEqual(snapshots[1].price, 19.99);
    assert.strictEqual(snapshots[1].metadata.variant_id, 2002);
    assert.strictEqual(snapshots[2].price, 24.99);
    assert.strictEqual(snapshots[2].metadata.variant_id, 2003);
  });
  
  await t.test('writes price_snapshot with correct timestamp', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 3');
    const variants = [
      {
        variant_id: 3001,
        variant_title: 'Default',
        current_price: 29.99,
        image_url: null,
        price_history: [{ price: 29.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5003, storeId, variants);
    
    const beforeTime = new Date();
    await transformProduct(5003, storeId.toString());
    const afterTime = new Date();
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 5003
    });
    
    assert.ok(snapshot.timestamp instanceof Date);
    assert.ok(snapshot.timestamp >= beforeTime);
    assert.ok(snapshot.timestamp <= afterTime);
  });
  
  await t.test('denormalizes store_name into snapshot', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Awesome Store');
    const variants = [
      {
        variant_id: 4001,
        variant_title: 'Default',
        current_price: 39.99,
        image_url: null,
        price_history: [{ price: 39.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5004, storeId, variants);
    await transformProduct(5004, storeId.toString());
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 5004
    });
    
    assert.strictEqual(snapshot.store_name, 'Test Awesome Store');
  });
  
  await t.test('copies tags array into snapshot', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 5');
    const variants = [
      {
        variant_id: 5001,
        variant_title: 'Default',
        current_price: 49.99,
        image_url: null,
        price_history: [{ price: 49.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5005, storeId, variants, ['tag1', 'tag2', 'tag3']);
    await transformProduct(5005, storeId.toString());
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 5005
    });
    
    assert.deepStrictEqual(snapshot.metadata.tags, ['tag1', 'tag2', 'tag3']);
  });
  
  await t.test('handles missing tags (empty array)', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 6');
    const variants = [
      {
        variant_id: 6001,
        variant_title: 'Default',
        current_price: 59.99,
        image_url: null,
        price_history: [{ price: 59.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5006, storeId, variants, []);
    await transformProduct(5006, storeId.toString());
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 5006
    });
    
    assert.deepStrictEqual(snapshot.metadata.tags, []);
  });
  
  await t.test('handles product with no variants', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 7');
    await createTestProduct(5007, storeId, []);
    
    const count = await transformProduct(5007, storeId.toString());
    
    assert.strictEqual(count, 0, 'Should create 0 snapshots');
    
    const db = getDb();
    const snapshots = await db.collection('price_snapshots').find({
      'metadata.product_id': 5007
    }).toArray();
    
    assert.strictEqual(snapshots.length, 0);
  });
  
  await t.test('stores correct metadata fields', async () => {
    await cleanupTestData();
    
    const storeId = await createTestStore('Test Store 8');
    const variants = [
      {
        variant_id: 8001,
        variant_title: 'Default',
        current_price: 69.99,
        image_url: null,
        price_history: [{ price: 69.99, recorded_at: new Date() }]
      }
    ];
    
    await createTestProduct(5008, storeId, variants);
    await transformProduct(5008, storeId.toString());
    
    const db = getDb();
    const snapshot = await db.collection('price_snapshots').findOne({
      'metadata.product_id': 5008
    });
    
    assert.ok(snapshot.metadata, 'Should have metadata field');
    assert.ok(snapshot.metadata.store_id instanceof ObjectId);
    assert.strictEqual(snapshot.metadata.store_id.toString(), storeId.toString());
    assert.strictEqual(snapshot.metadata.product_id, 5008);
    assert.strictEqual(snapshot.metadata.variant_id, 8001);
  });
  
  await t.test('transformer module exports transformProduct', async () => {
    // Verify the manual transform function is available for backfilling
    assert.strictEqual(typeof transformProduct, 'function', 'transformProduct should be a function');
  });
});

