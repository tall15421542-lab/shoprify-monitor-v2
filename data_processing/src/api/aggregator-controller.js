import {
  aggregateStoreAverages,
  aggregateTagAverages,
  aggregateStoreTagAverages,
  aggregateProductTypeAverages,
  aggregateStoreProductTypeAverages
} from '../services/aggregator.js';

const defaultAggregationService = {
  aggregateStoreAverages,
  aggregateTagAverages,
  aggregateStoreTagAverages,
  aggregateProductTypeAverages,
  aggregateStoreProductTypeAverages
};

export function createAggregatorController(
  aggregationService = defaultAggregationService
) {
  /**
   * Manually trigger aggregation for a specific time window
   * POST /api/aggregate
   * Body: { windowStart: ISO date string, windowEnd: ISO date string (optional) }
   */
  async function triggerAggregation(req, res) {
    try {
      const { windowStart, windowEnd } = req.body;

      // Parse and validate windowStart
      let start;
      if (windowStart) {
        start = new Date(windowStart);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            error: 'Invalid windowStart date format'
          });
        }
      } else {
        // Default to start of current hour
        start = new Date();
        start.setMinutes(0, 0, 0);
      }

      // Parse windowEnd or default to 1 hour after start
      let end;
      if (windowEnd) {
        end = new Date(windowEnd);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            error: 'Invalid windowEnd date format'
          });
        }
      } else {
        end = new Date(start);
        end.setHours(end.getHours() + 1);
      }

      console.log(
        `\n📊 Manual aggregation triggered for window: ${start.toISOString()} to ${end.toISOString()}`
      );

      // Run all aggregations
      const storeAvgCount = await aggregationService.aggregateStoreAverages(start, end);
      const tagAvgCount = await aggregationService.aggregateTagAverages(start, end);
      const storeTagAvgCount = await aggregationService.aggregateStoreTagAverages(start, end);
      const productTypeAvgCount = await aggregationService.aggregateProductTypeAverages(start, end);
      const storeProductTypeAvgCount =
        await aggregationService.aggregateStoreProductTypeAverages(start, end);

      res.json({
        message: 'Aggregation completed successfully',
        window: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        results: {
          store_averages: storeAvgCount,
          tag_averages: tagAvgCount,
          store_tag_averages: storeTagAvgCount,
          product_type_averages: productTypeAvgCount,
          store_product_type_averages: storeProductTypeAvgCount
        }
      });
    } catch (error) {
      console.error('Error in triggerAggregation:', error);
      res.status(500).json({
        error: 'Failed to aggregate data',
        message: error.message
      });
    }
  }

  /**
   * Manually trigger aggregation for current hour
   * POST /api/aggregate/current
   */
  async function triggerCurrentHourAggregation(req, res) {
    try {
      // Calculate current hour window
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setMinutes(0, 0, 0);

      const windowEnd = new Date(windowStart);
      windowEnd.setHours(windowEnd.getHours() + 1);

      console.log(`\n📊 Manual aggregation triggered for current hour: ${windowStart.toISOString()}`);

      // Run all aggregations
      const storeAvgCount =
        await aggregationService.aggregateStoreAverages(windowStart, windowEnd);
      const tagAvgCount =
        await aggregationService.aggregateTagAverages(windowStart, windowEnd);
      const storeTagAvgCount =
        await aggregationService.aggregateStoreTagAverages(windowStart, windowEnd);
      const productTypeAvgCount =
        await aggregationService.aggregateProductTypeAverages(windowStart, windowEnd);
      const storeProductTypeAvgCount =
        await aggregationService.aggregateStoreProductTypeAverages(windowStart, windowEnd);

      res.json({
        message: 'Current hour aggregation completed successfully',
        window: {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString()
        },
        results: {
          store_averages: storeAvgCount,
          tag_averages: tagAvgCount,
          store_tag_averages: storeTagAvgCount,
          product_type_averages: productTypeAvgCount,
          store_product_type_averages: storeProductTypeAvgCount
        }
      });
    } catch (error) {
      console.error('Error in triggerCurrentHourAggregation:', error);
      res.status(500).json({
        error: 'Failed to aggregate current hour data',
        message: error.message
      });
    }
  }

  return {
    triggerAggregation,
    triggerCurrentHourAggregation
  };
}

const defaultController = createAggregatorController();

export const { triggerAggregation, triggerCurrentHourAggregation } = defaultController;

export default defaultController;

