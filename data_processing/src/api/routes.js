import express from 'express';
import { triggerStorePoll, triggerAllStoresPoll } from './poller-controller.js';
import { triggerAggregation, triggerCurrentHourAggregation } from './aggregator-controller.js';

const defaultHandlers = {
  triggerStorePoll,
  triggerAllStoresPoll,
  triggerAggregation,
  triggerCurrentHourAggregation
};

export function createApiRouter(overrides = {}) {
  const router = express.Router();
  const handlers = { ...defaultHandlers, ...overrides };

  /**
   * Polling routes
   */
  // Trigger polling for a specific store
  router.post('/poll/store/:storeId', handlers.triggerStorePoll);

  // Trigger polling for all active stores
  router.post('/poll/all', handlers.triggerAllStoresPoll);

  /**
   * Aggregation routes
   */
  // Trigger aggregation for a specific time window
  router.post('/aggregate', handlers.triggerAggregation);

  // Trigger aggregation for current hour
  router.post('/aggregate/current', handlers.triggerCurrentHourAggregation);

  return router;
}

const defaultRouter = createApiRouter();

export default defaultRouter;

