import { Router } from 'express';
import { getAllProductTypes } from '../controllers/product-types.js';

const router = Router();

// GET /product-types - Get all unique product types across all stores
router.get('/product-types', getAllProductTypes);

export default router;
