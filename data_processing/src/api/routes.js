import express from 'express';
import { triggerStorePoll, triggerAllStoresPoll } from './poller-controller.js';
import { triggerAggregation, triggerCurrentHourAggregation } from './aggregator-controller.js';

const router = express.Router();

/**
 * Polling routes
 */
// Trigger polling for a specific store
router.post('/poll/store/:storeId', triggerStorePoll);

// Trigger polling for all active stores
router.post('/poll/all', triggerAllStoresPoll);

/**
 * Aggregation routes
 */
// Trigger aggregation for a specific time window
router.post('/aggregate', triggerAggregation);

// Trigger aggregation for current hour
router.post('/aggregate/current', triggerCurrentHourAggregation);

export default router;

