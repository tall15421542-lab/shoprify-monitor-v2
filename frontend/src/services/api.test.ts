import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as any;

// Create mock instance
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
};

mockedAxios.create = vi.fn(() => mockAxiosInstance);

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStores', () => {
    it('fetches stores from API including inactive ones', async () => {
      const mockResponse = {
        count: 3,
        stores: [
          {
            _id: '1',
            store_name: 'Store 1',
            store_url: 'store1.myshopify.com',
            active: true,
            polling_interval: 24,
            last_polled_at: '2024-01-01T10:00:00.000Z',
            product_count: 10,
          },
          {
            _id: '2',
            store_name: 'Store 2',
            store_url: 'store2.myshopify.com',
            active: false,
            polling_interval: 12,
            last_polled_at: '2024-01-01T11:00:00.000Z',
            product_count: 5,
          },
          {
            _id: '3',
            store_name: 'Store 3',
            store_url: 'store3.myshopify.com',
            active: true,
            polling_interval: 48,
            last_polled_at: null,
            product_count: 0,
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

      const { getStores } = await import('./api');
      const result = await getStores();

      expect(result).toEqual([
        {
          _id: '1',
          name: 'Store 1',
          url: 'store1.myshopify.com',
          status: 'active',
          pollingInterval: 24,
          lastFetch: new Date('2024-01-01T10:00:00.000Z'),
          productCount: 10,
        },
        {
          _id: '2',
          name: 'Store 2',
          url: 'store2.myshopify.com',
          status: 'inactive',
          pollingInterval: 12,
          lastFetch: new Date('2024-01-01T11:00:00.000Z'),
          productCount: 5,
        },
        {
          _id: '3',
          name: 'Store 3',
          url: 'store3.myshopify.com',
          status: 'active',
          pollingInterval: 48,
          lastFetch: undefined,
          productCount: 0,
        },
      ]);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stores');
    });
  });

  describe('addStore', () => {
    it('posts new store to API', async () => {
      const newStore = {
        name: 'New Store',
        url: 'newstore.myshopify.com',
        pollingInterval: 12,
      };

      const mockResponse = {
        message: 'Store added successfully',
        store: {
          _id: '3',
          store_name: 'New Store',
          store_url: 'newstore.myshopify.com',
          active: true,
          poll_interval: 12,
          last_polled_at: null,
          product_count: 0,
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const { addStore } = await import('./api');
      const result = await addStore(newStore);

      expect(result).toEqual({
        _id: '3',
        name: 'New Store',
        url: 'newstore.myshopify.com',
        status: 'active',
        pollingInterval: 12,
        lastFetch: undefined,
        productCount: 0,
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/stores', {
        store_name: 'New Store',
        store_url: 'newstore.myshopify.com',
        poll_interval: 12,
      });
    });
  });

  describe('deactivateStore', () => {
    it('calls deactivate endpoint for store', async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { message: 'Store marked inactive successfully' },
      });

      const { deactivateStore } = await import('./api');
      await deactivateStore('123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/stores/123');
    });
  });

  describe('activateStore', () => {
    it('calls activate endpoint for store', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: 'Store reactivated successfully' },
      });

      const { activateStore } = await import('./api');
      await activateStore('123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/stores/123/activate');
    });
  });

  describe('getStoreProducts', () => {
    it('fetches products for a store', async () => {
      const mockResponse = {
        store_id: 's1',
        store_name: 'Store 1',
        count: 1,
        products: [
          {
            _id: 'p1',
            store_id: 's1',
            product_id: '111',
            title: 'Product 1',
            handle: 'product-1',
            product_type: 'Shirt',
            vendor: 'Vendor',
            tags: ['tag1'],
            variants: [
              {
                variant_id: 'v1',
                variant_title: 'Default',
                current_price: 99.99,
                price_history: [
                  {
                    price: 89.99,
                    recorded_at: '2024-01-01T00:00:00.000Z',
                  },
                  {
                    price: 99.99,
                    recorded_at: '2024-01-02T00:00:00.000Z',
                  },
                ],
              },
            ],
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-02T00:00:00.000Z',
            main_image_url: 'https://example.com/image.jpg',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

      const { getStoreProducts } = await import('./api');
      const result = await getStoreProducts('s1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: 'p1',
        storeId: mockResponse.store_id,
        title: 'Product 1',
        currentPrice: 99.99,
        productType: 'Shirt',
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stores/s1/products');
    });
  });
});

