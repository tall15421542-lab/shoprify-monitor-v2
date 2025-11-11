import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as aggregatorService from '../src/services/aggregator.js';
import {
  getPreviousHourWindow,
  runAggregations,
  triggerManualAggregation,
  startScheduler,
  stopScheduler,
  isSchedulerRunning
} from '../src/services/scheduler.js';

test('Scheduler Tests', async (t) => {
  let aggregationReturnValues = {
    store: 0,
    tag: 0,
    storeTag: 0,
    productType: 0,
    storeProductType: 0
  };

  const aggregatorMocks = {
    store: mock.method(aggregatorService, 'aggregateStoreAverages', async () => aggregationReturnValues.store),
    tag: mock.method(aggregatorService, 'aggregateTagAverages', async () => aggregationReturnValues.tag),
    storeTag: mock.method(aggregatorService, 'aggregateStoreTagAverages', async () => aggregationReturnValues.storeTag),
    productType: mock.method(aggregatorService, 'aggregateProductTypeAverages', async () => aggregationReturnValues.productType),
    storeProductType: mock.method(aggregatorService, 'aggregateStoreProductTypeAverages', async () => aggregationReturnValues.storeProductType)
  };

  function resetAggregatorMocks(overrides = {}) {
    Object.values(aggregatorMocks).forEach((mockFn) => mockFn.mock.reset());
    aggregationReturnValues = {
      store: 0,
      tag: 0,
      storeTag: 0,
      productType: 0,
      storeProductType: 0,
      ...overrides
    };
  }

  t.after(() => {
    stopScheduler();
    mock.restoreAll();
  });

  resetAggregatorMocks();

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
    resetAggregatorMocks({
      store: 4,
      tag: 3,
      storeTag: 2,
      productType: 5,
      storeProductType: 1
    });

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

    assert.strictEqual(aggregatorMocks.store.mock.calls.length, 1);
    const [capturedStart, capturedEnd] = aggregatorMocks.store.mock.calls[0].arguments;
    assert.strictEqual(capturedStart.toISOString(), windowStart.toISOString());
    assert.strictEqual(capturedEnd.toISOString(), windowEnd.toISOString());

    assert.strictEqual(aggregatorMocks.storeProductType.mock.calls.length, 1);
  });

  await t.test('runAggregations handles downstream errors gracefully', async () => {
    resetAggregatorMocks();
    aggregatorMocks.tag.mock.mockImplementationOnce(() => {
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
    resetAggregatorMocks({ store: 2 });

    const result = await triggerManualAggregation();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storeCount, 2);
    assert.strictEqual(aggregatorMocks.store.mock.calls.length, 1);
  });
});

