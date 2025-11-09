import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchProducts } from '../src/services/fetcher.js';

describe('Fetcher', () => {
  describe('fetchProducts', () => {
    it('should fetch products from a real Shopify store', async () => {
      const products = await fetchProducts('https://mous.co');

      assert.ok(Array.isArray(products), 'Should return an array');
      assert.ok(products.length > 0, 'Should fetch at least one product');

      const product = products[0];
      assert.ok(product.id, 'Product should have an id');
      assert.ok(product.title, 'Product should have a title');
      assert.ok(product.handle, 'Product should have a handle');
      assert.ok(Array.isArray(product.variants), 'Product should have variants array');
    });

    it('should handle pagination and fetch all products', async () => {
      const products = await fetchProducts('https://mous.co');

      // mous.co has more than 250 products, so pagination should work
      assert.ok(products.length > 250, 'Should fetch more than one page');
    });

    it('should throw error for invalid store (404)', async () => {
      await assert.rejects(
        async () => {
          await fetchProducts('https://invalid-store-that-does-not-exist-12345.myshopify.com');
        },
        {
          name: 'Error',
          message: /HTTP 404/
        }
      );
    });
  });
});
