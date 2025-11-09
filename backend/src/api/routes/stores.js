import { Router } from 'express';
import { addStore, getAllStores, getStoreById } from '../controllers/stores.js';
import { getStoreTagsHandler } from '../controllers/tags.js';
import { getStoreProductTypesHandler } from '../controllers/product-types.js';

const router = Router();

// POST /stores - Add a new store
router.post('/', addStore);

// GET /stores - Get all stores
router.get('/', getAllStores);

// GET /stores/:storeId/tags - Get all tags for a specific store (must come before /:storeId)
router.get('/:storeId/tags', getStoreTagsHandler);

// GET /stores/:storeId/product-types - Get all product types for a specific store (must come before /:storeId)
router.get('/:storeId/product-types', getStoreProductTypesHandler);

// GET /stores/:storeId - Get single store
router.get('/:storeId', getStoreById);

export default router;

