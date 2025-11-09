import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing the module
vi.mock('axios');

describe('Tags API', () => {
  let mockGet: any;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockGet = vi.fn();
    (axios.create as any).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('getAllTags', () => {
    it('should fetch all tags successfully', async () => {
      const mockResponse = {
        data: {
          count: 3,
          tags: [
            { tag: 'electronics', count: 10 },
            { tag: 'gadgets', count: 5 },
            { tag: 'sale', count: 3 },
          ],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      // Import after setting up mocks
      const { getAllTags } = await import('../api');
      const tags = await getAllTags();

      expect(mockGet).toHaveBeenCalledWith('/tags');
      expect(tags).toEqual(mockResponse.data.tags);
      expect(tags.length).toBe(3);
      expect(tags[0]).toHaveProperty('tag');
      expect(tags[0]).toHaveProperty('count');
    });

    it('should return empty array when no tags exist', async () => {
      const mockResponse = {
        data: {
          count: 0,
          tags: [],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getAllTags } = await import('../api');
      const tags = await getAllTags();

      expect(tags).toEqual([]);
      expect(tags.length).toBe(0);
    });

    it('should throw error when API request fails', async () => {
      const mockError = new Error('Network error');
      mockGet.mockRejectedValue(mockError);

      const { getAllTags } = await import('../api');

      await expect(getAllTags()).rejects.toThrow('Network error');
    });

    it('should handle large number of tags', async () => {
      const largeTags = Array.from({ length: 1000 }, (_, i) => ({
        tag: `tag-${i}`,
        count: i + 1,
      }));

      const mockResponse = {
        data: {
          count: 1000,
          tags: largeTags,
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getAllTags } = await import('../api');
      const tags = await getAllTags();

      expect(tags).toEqual(largeTags);
      expect(tags.length).toBe(1000);
    });

    it('should preserve tag structure from backend', async () => {
      const mockResponse = {
        data: {
          count: 2,
          tags: [
            { tag: 'test-tag', count: 42 },
            { tag: 'another-tag', count: 7 },
          ],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getAllTags } = await import('../api');
      const tags = await getAllTags();

      expect(tags[0].tag).toBe('test-tag');
      expect(tags[0].count).toBe(42);
      expect(tags[1].tag).toBe('another-tag');
      expect(tags[1].count).toBe(7);
    });
  });

  describe('getStoreTags', () => {
    it('should fetch tags for a specific store successfully', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        data: {
          store_id: storeId,
          count: 3,
          tags: [
            { tag: 'electronics', count: 5 },
            { tag: 'gadgets', count: 3 },
            { tag: 'sale', count: 2 },
          ],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getStoreTags } = await import('../api');
      const tags = await getStoreTags(storeId);

      expect(mockGet).toHaveBeenCalledWith(`/stores/${storeId}/tags`);
      expect(tags).toEqual(mockResponse.data.tags);
      expect(tags.length).toBe(3);
      expect(tags[0]).toHaveProperty('tag');
      expect(tags[0]).toHaveProperty('count');
    });

    it('should return empty array when store has no tags', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        data: {
          store_id: storeId,
          count: 0,
          tags: [],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getStoreTags } = await import('../api');
      const tags = await getStoreTags(storeId);

      expect(tags).toEqual([]);
      expect(tags.length).toBe(0);
    });

    it('should throw error when store ID is invalid', async () => {
      const invalidStoreId = 'invalid-id';
      const mockError = new Error('Invalid store ID format');
      mockGet.mockRejectedValue(mockError);

      const { getStoreTags } = await import('../api');

      await expect(getStoreTags(invalidStoreId)).rejects.toThrow('Invalid store ID format');
    });

    it('should throw error when API request fails', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      const mockError = new Error('Network error');
      mockGet.mockRejectedValue(mockError);

      const { getStoreTags } = await import('../api');

      await expect(getStoreTags(storeId)).rejects.toThrow('Network error');
    });

    it('should handle store with large number of tags', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      const largeTags = Array.from({ length: 500 }, (_, i) => ({
        tag: `store-tag-${i}`,
        count: i + 1,
      }));

      const mockResponse = {
        data: {
          store_id: storeId,
          count: 500,
          tags: largeTags,
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getStoreTags } = await import('../api');
      const tags = await getStoreTags(storeId);

      expect(tags).toEqual(largeTags);
      expect(tags.length).toBe(500);
    });

    it('should preserve tag structure from backend', async () => {
      const storeId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        data: {
          store_id: storeId,
          count: 2,
          tags: [
            { tag: 'store-specific-tag', count: 15 },
            { tag: 'another-store-tag', count: 8 },
          ],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getStoreTags } = await import('../api');
      const tags = await getStoreTags(storeId);

      expect(tags[0].tag).toBe('store-specific-tag');
      expect(tags[0].count).toBe(15);
      expect(tags[1].tag).toBe('another-store-tag');
      expect(tags[1].count).toBe(8);
    });

    it('should handle different store IDs correctly', async () => {
      const store1Id = '507f1f77bcf86cd799439011';
      const store2Id = '507f1f77bcf86cd799439012';

      const mockResponse1 = {
        data: {
          store_id: store1Id,
          count: 2,
          tags: [
            { tag: 'store1-tag', count: 3 },
            { tag: 'common-tag', count: 5 },
          ],
        },
      };

      const mockResponse2 = {
        data: {
          store_id: store2Id,
          count: 2,
          tags: [
            { tag: 'store2-tag', count: 4 },
            { tag: 'common-tag', count: 2 },
          ],
        },
      };

      mockGet
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const { getStoreTags } = await import('../api');
      
      const tags1 = await getStoreTags(store1Id);
      const tags2 = await getStoreTags(store2Id);

      expect(mockGet).toHaveBeenCalledWith(`/stores/${store1Id}/tags`);
      expect(mockGet).toHaveBeenCalledWith(`/stores/${store2Id}/tags`);
      
      expect(tags1).toEqual(mockResponse1.data.tags);
      expect(tags2).toEqual(mockResponse2.data.tags);
      
      // Verify tags are different for each store
      expect(tags1.find(t => t.tag === 'store1-tag')).toBeDefined();
      expect(tags2.find(t => t.tag === 'store2-tag')).toBeDefined();
    });

    it('should handle non-existent store gracefully', async () => {
      const nonExistentStoreId = '507f1f77bcf86cd799439999';
      const mockResponse = {
        data: {
          store_id: nonExistentStoreId,
          count: 0,
          tags: [],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const { getStoreTags } = await import('../api');
      const tags = await getStoreTags(nonExistentStoreId);

      expect(tags).toEqual([]);
      expect(tags.length).toBe(0);
    });
  });
});

