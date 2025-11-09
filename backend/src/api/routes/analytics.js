import { Router } from 'express';
import {
  getStoreAveragePrice,
  getTagAveragePrice,
  getStoreTagAveragePrice,
  getProductTypeAveragePrice,
  getStoreProductTypeAveragePrice
} from '../controllers/analytics.js';

const router = Router();

// GET /analytics/stores/:storeId/average-price - Get average price by store
router.get('/analytics/stores/:storeId/average-price', getStoreAveragePrice);

// GET /analytics/tags/:tag/average-price - Get average price by tag
router.get('/analytics/tags/:tag/average-price', getTagAveragePrice);

// GET /analytics/stores/:storeId/tags/:tag/average-price - Get average price by store and tag
router.get('/analytics/stores/:storeId/tags/:tag/average-price', getStoreTagAveragePrice);

// GET /analytics/product-types/:productType/average-price - Get average price by product type
router.get('/analytics/product-types/:productType/average-price', getProductTypeAveragePrice);

// GET /analytics/stores/:storeId/product-types/:productType/average-price - Get average price by store and product type
router.get('/analytics/stores/:storeId/product-types/:productType/average-price', getStoreProductTypeAveragePrice);

export default router;

