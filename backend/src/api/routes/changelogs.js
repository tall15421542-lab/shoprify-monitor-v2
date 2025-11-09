import { Router } from 'express';
import {
  getProductChangelogs,
  getStoreAverageChangelogs,
  getTagAverageChangelogs,
  getStoreTagAverageChangelogs
} from '../controllers/changelogs.js';

const router = Router();

// GET /changelogs/products - Get product price changelogs
router.get('/changelogs/products', getProductChangelogs);

// GET /changelogs/stores/average-price - Get store average price changelogs
router.get('/changelogs/stores/average-price', getStoreAverageChangelogs);

// GET /changelogs/tags/average-price - Get tag average price changelogs
router.get('/changelogs/tags/average-price', getTagAverageChangelogs);

// GET /changelogs/stores/:storeId/tags/:tag/average-price - Get store-tag average price changelogs
router.get('/changelogs/stores/:storeId/tags/:tag/average-price', getStoreTagAverageChangelogs);

export default router;

