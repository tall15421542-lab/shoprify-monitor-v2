import { Router } from 'express';
import {
  createSubscription,
  listSubscriptions,
  updateSubscription,
  deleteSubscription,
  listChangeLogs,
  markChangeLogsRead
} from '../controllers/subscriptions.js';

const router = Router();

router.post('/subscriptions', createSubscription);
router.get('/subscriptions', listSubscriptions);
router.patch('/subscriptions/:id', updateSubscription);
router.delete('/subscriptions/:id', deleteSubscription);
router.get('/change-logs', listChangeLogs);
router.post('/change-logs/mark-read', markChangeLogsRead);

export default router;

