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

  describe('GET /stores/:storeId/tags', () => {
    it('should return 400 for invalid store ID format', async () => {
      const response = await fetch(`${baseUrl}/stores/invalid-id/tags`);
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

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, storeId.toString());
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.tags));
      assert.strictEqual(data.tags.length, 0);
    });

    it('should return only tags from the specified store', async () => {
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
          title: 'Product from Store 1',
          tags: ['electronics', 'store1-tag', 'common']
        },
        {
          product_id: 6002,
          store_id: store1Id,
          title: 'Another product from Store 1',
          tags: ['electronics', 'gadgets']
        },
        {
          product_id: 6003,
          store_id: store2Id,
          title: 'Product from Store 2',
          tags: ['clothing', 'store2-tag', 'common']
        }
      ]);

      // Query tags for Store 1
      const response = await fetch(`${baseUrl}/stores/${store1Id.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, store1Id.toString());
      assert.strictEqual(data.count, 4); // electronics, store1-tag, common, gadgets
      
      // Check that Store 1 tags are present
      const tagNames = data.tags.map(t => t.tag);
      assert.ok(tagNames.includes('electronics'));
      assert.ok(tagNames.includes('store1-tag'));
      assert.ok(tagNames.includes('common'));
      assert.ok(tagNames.includes('gadgets'));
      
      // Check that Store 2 tags are NOT present
      assert.ok(!tagNames.includes('clothing'));
      assert.ok(!tagNames.includes('store2-tag'));
    });

    it('should return tags with correct counts for store products', async () => {
      // Insert test store
      const storeId = new ObjectId();
      await db.collection('stores').insertOne({
        _id: storeId,
        store_url: 'https://test.myshopify.com',
        store_name: 'Test Store',
        active: true
      });

      // Insert test products with overlapping tags
      await db.collection('products').insertMany([
        {
          product_id: 7001,
          store_id: storeId,
          title: 'Product 1',
          tags: ['popular', 'sale', 'electronics']
        },
        {
          product_id: 7002,
          store_id: storeId,
          title: 'Product 2',
          tags: ['popular', 'electronics']
        },
        {
          product_id: 7003,
          store_id: storeId,
          title: 'Product 3',
          tags: ['popular', 'new']
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 4); // popular, sale, electronics, new
      
      // Check counts
      const popularTag = data.tags.find(t => t.tag === 'popular');
      assert.ok(popularTag);
      assert.strictEqual(popularTag.count, 3); // In all 3 products
      
      const electronicsTag = data.tags.find(t => t.tag === 'electronics');
      assert.ok(electronicsTag);
      assert.strictEqual(electronicsTag.count, 2); // In 2 products
      
      const saleTag = data.tags.find(t => t.tag === 'sale');
      assert.ok(saleTag);
      assert.strictEqual(saleTag.count, 1); // In 1 product
      
      const newTag = data.tags.find(t => t.tag === 'new');
      assert.ok(newTag);
      assert.strictEqual(newTag.count, 1); // In 1 product
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
          product_id: 8001,
          store_id: storeId,
          title: 'Product 1',
          tags: ['zebra', 'apple', 'mango', 'banana']
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 4);
      
      // Check alphabetical order
      assert.strictEqual(data.tags[0].tag, 'apple');
      assert.strictEqual(data.tags[1].tag, 'banana');
      assert.strictEqual(data.tags[2].tag, 'mango');
      assert.strictEqual(data.tags[3].tag, 'zebra');
    });

    it('should handle store with products that have empty tags array', async () => {
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
          product_id: 9001,
          store_id: storeId,
          title: 'Product with tags',
          tags: ['available']
        },
        {
          product_id: 9002,
          store_id: storeId,
          title: 'Product without tags',
          tags: []
        }
      ]);

      const response = await fetch(`${baseUrl}/stores/${storeId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 1); // Only 'available' should appear
      assert.strictEqual(data.tags[0].tag, 'available');
      assert.strictEqual(data.tags[0].count, 1);
    });

    it('should return empty array for non-existent store', async () => {
      // Use a valid ObjectId format but for a store that doesn't exist
      const nonExistentStoreId = new ObjectId();

      const response = await fetch(`${baseUrl}/stores/${nonExistentStoreId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.store_id, nonExistentStoreId.toString());
      assert.strictEqual(data.count, 0);
      assert.ok(Array.isArray(data.tags));
      assert.strictEqual(data.tags.length, 0);
    });

    it('should not include products from other stores', async () => {
      // Insert multiple test stores
      const targetStoreId = new ObjectId();
      const otherStore1Id = new ObjectId();
      const otherStore2Id = new ObjectId();
      
      await db.collection('stores').insertMany([
        {
          _id: targetStoreId,
          store_url: 'https://target.myshopify.com',
          store_name: 'Target Store',
          active: true
        },
        {
          _id: otherStore1Id,
          store_url: 'https://other1.myshopify.com',
          store_name: 'Other Store 1',
          active: true
        },
        {
          _id: otherStore2Id,
          store_url: 'https://other2.myshopify.com',
          store_name: 'Other Store 2',
          active: true
        }
      ]);

      // Insert products from multiple stores
      await db.collection('products').insertMany([
        {
          product_id: 10001,
          store_id: targetStoreId,
          title: 'Target Product',
          tags: ['target-only', 'shared']
        },
        {
          product_id: 10002,
          store_id: otherStore1Id,
          title: 'Other Product 1',
          tags: ['other1-only', 'shared']
        },
        {
          product_id: 10003,
          store_id: otherStore2Id,
          title: 'Other Product 2',
          tags: ['other2-only', 'shared']
        }
      ]);

      // Query tags for target store only
      const response = await fetch(`${baseUrl}/stores/${targetStoreId.toString()}/tags`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.count, 2); // Only target-only and shared
      
      const tagNames = data.tags.map(t => t.tag);
      assert.ok(tagNames.includes('target-only'));
      assert.ok(tagNames.includes('shared'));
      assert.ok(!tagNames.includes('other1-only'));
      assert.ok(!tagNames.includes('other2-only'));
      
      // Check that 'shared' tag only counts once (from target store)
      const sharedTag = data.tags.find(t => t.tag === 'shared');
      assert.ok(sharedTag);
      assert.strictEqual(sharedTag.count, 1);
    });
  });
});

