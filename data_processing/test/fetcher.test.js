import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { fetchProducts } from '../src/services/fetcher.js';

describe('Fetcher', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('fetchProducts', () => {
    it('should fetch products from a real Shopify store', async () => {
      const page1Response = {
        products: [
          {
            id: 1,
            title: 'Product 1',
            handle: 'product-1',
            variants: [{ id: 10 }]
          }
        ]
      };

      const page2Response = {
        products: []
      };

      const fetchMock = mock.method(global, 'fetch', async (url) => {
        if (url.includes('page=1')) {
          return new Response(JSON.stringify(page1Response), { status: 200 });
        }
        return new Response(JSON.stringify(page2Response), { status: 200 });
      });

      const products = await fetchProducts('https://example.myshopify.com');

      assert.ok(Array.isArray(products));
      assert.strictEqual(products.length, 1);
      assert.deepStrictEqual(products[0], page1Response.products[0]);
      assert.strictEqual(fetchMock.mock.calls.length, 2);
    });

    it('should handle pagination and fetch all products', async () => {
      const page1Response = {
        products: Array.from({ length: 250 }, (_, index) => ({
          id: index + 1,
          title: `Product ${index + 1}`,
          handle: `product-${index + 1}`,
          variants: []
        }))
      };
      const page2Response = {
        products: [
          {
            id: 251,
            title: 'Product 251',
            handle: 'product-251',
            variants: []
          }
        ]
      };
      const page3Response = { products: [] };

      const fetchMock = mock.method(global, 'fetch', async (url) => {
        if (url.includes('page=1')) {
          return new Response(JSON.stringify(page1Response), { status: 200 });
        }
        if (url.includes('page=2')) {
          return new Response(JSON.stringify(page2Response), { status: 200 });
        }
        return new Response(JSON.stringify(page3Response), { status: 200 });
      });

      const products = await fetchProducts('https://example.myshopify.com');

      assert.strictEqual(products.length, 251);
      assert.strictEqual(fetchMock.mock.calls.length, 3);
    });

    it('should throw error for invalid store (404)', async () => {
      mock.method(global, 'fetch', async () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, statusText: 'Not Found' }));

      await assert.rejects(
        async () => {
          await fetchProducts('https://invalid-store.myshopify.com');
        },
        {
          name: 'Error',
          message: /HTTP 404/
        }
      );
    });
  });
});
