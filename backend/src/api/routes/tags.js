import { Router } from 'express';
import { getAllTags } from '../controllers/tags.js';

const router = Router();

// GET /tags - Get all unique tags across all stores
router.get('/tags', getAllTags);

export default router;

