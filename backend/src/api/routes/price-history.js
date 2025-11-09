import { Router } from 'express';
import { getPriceHistory } from '../controllers/price-history.js';

const router = Router();

// GET /products/:productId/price-history - Get price history for a product
router.get('/products/:productId/price-history', getPriceHistory);

export default router;

