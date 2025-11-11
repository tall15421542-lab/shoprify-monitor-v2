import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseProduct } from '../src/services/parser.js';

describe('Parser', () => {
  describe('parseProduct', () => {
    it('should parse a complete product with all fields', () => {
      const mockProduct = {
        id: 12345,
        handle: 'test-product',
        title: 'Test Product',
        product_type: 'Electronics',
        vendor: 'Test Vendor',
        tags: ['tag1', 'tag2'],
        images: [{ src: 'https://example.com/image.jpg' }],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        variants: [
          {
            id: 67890,
            title: 'Variant 1',
            price: '99.99',
            featured_image: { src: 'https://example.com/variant1.jpg' }
          },
          {
            id: 67891,
            title: 'Variant 2',
            price: '149.99',
            featured_image: null
          }
        ]
      };

      const { productData, variantsData } = parseProduct(mockProduct);

      // Test product data
      assert.strictEqual(productData.product_id, 12345);
      assert.strictEqual(productData.handle, 'test-product');
      assert.strictEqual(productData.title, 'Test Product');
      assert.strictEqual(productData.product_type, 'Electronics');
      assert.strictEqual(productData.vendor, 'Test Vendor');
      assert.deepStrictEqual(productData.tags, ['tag1', 'tag2']);
      assert.strictEqual(productData.main_image_url, 'https://example.com/image.jpg');
      assert.ok(productData.created_at instanceof Date);
      assert.ok(productData.updated_at instanceof Date);
      assert.deepStrictEqual(productData.raw_data, mockProduct);

      // Test variants data
      assert.strictEqual(variantsData.length, 2);

      assert.strictEqual(variantsData[0].variant_id, 67890);
      assert.strictEqual(variantsData[0].variant_title, 'Variant 1');
      assert.strictEqual(variantsData[0].price, 99.99);
      assert.strictEqual(variantsData[0].image_url, 'https://example.com/variant1.jpg');

      assert.strictEqual(variantsData[1].variant_id, 67891);
      assert.strictEqual(variantsData[1].variant_title, 'Variant 2');
      assert.strictEqual(variantsData[1].price, 149.99);
      assert.strictEqual(variantsData[1].image_url, null);
    });

    it('should handle products with missing optional fields', () => {
      const minimalProduct = {
        id: 12345,
        handle: 'minimal-product',
        title: 'Minimal Product',
        variants: [
          {
            id: 67890,
            title: 'Default',
            price: '50.00'
          }
        ]
      };

      const { productData, variantsData } = parseProduct(minimalProduct);

      assert.strictEqual(productData.product_id, 12345);
      assert.strictEqual(productData.handle, 'minimal-product');
      assert.strictEqual(productData.title, 'Minimal Product');
      assert.strictEqual(productData.product_type, '');
      assert.strictEqual(productData.vendor, '');
      assert.deepStrictEqual(productData.tags, []);
      assert.strictEqual(productData.main_image_url, null);

      assert.strictEqual(variantsData.length, 1);
      assert.strictEqual(variantsData[0].variant_id, 67890);
      assert.strictEqual(variantsData[0].price, 50.00);
      assert.strictEqual(variantsData[0].image_url, null);
    });

    it('should handle products with no images', () => {
      const noImageProduct = {
        id: 12345,
        handle: 'no-image',
        title: 'No Image Product',
        images: [],
        variants: []
      };

      const { productData, variantsData } = parseProduct(noImageProduct);

      assert.strictEqual(productData.main_image_url, null);
      assert.strictEqual(variantsData.length, 0);
    });

    it('should convert price strings to numbers', () => {
      const product = {
        id: 12345,
        handle: 'test',
        title: 'Test',
        variants: [
          { id: 1, title: 'V1', price: '10.50' },
          { id: 2, title: 'V2', price: '20.99' }
        ]
      };

      const { variantsData } = parseProduct(product);

      assert.strictEqual(typeof variantsData[0].price, 'number');
      assert.strictEqual(variantsData[0].price, 10.50);
      assert.strictEqual(typeof variantsData[1].price, 'number');
      assert.strictEqual(variantsData[1].price, 20.99);
    });

    it('should handle invalid prices (null, undefined, NaN) by returning null', () => {
      const product = {
        id: 12345,
        handle: 'test',
        title: 'Test',
        variants: [
          { id: 1, title: 'V1', price: null },
          { id: 2, title: 'V2', price: undefined },
          { id: 3, title: 'V3', price: 'invalid' },
          { id: 4, title: 'V4', price: '' }
        ]
      };

      const { variantsData } = parseProduct(product);

      // All invalid prices should be converted to null, not NaN
      assert.strictEqual(variantsData[0].price, null);
      assert.strictEqual(variantsData[1].price, null);
      assert.strictEqual(variantsData[2].price, null);
      assert.strictEqual(variantsData[3].price, null);
    });
  });
});
