import { Router } from 'express';
import { addStore, getAllStores, getStoreById } from '../controllers/stores.js';

const router = Router();

// POST /stores - Add a new store
router.post('/', addStore);

// GET /stores - Get all stores
router.get('/', getAllStores);

// GET /stores/:storeId - Get single store
router.get('/:storeId', getStoreById);

export default router;

