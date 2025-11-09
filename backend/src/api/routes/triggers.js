import express from 'express';
import * as triggerClient from '../clients/trigger-client.js';

const router = express.Router();

/**
 * Trigger polling for a specific store
 */
router.post('/poll/store/:storeId', async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const result = await triggerClient.triggerStorePoll(storeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger polling for all active stores
 */
router.post('/poll/all', async (req, res, next) => {
  try {
    const result = await triggerClient.triggerAllStoresPoll();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger aggregation for a specific time window
 */
router.post('/aggregate', async (req, res, next) => {
  try {
    const result = await triggerClient.triggerAggregation(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger aggregation for current hour
 */
router.post('/aggregate/current', async (req, res, next) => {
  try {
    const result = await triggerClient.triggerCurrentHourAggregation();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

