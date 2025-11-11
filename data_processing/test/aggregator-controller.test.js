import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { createAggregatorController } from '../src/api/aggregator-controller.js';
import { createApiRouter } from '../src/api/routes.js';

let aggregationReturnValues = {
  store: 0,
  tag: 0,
  storeTag: 0,
  productType: 0,
  storeProductType: 0
};

const aggregatorMocks = {
  aggregateStoreAverages: mock.fn(async () => aggregationReturnValues.store),
  aggregateTagAverages: mock.fn(async () => aggregationReturnValues.tag),
  aggregateStoreTagAverages: mock.fn(async () => aggregationReturnValues.storeTag),
  aggregateProductTypeAverages: mock.fn(async () => aggregationReturnValues.productType),
  aggregateStoreProductTypeAverages: mock.fn(async () => aggregationReturnValues.storeProductType)
};

const aggregatorController = createAggregatorController(aggregatorMocks);
const { triggerAggregation, triggerCurrentHourAggregation } = aggregatorController;
const triggerRouter = createApiRouter({
  triggerAggregation,
  triggerCurrentHourAggregation
});

describe('Aggregator Controller Tests', () => {
  let app;
  let server;
  const port = 3098; // Use unique port for testing
  let baseUrl;

  function resetAggregatorMockCalls() {
  Object.values(aggregatorMocks).forEach((mockFn) => {
    mockFn.mock.resetCalls();
  });
  }

  function setAggregationReturnValues(overrides = {}) {
    aggregationReturnValues = {
      store: 0,
      tag: 0,
      storeTag: 0,
      productType: 0,
      storeProductType: 0,
      ...overrides
    };
  }

  before(async () => {
    resetAggregatorMockCalls();
    setAggregationReturnValues();

    app = express();
    app.use(express.json());
    app.use('/api', triggerRouter);

    server = app.listen(port);
    baseUrl = `http://localhost:${port}`;

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  });

  beforeEach(() => {
    resetAggregatorMockCalls();
    setAggregationReturnValues();
  });

  describe('POST /api/aggregate/current', () => {
    it('should successfully trigger current hour aggregation', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.message, 'Current hour aggregation completed successfully');
      assert.ok(data.window);
      assert.ok(data.window.start);
      assert.ok(data.window.end);
      assert.ok(data.results);
      assert.ok(typeof data.results.store_averages === 'number');
      assert.ok(typeof data.results.tag_averages === 'number');
      assert.ok(typeof data.results.store_tag_averages === 'number');
      assert.ok(typeof data.results.product_type_averages === 'number');
      assert.ok(typeof data.results.store_product_type_averages === 'number');

      assert.strictEqual(aggregatorMocks.aggregateStoreAverages.mock.calls.length, 1);
      assert.strictEqual(aggregatorMocks.aggregateTagAverages.mock.calls.length, 1);
      assert.strictEqual(aggregatorMocks.aggregateStoreTagAverages.mock.calls.length, 1);
      assert.strictEqual(aggregatorMocks.aggregateProductTypeAverages.mock.calls.length, 1);
      assert.strictEqual(aggregatorMocks.aggregateStoreProductTypeAverages.mock.calls.length, 1);
    });

    it('should return valid time window for current hour', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // Verify window is for current hour
      const windowStart = new Date(data.window.start);
      const windowEnd = new Date(data.window.end);
      
      // Window should be exactly 1 hour
      const diff = windowEnd - windowStart;
      assert.strictEqual(diff, 60 * 60 * 1000); // 1 hour in milliseconds
      
      // Start should be at the beginning of an hour
      assert.strictEqual(windowStart.getMinutes(), 0);
      assert.strictEqual(windowStart.getSeconds(), 0);

      const [capturedStart, capturedEnd] = aggregatorMocks.aggregateStoreAverages.mock.calls[0].arguments;
      assert.ok(capturedStart instanceof Date);
      assert.ok(capturedEnd instanceof Date);
      assert.strictEqual(capturedEnd - capturedStart, 60 * 60 * 1000);
      assert.strictEqual(capturedStart.getMinutes(), 0);
      assert.strictEqual(capturedStart.getSeconds(), 0);
    });

    it('should handle empty data gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.results.store_averages, 0);
      assert.strictEqual(data.results.tag_averages, 0);
      assert.strictEqual(data.results.store_tag_averages, 0);
      assert.strictEqual(data.results.product_type_averages, 0);
      assert.strictEqual(data.results.store_product_type_averages, 0);
    });
  });

  describe('POST /api/aggregate', () => {
    it('should successfully trigger aggregation with custom window', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 2, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setHours(windowEnd.getHours() + 1);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.message, 'Aggregation completed successfully');
      assert.ok(data.window);
      assert.strictEqual(data.window.start, windowStart.toISOString());
      assert.strictEqual(data.window.end, windowEnd.toISOString());
      assert.ok(data.results);

      const [capturedStart, capturedEnd] = aggregatorMocks.aggregateStoreAverages.mock.calls[0].arguments;
      assert.strictEqual(capturedStart.toISOString(), windowStart.toISOString());
      assert.strictEqual(capturedEnd.toISOString(), windowEnd.toISOString());
    });

    it('should return 400 for invalid windowStart format', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: 'invalid-date'
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid windowStart'));
      assert.strictEqual(aggregatorMocks.aggregateStoreAverages.mock.calls.length, 0);
    });

    it('should return 400 for invalid windowEnd format', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 1, 0, 0, 0);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString(),
          windowEnd: 'invalid-date'
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('Invalid windowEnd'));
      assert.strictEqual(aggregatorMocks.aggregateStoreAverages.mock.calls.length, 0);
    });

    it('should use default windowEnd if not provided', async () => {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - 1, 0, 0, 0);

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: windowStart.toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      const [capturedStart, capturedEnd] = aggregatorMocks.aggregateStoreAverages.mock.calls[0].arguments;
      assert.strictEqual(capturedStart.toISOString(), windowStart.toISOString());
      assert.strictEqual(capturedEnd - capturedStart, 60 * 60 * 1000);
    });

    it('should use default windowStart (current hour) if not provided', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      
      // Should default to current hour
      const windowStart = new Date(data.window.start);
      assert.strictEqual(windowStart.getMinutes(), 0);
      assert.strictEqual(windowStart.getSeconds(), 0);

      const [capturedStart] = aggregatorMocks.aggregateStoreAverages.mock.calls[0].arguments;
      assert.strictEqual(capturedStart.getMinutes(), 0);
      assert.strictEqual(capturedStart.getSeconds(), 0);
    });
  });

  describe('Aggregation with stubbed results', () => {
    it('should surface aggregation counts from services', async () => {
      setAggregationReturnValues({
        store: 1,
        tag: 2,
        storeTag: 3,
        productType: 4,
        storeProductType: 5
      });

      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowStart: new Date().toISOString(),
          windowEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });

      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.results.store_averages, 1);
      assert.strictEqual(data.results.tag_averages, 2);
      assert.strictEqual(data.results.store_tag_averages, 3);
      assert.strictEqual(data.results.product_type_averages, 4);
      assert.strictEqual(data.results.store_product_type_averages, 5);
    });
  });

  describe('Endpoint availability', () => {
    it('should have aggregate endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });

    it('should have aggregate/current endpoint registered', async () => {
      const response = await fetch(`${baseUrl}/api/aggregate/current`, {
        method: 'POST'
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });
  });
});

