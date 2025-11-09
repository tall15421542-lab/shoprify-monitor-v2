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
});

