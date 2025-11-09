import { Router } from 'express';
import { getStoreProducts, getProductById } from '../controllers/products.js';

const router = Router();

// GET /stores/:storeId/products - Get all products for a store
router.get('/stores/:storeId/products', getStoreProducts);

// GET /products/:productId - Get single product
router.get('/products/:productId', getProductById);

export default router;

