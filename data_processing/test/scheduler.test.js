import { test, mock } from 'node:test';
import assert from 'node:assert';
import {
  getPreviousHourWindow,
  runAggregations,
  triggerManualAggregation,
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  setAggregationService,
  resetAggregationService
} from '../src/services/scheduler.js';

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

test('Scheduler Tests', async (t) => {
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

  function resetAggregatorMockCalls() {
    Object.values(aggregatorMocks).forEach((fn) => fn.mock.resetCalls());
  }

  t.after(() => {
    stopScheduler();
    resetAggregationService();
    mock.restoreAll();
  });

  setAggregationService(aggregatorMocks);
  resetAggregatorMockCalls();
  setAggregationReturnValues();

  await t.test('schedules job to run at top of hour', () => {
    startScheduler();
    assert.strictEqual(isSchedulerRunning(), true);
    stopScheduler();
    assert.strictEqual(isSchedulerRunning(), false);
  });

  await t.test('calculates correct previous hour window', () => {
    const { windowStart, windowEnd } = getPreviousHourWindow();

    assert.ok(windowStart instanceof Date);
    assert.ok(windowEnd instanceof Date);
    assert.ok(windowStart < windowEnd);
    assert.strictEqual(windowEnd.getMinutes(), 0);
    assert.strictEqual(windowEnd.getSeconds(), 0);
    assert.strictEqual(windowEnd.getMilliseconds(), 0);
    assert.strictEqual(windowStart.getMinutes(), 0);
    assert.strictEqual(windowStart.getSeconds(), 0);
    assert.strictEqual(windowStart.getMilliseconds(), 0);

    const diffMs = windowEnd - windowStart;
    assert.strictEqual(diffMs, 60 * 60 * 1000);
  });

  await t.test('runAggregations returns counts from aggregator services', async () => {
    setAggregationReturnValues({
      store: 4,
      tag: 3,
      storeTag: 2,
      productType: 5,
      storeProductType: 1
    });
    resetAggregatorMockCalls();

    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    const result = await runAggregations(windowStart, windowEnd);

    assert.deepStrictEqual(result, {
      success: true,
      storeCount: 4,
      tagCount: 3,
      storeTagCount: 2,
      productTypeCount: 5,
      storeProductTypeCount: 1
    });

    assert.strictEqual(aggregatorMocks.aggregateStoreAverages.mock.calls.length, 1);
    const [capturedStart, capturedEnd] = aggregatorMocks.aggregateStoreAverages.mock.calls[0].arguments;
    assert.strictEqual(capturedStart.toISOString(), windowStart.toISOString());
    assert.strictEqual(capturedEnd.toISOString(), windowEnd.toISOString());

    assert.strictEqual(aggregatorMocks.aggregateStoreProductTypeAverages.mock.calls.length, 1);
  });

  await t.test('runAggregations handles downstream errors gracefully', async () => {
    setAggregationReturnValues();
    resetAggregatorMockCalls();
    aggregatorMocks.aggregateTagAverages.mock.mockImplementationOnce(() => {
      throw new Error('aggregation failure');
    });

    const windowStart = new Date('2024-01-01T10:00:00Z');
    const windowEnd = new Date('2024-01-01T11:00:00Z');

    const result = await runAggregations(windowStart, windowEnd);

    assert.deepStrictEqual(result, {
      success: false,
      error: 'aggregation failure'
    });
  });

  await t.test('triggerManualAggregation reuses runAggregations', async () => {
    setAggregationReturnValues({ store: 2 });
    resetAggregatorMockCalls();

    const result = await triggerManualAggregation();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 2);
    assert.strictEqual(aggregatorMocks.aggregateStoreAverages.mock.calls.length, 1);
  });
});

