import { Router } from 'express';
import { addStore, getAllStores, getStoreById } from '../controllers/stores.js';
import { getStoreTagsHandler } from '../controllers/tags.js';

const router = Router();

// POST /stores - Add a new store
router.post('/', addStore);

// GET /stores - Get all stores
router.get('/', getAllStores);

// GET /stores/:storeId/tags - Get all tags for a specific store (must come before /:storeId)
router.get('/:storeId/tags', getStoreTagsHandler);

// GET /stores/:storeId - Get single store
router.get('/:storeId', getStoreById);

export default router;

