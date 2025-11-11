import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Product Types Endpoints', () => {
  let app;
  let server;
  const port = 3010; // Use different port for testing
  let baseUrl;
  let db;

  before(async () => {
    // Connect to test database
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');

    const { getDb } = await import('../../src/database/connection.js');
    db = getDb();

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
    await db.collection('stores').deleteMany({});
    await db.collection('products').deleteMany({});
    await db.collection('subscriptions').deleteMany({});
    await db.collection('hourly_product_type_avg').deleteMany({});
    await db.collection('hourly_store_product_type_avg').deleteMany({});
  });

  describe('GET /product-types', () => {
    it('should return empty array when no products exist', async () => {
      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.product_types));
      assert.strictEqual(data.product_types.length, 0);
    });

    it('should return all unique product types with counts', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with product types
      await db.collection('products').insertMany([
        {
          product_id: 1001,
          store_id: storeId,
          title: 'Product 1',
          product_type: 'T-Shirt',
          tags: []
        },
        {
          product_id: 1002,
          store_id: storeId,
          title: 'Product 2',
          product_type: 'T-Shirt',
          tags: []
        },
        {
          product_id: 1003,
          store_id: storeId,
          title: 'Product 3',
          product_type: 'Hoodie',
          tags: []
        },
        {
          product_id: 1004,
          store_id: storeId,
          title: 'Product 4',
          product_type: 'Pants',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 3); // T-Shirt, Hoodie, Pants
      assert.ok(Array.isArray(data.product_types));

      // Check structure
      const tshirtType = data.product_types.find(t => t.product_type === 'T-Shirt');
      assert.ok(tshirtType);
      assert.strictEqual(tshirtType.count, 2);

      const hoodieType = data.product_types.find(t => t.product_type === 'Hoodie');
      assert.ok(hoodieType);
      assert.strictEqual(hoodieType.count, 1);

      const pantsType = data.product_types.find(t => t.product_type === 'Pants');
      assert.ok(pantsType);
      assert.strictEqual(pantsType.count, 1);
    });

    it('should return product types sorted alphabetically', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with product types in non-alphabetical order
      await db.collection('products').insertMany([
        {
          product_id: 1001,
          store_id: storeId,
          title: 'Product 1',
          product_type: 'Zebra Print Shirt',
          tags: []
        },
        {
          product_id: 1002,
          store_id: storeId,
          title: 'Product 2',
          product_type: 'Apple Watch Band',
          tags: []
        },
        {
          product_id: 1003,
          store_id: storeId,
          title: 'Product 3',
          product_type: 'Mango Scented Candle',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 3);

      // Check alphabetical order
      assert.strictEqual(data.product_types[0].product_type, 'Apple Watch Band');
      assert.strictEqual(data.product_types[1].product_type, 'Mango Scented Candle');
      assert.strictEqual(data.product_types[2].product_type, 'Zebra Print Shirt');
    });

    it('should aggregate product types across multiple stores', async () => {
      // Insert multiple test stores
      const store1Id = new ObjectId();
      const store2Id = new ObjectId();

      await db.collection('stores').insertMany([
        {
          _id: store1Id,
          store_url: 'https://store1.myshopify.com',
          store_name: 'Store 1',
          active: true
        },
        {
          _id: store2Id,
          store_url: 'https://store2.myshopify.com',
          store_name: 'Store 2',
          active: true
        }
      ]);

      // Insert products from different stores with overlapping product types
      await db.collection('products').insertMany([
        {
          product_id: 2001,
          store_id: store1Id,
          title: 'Product from Store 1',
          product_type: 'T-Shirt',
          tags: []
        },
        {
          product_id: 2002,
          store_id: store1Id,
          title: 'Another product from Store 1',
          product_type: 'Jacket',
          tags: []
        },
        {
          product_id: 2003,
          store_id: store2Id,
          title: 'Product from Store 2',
          product_type: 'T-Shirt',
          tags: []
        },
        {
          product_id: 2004,
          store_id: store2Id,
          title: 'Another product from Store 2',
          product_type: 'Shoes',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 3); // T-Shirt (from both stores), Jacket, Shoes

      // Check that 'T-Shirt' has count of 2 (from both stores)
      const tshirtType = data.product_types.find(t => t.product_type === 'T-Shirt');
      assert.ok(tshirtType);
      assert.strictEqual(tshirtType.count, 2);

      // Check store-specific product types
      const jacketType = data.product_types.find(t => t.product_type === 'Jacket');
      assert.ok(jacketType);
      assert.strictEqual(jacketType.count, 1);

      const shoesType = data.product_types.find(t => t.product_type === 'Shoes');
      assert.ok(shoesType);
      assert.strictEqual(shoesType.count, 1);
    });

    it('should handle products without product_type', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert products with and without product_type
      await db.collection('products').insertMany([
        {
          product_id: 3001,
          store_id: storeId,
          title: 'Product with product type',
          product_type: 'Accessories',
          tags: []
        },
        {
          product_id: 3002,
          store_id: storeId,
          title: 'Product without product type (null)',
          tags: []
          // no product_type field
        },
        {
          product_id: 3003,
          store_id: storeId,
          title: 'Product with empty product type',
          product_type: '',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 1); // Only 'Accessories' should appear
      assert.strictEqual(data.product_types[0].product_type, 'Accessories');
      assert.strictEqual(data.product_types[0].count, 1);
    });

    it('should handle large number of product types efficiently', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert 100 products with various product types
      const products = [];
      for (let i = 0; i < 100; i++) {
        products.push({
          product_id: 5000 + i,
          store_id: storeId,
          title: `Product ${i}`,
          product_type: `Type-${i % 10}`, // 10 different product types
          tags: []
        });
      }
      await db.collection('products').insertMany(products);

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 10); // 10 unique product types

      // Each type should have 10 products
      for (const productType of data.product_types) {
        assert.strictEqual(productType.count, 10);
      }
    });

    it('should include monitoring flags for product types', async () => {
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://monitoring-store.myshopify.com',
        store_name: 'Monitoring Store',
        active: true
      });

      await db.collection('products').insertMany([
        {
          product_id: 9001,
          store_id: storeId,
          title: 'Watched Product',
          product_type: 'Watched Type',
          tags: []
        },
        {
          product_id: 9002,
          store_id: storeId,
          title: 'Plain Product',
          product_type: 'Plain Type',
          tags: []
        }
      ]);

      await db.collection('subscriptions').insertOne({
        scope_type: 'product_type',
        scope_key: { product_type: 'Watched Type' },
        scope_hash: 'product_type:Watched Type',
        change_type: 'both',
        created_at: new Date(),
        updated_at: new Date()
      });

      const response = await fetch(`${baseUrl}/product-types`);
      const data = await response.json();

      const watchedEntry = data.product_types.find((item) => item.product_type === 'Watched Type');
      assert.ok(watchedEntry);
      assert.ok(watchedEntry.monitoring);
      assert.strictEqual(watchedEntry.monitoring.productType.subscribed, true);

      const plainEntry = data.product_types.find((item) => item.product_type === 'Plain Type');
      assert.ok(plainEntry);
      assert.ok(plainEntry.monitoring);
      assert.strictEqual(plainEntry.monitoring.productType.subscribed, false);
    });
  });

  describe('GET /stores/:storeId/product-types', () => {
    it('should return 400 for invalid store ID format', async () => {
      const response = await fetch(`${baseUrl}/stores/invalid-id/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
      assert.match(data.error, /invalid store id/i);
    });

    it('should return empty array when store has no products', async () => {
      // Insert test store with no products
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, storeId.toString());
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.product_types));
      assert.strictEqual(data.product_types.length, 0);
    });

    it('should return only product types from the specified store', async () => {
      // Insert two test stores
      const store1Id = new ObjectId();
      const store2Id = new ObjectId();

      await db.collection('stores').insertMany([
        {
          _id: store1Id,
          store_url: 'https://store1.myshopify.com',
          store_name: 'Store 1',
          active: true
        },
        {
          _id: store2Id,
          store_url: 'https://store2.myshopify.com',
          store_name: 'Store 2',
          active: true
        }
      ]);

      // Insert products from both stores
      await db.collection('products').insertMany([
        {
          product_id: 6001,
          store_id: store1Id,
          title: 'Product from Store 1 - A',
          product_type: 'Electronics',
          tags: []
        },
        {
          product_id: 6002,
          store_id: store1Id,
          title: 'Product from Store 1 - B',
          product_type: 'Gadgets',
          tags: []
        },
        {
          product_id: 6003,
          store_id: store1Id,
          title: 'Product from Store 1 - C',
          product_type: 'T-Shirt',
          tags: []
        },
        {
          product_id: 6004,
          store_id: store2Id,
          title: 'Product from Store 2',
          product_type: 'Clothing',
          tags: []
        }
      ]);

      // Query product types for Store 1
      const response = await fetch(`${baseUrl}/stores/${store1Id.toString()}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, store1Id.toString());
      assert.strictEqual(data.count, 3); // Electronics, Gadgets, T-Shirt

      // Check that Store 1 product types are present
      const typeNames = data.product_types.map(t => t.product_type);
      assert.ok(typeNames.includes('Electronics'));
      assert.ok(typeNames.includes('Gadgets'));
      assert.ok(typeNames.includes('T-Shirt'));

      // Check that Store 2 product types are NOT present
      assert.ok(!typeNames.includes('Clothing'));
    });

    it('should return product types with correct counts for store products', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with overlapping product types
      await db.collection('products').insertMany([
        {
          product_id: 7001,
          store_id: storeId,
          title: 'Product 1',
          product_type: 'Hoodie',
          tags: []
        },
        {
          product_id: 7002,
          store_id: storeId,
          title: 'Product 2',
          product_type: 'Hoodie',
          tags: []
        },
        {
          product_id: 7003,
          store_id: storeId,
          title: 'Product 3',
          product_type: 'Hoodie',
          tags: []
        },
        {
          product_id: 7004,
          store_id: storeId,
          title: 'Product 4',
          product_type: 'T-Shirt',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 2); // Hoodie, T-Shirt

      // Check counts
      const hoodieType = data.product_types.find(t => t.product_type === 'Hoodie');
      assert.ok(hoodieType);
      assert.strictEqual(hoodieType.count, 3); // 3 Hoodies

      const tshirtType = data.product_types.find(t => t.product_type === 'T-Shirt');
      assert.ok(tshirtType);
      assert.strictEqual(tshirtType.count, 1); // 1 T-Shirt
    });

    it('should return product types sorted alphabetically', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with product types in non-alphabetical order
      await db.collection('products').insertMany([
        {
          product_id: 8001,
          store_id: storeId,
          title: 'Product 1',
          product_type: 'Zebra Print',
          tags: []
        },
        {
          product_id: 8002,
          store_id: storeId,
          title: 'Product 2',
          product_type: 'Apple',
          tags: []
        },
        {
          product_id: 8003,
          store_id: storeId,
          title: 'Product 3',
          product_type: 'Mango',
          tags: []
        },
        {
          product_id: 8004,
          store_id: storeId,
          title: 'Product 4',
          product_type: 'Banana',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 4);

      // Check alphabetical order
      assert.strictEqual(data.product_types[0].product_type, 'Apple');
      assert.strictEqual(data.product_types[1].product_type, 'Banana');
      assert.strictEqual(data.product_types[2].product_type, 'Mango');
      assert.strictEqual(data.product_types[3].product_type, 'Zebra Print');
    });

    it('should include monitoring flags for store product types', async () => {
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://store-with-flags.myshopify.com',
        store_name: 'Store With Flags',
        active: true
      });

      await db.collection('products').insertMany([
        {
          product_id: 9101,
          store_id: storeId,
          title: 'Watched Item',
          product_type: 'Flag Type',
          tags: []
        },
        {
          product_id: 9102,
          store_id: storeId,
          title: 'Regular Item',
          product_type: 'Regular Type',
          tags: []
        }
      ]);

      await db.collection('subscriptions').insertMany([
        {
          scope_type: 'product_type',
          scope_key: { product_type: 'Flag Type' },
          scope_hash: 'product_type:Flag Type',
          change_type: 'both',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          scope_type: 'store_product_type',
          scope_key: { store_id: storeId.toString(), product_type: 'Flag Type' },
          scope_hash: `store_product_type:${storeId.toString()}:Flag Type`,
          change_type: 'price_up',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/product-types`);
      const data = await response.json();

      const flagEntry = data.product_types.find((item) => item.product_type === 'Flag Type');
      assert.ok(flagEntry);
      assert.ok(flagEntry.monitoring);
      assert.strictEqual(flagEntry.monitoring.productType.subscribed, true);
      assert.strictEqual(flagEntry.monitoring.storeProductType.subscribed, true);

      const regularEntry = data.product_types.find((item) => item.product_type === 'Regular Type');
      assert.ok(regularEntry);
      assert.ok(regularEntry.monitoring);
      assert.strictEqual(regularEntry.monitoring.productType.subscribed, false);
      assert.strictEqual(regularEntry.monitoring.storeProductType.subscribed, false);
    });

    it('should return empty array for non-existent store', async () => {
      // Use a valid ObjectId format but for a store that doesn't exist
      const nonExistentStoreId = new ObjectId();

      const response = await fetch(`${baseUrl}/stores/${nonExistentStoreId.toString()}/product-types`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, nonExistentStoreId.toString());
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.product_types));
      assert.strictEqual(data.product_types.length, 0);
    });
  });
});
