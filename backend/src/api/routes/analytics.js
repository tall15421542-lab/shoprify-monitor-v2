import { Router } from 'express';
import {
  getStoreAveragePrice,
  getTagAveragePrice,
  getStoreTagAveragePrice
} from '../controllers/analytics.js';

const router = Router();

// GET /analytics/stores/:storeId/average-price - Get average price by store
router.get('/analytics/stores/:storeId/average-price', getStoreAveragePrice);

// GET /analytics/tags/:tag/average-price - Get average price by tag
router.get('/analytics/tags/:tag/average-price', getTagAveragePrice);

// GET /analytics/stores/:storeId/tags/:tag/average-price - Get average price by store and tag
router.get('/analytics/stores/:storeId/tags/:tag/average-price', getStoreTagAveragePrice);

export default router;

