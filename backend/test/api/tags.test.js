import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import { connect, close } from '../../src/database/connection.js';
import { ObjectId } from 'mongodb';

describe('Tags Endpoints', () => {
  let app;
  let server;
  const port = 3007; // Use different port for testing
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
  });

  describe('GET /tags', () => {
    it('should return empty array when no products exist', async () => {
      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.tags));
      assert.strictEqual(data.tags.length, 0);
    });

    it('should return all unique tags with counts', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with tags
      await db.collection('products').insertMany([
        {
          product_id: 1001,
          store_id: storeId,
          title: 'Product 1',
          tags: ['electronics', 'gadgets', 'new']
        },
        {
          product_id: 1002,
          store_id: storeId,
          title: 'Product 2',
          tags: ['electronics', 'sale']
        },
        {
          product_id: 1003,
          store_id: storeId,
          title: 'Product 3',
          tags: ['gadgets', 'sale']
        }
      ]);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 4); // electronics, gadgets, new, sale
      assert.ok(Array.isArray(data.tags));
      
      // Check structure
      const electronicsTag = data.tags.find(t => t.tag === 'electronics');
      assert.ok(electronicsTag);
      assert.strictEqual(electronicsTag.count, 2);
      
      const gadgetsTag = data.tags.find(t => t.tag === 'gadgets');
      assert.ok(gadgetsTag);
      assert.strictEqual(gadgetsTag.count, 2);
      
      const newTag = data.tags.find(t => t.tag === 'new');
      assert.ok(newTag);
      assert.strictEqual(newTag.count, 1);
      
      const saleTag = data.tags.find(t => t.tag === 'sale');
      assert.ok(saleTag);
      assert.strictEqual(saleTag.count, 2);
    });

    it('should return tags sorted alphabetically', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with tags in non-alphabetical order
      await db.collection('products').insertMany([
        {
          product_id: 1001,
          store_id: storeId,
          title: 'Product 1',
          tags: ['zebra', 'apple', 'mango']
        }
      ]);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 3);
      
      // Check alphabetical order
      assert.strictEqual(data.tags[0].tag, 'apple');
      assert.strictEqual(data.tags[1].tag, 'mango');
      assert.strictEqual(data.tags[2].tag, 'zebra');
    });

    it('should aggregate tags across multiple stores', async () => {
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

      // Insert products from different stores with overlapping tags
      await db.collection('products').insertMany([
        {
          product_id: 2001,
          store_id: store1Id,
          title: 'Product from Store 1',
          tags: ['common', 'store1-only']
        },
        {
          product_id: 2002,
          store_id: store2Id,
          title: 'Product from Store 2',
          tags: ['common', 'store2-only']
        }
      ]);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 3); // common, store1-only, store2-only
      
      // Check that 'common' tag has count of 2 (from both stores)
      const commonTag = data.tags.find(t => t.tag === 'common');
      assert.ok(commonTag);
      assert.strictEqual(commonTag.count, 2);
      
      // Check store-specific tags
      const store1Tag = data.tags.find(t => t.tag === 'store1-only');
      assert.ok(store1Tag);
      assert.strictEqual(store1Tag.count, 1);
      
      const store2Tag = data.tags.find(t => t.tag === 'store2-only');
      assert.ok(store2Tag);
      assert.strictEqual(store2Tag.count, 1);
    });

    it('should handle products with empty tags array', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert products with and without tags
      await db.collection('products').insertMany([
        {
          product_id: 3001,
          store_id: storeId,
          title: 'Product with tags',
          tags: ['tagged']
        },
        {
          product_id: 3002,
          store_id: storeId,
          title: 'Product without tags',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 1); // Only 'tagged' should appear
      assert.strictEqual(data.tags[0].tag, 'tagged');
      assert.strictEqual(data.tags[0].count, 1);
    });

    it('should return correct count when same tag appears multiple times in one product', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert product with duplicate tags (although this shouldn't happen in real data)
      await db.collection('products').insertMany([
        {
          product_id: 4001,
          store_id: storeId,
          title: 'Product 1',
          tags: ['duplicate', 'unique']
        },
        {
          product_id: 4002,
          store_id: storeId,
          title: 'Product 2',
          tags: ['duplicate', 'unique', 'duplicate'] // Has duplicate in same product
        }
      ]);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // 'duplicate' should count the number of products it appears in
      // Each product contributes once per tag occurrence in its tags array
      const duplicateTag = data.tags.find(t => t.tag === 'duplicate');
      assert.ok(duplicateTag);
      // Product 1 has 1 occurrence, Product 2 has 2 occurrences = 3 total
      assert.strictEqual(duplicateTag.count, 3);
    });

    it('should handle large number of tags efficiently', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert 100 products with various tags
      const products = [];
      for (let i = 0; i < 100; i++) {
        products.push({
          product_id: 5000 + i,
          store_id: storeId,
          title: `Product ${i}`,
          tags: [`tag-${i % 10}`, `category-${i % 5}`, 'common']
        });
      }
      await db.collection('products').insertMany(products);

      const response = await fetch(`${baseUrl}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      // Should have: 10 tag-* tags, 5 category-* tags, 1 common = 16 unique tags
      assert.strictEqual(data.count, 16);
      
      // 'common' should appear in all 100 products
      const commonTag = data.tags.find(t => t.tag === 'common');
      assert.ok(commonTag);
      assert.strictEqual(commonTag.count, 100);
    });
  });
});

