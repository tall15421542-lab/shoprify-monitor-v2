import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { connect, close } from '../src/database/connection.js';
import { getDb } from '../src/database/connection.js';
import {
  evaluateSubscriptionChange,
  loadProductSubscriptionsForStore,
  evaluateAggregatedSubscriptions
} from '../src/services/monitoring.js';
import { calculateAveragePrice } from '../src/services/monitoring-utils.js';
import {
  createEmptySubscriptionFlags,
  getProductSubscriptionFlag,
  getProductTypeSubscriptionFlag,
  getStoreProductTypeSubscriptionFlag,
  getStoreSubscriptionFlag,
  loadSubscriptionFlags
} from '../src/services/subscription-flags.js';

describe('Monitoring Service', () => {
  const dbName = 'shopify_monitor_monitoring_test';

  before(async () => {
    await connect('mongodb://localhost:27017', dbName);
  });

  after(async () => {
    await close();
  });

  beforeEach(async () => {
    const db = getDb();
    await Promise.all([
      db.collection('subscriptions').deleteMany({}),
      db.collection('change_logs').deleteMany({}),
      db.collection('change_read_counters').deleteMany({})
    ]);
  });

  it('evaluates product subscription changes against interval threshold', async () => {
    const db = getDb();
    const now = new Date();
    const storeId = 'store-1';
    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: storeId, product_id: 'prod-1' },
      scope_hash: 'product:store-1:prod-1',
      change_type: 'both',
      interval_minutes: 60,
      created_at: now,
      updated_at: now
    };

    const insertResult = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertResult.insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 100,
      previous_value: 100,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const result = await evaluateSubscriptionChange(subscription, 120, now);

    assert.strictEqual(result, true);

    const logs = await db.collection('change_logs')
      .find({ subscription_id: subscription._id })
      .sort({ detected_at: -1 })
      .toArray();

    assert.strictEqual(logs.length, 2);
    assert.strictEqual(logs[0].is_baseline, false);
    assert.strictEqual(logs[0].current_value, 120);
    assert.strictEqual(logs[0].previous_value, 100);
    assert.strictEqual(logs[0].read_at, null);

    const counter = await db.collection('change_read_counters').findOne({ subscription_id: subscription._id });
    assert.strictEqual(counter.unread_count, 1);
  });

  it('adds store and product names when recording product change logs', async () => {
    const db = getDb();
    const now = new Date();
    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: 'store-meta', product_id: 'prod-meta' },
      scope_hash: 'product:store-meta:prod-meta',
      change_type: 'both',
      interval_minutes: 60,
      created_at: now,
      updated_at: now
    };

    const { insertedId } = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 90,
      previous_value: 90,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const context = {
      store_name: 'Meta Store',
      product_name: 'Meta Product'
    };

    const result = await evaluateSubscriptionChange(subscription, 110, now, context);

    assert.strictEqual(result, true);

    const changeLog = await db.collection('change_logs')
      .findOne({ subscription_id: subscription._id, is_baseline: false });

    assert.ok(changeLog);
    assert.strictEqual(changeLog.store_name, context.store_name);
    assert.strictEqual(changeLog.product_name, context.product_name);
  });

  it('skips recording when change direction does not match price_up subscription', async () => {
    const db = getDb();
    const now = new Date();
    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: 'store-1', product_id: 'prod-2' },
      scope_hash: 'product:store-1:prod-2',
      change_type: 'price_up',
      interval_minutes: 60,
      created_at: now,
      updated_at: now
    };

    const { insertedId } = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 150,
      previous_value: 150,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 90 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const result = await evaluateSubscriptionChange(subscription, 125, now);

    assert.strictEqual(result, false);

    const logs = await db.collection('change_logs')
      .find({ subscription_id: subscription._id, is_baseline: false })
      .toArray();
    assert.strictEqual(logs.length, 0);
  });

  it('records changes when value decreases for price_down subscription', async () => {
    const db = getDb();
    const now = new Date();
    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: 'store-3', product_id: 'prod-3' },
      scope_hash: 'product:store-3:prod-3',
      change_type: 'price_down',
      interval_minutes: 30,
      created_at: now,
      updated_at: now
    };

    const { insertedId } = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 200,
      previous_value: 200,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 60 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const result = await evaluateSubscriptionChange(subscription, 170, now);
    assert.strictEqual(result, true);

    const logs = await db.collection('change_logs')
      .find({ subscription_id: subscription._id, is_baseline: false })
      .toArray();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].current_value, 170);
    assert.strictEqual(logs[0].previous_value, 200);
  });

  it('records changes for both subscription when value decreases', async () => {
    const db = getDb();
    const now = new Date();
    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: 'store-4', product_id: 'prod-4' },
      scope_hash: 'product:store-4:prod-4',
      change_type: 'both',
      interval_minutes: 45,
      created_at: now,
      updated_at: now
    };

    const { insertedId } = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 180,
      previous_value: 180,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const result = await evaluateSubscriptionChange(subscription, 150, now);
    assert.strictEqual(result, true);

    const logs = await db.collection('change_logs')
      .find({ subscription_id: subscription._id, is_baseline: false })
      .toArray();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].current_value, 150);
    assert.strictEqual(logs[0].previous_value, 180);
  });

  it('loads product subscriptions per store', async () => {
    const db = getDb();
    const storeId = 'store-2';
    const now = new Date();

    const subscription = {
      scope_type: 'product',
      scope_key: { store_id: storeId, product_id: 'prod-42' },
      scope_hash: 'product:store-2:prod-42',
      change_type: 'price_up',
      interval_minutes: 30,
      created_at: now,
      updated_at: now
    };

    await db.collection('subscriptions').insertOne(subscription);

    const map = await loadProductSubscriptionsForStore(storeId);
    const fetched = map.get('prod-42');

    assert.ok(fetched);
    assert.strictEqual(fetched.scope_key.product_id, 'prod-42');
  });

  it('evaluates aggregated store subscriptions', async () => {
    const db = getDb();
    const now = new Date();
    const storeObjectId = new ObjectId();
    const storeIdStr = storeObjectId.toString();

    const subscription = {
      scope_type: 'store',
      scope_key: { store_id: storeIdStr },
      scope_hash: `store:${storeIdStr}`,
      change_type: 'price_up',
      interval_minutes: 15,
      created_at: now,
      updated_at: now
    };

    const { insertedId } = await db.collection('subscriptions').insertOne(subscription);
    subscription._id = insertedId;

    await db.collection('change_logs').insertOne({
      subscription_id: subscription._id,
      scope_type: subscription.scope_type,
      scope_key: subscription.scope_key,
      change_type: subscription.change_type,
      current_value: 50,
      previous_value: 50,
      absolute_change: 0,
      percentage_change: 0,
      detected_at: new Date(now.getTime() - 45 * 60 * 1000),
      read_at: now,
      is_baseline: true,
      created_at: now
    });

    await db.collection('change_read_counters').insertOne({
      subscription_id: subscription._id,
      unread_count: 0,
      updated_at: now
    });

    const detectedAt = now;
    await evaluateAggregatedSubscriptions('store', [
      { store_id: storeObjectId, avg_price: 70 }
    ], detectedAt);

    const logs = await db.collection('change_logs')
      .find({ subscription_id: subscription._id, is_baseline: false })
      .toArray();

    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].current_value, 70);
    assert.strictEqual(logs[0].previous_value, 50);
    assert.strictEqual(logs[0].read_at, null);
  });

  it('loads subscription flags across scopes', async () => {
    const db = getDb();
    const storeId = 'flag-store';
    const otherStoreId = 'other-store';
    const productId = 'flag-product';
    const productType = 'Flag Type';
    const otherProductType = 'Other Type';

    await db.collection('subscriptions').insertMany([
      {
        scope_type: 'store',
        scope_key: { store_id: storeId },
        scope_hash: `store:${storeId}`,
        change_type: 'both',
        interval_minutes: 60,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        scope_type: 'product',
        scope_key: { store_id: storeId, product_id: productId },
        scope_hash: `product:${storeId}:${productId}`,
        change_type: 'price_up',
        interval_minutes: 30,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        scope_type: 'product_type',
        scope_key: { product_type: productType },
        scope_hash: `product_type:${productType}`,
        change_type: 'both',
        interval_minutes: 45,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        scope_type: 'store_product_type',
        scope_key: { store_id: storeId, product_type: productType },
        scope_hash: `store_product_type:${storeId}:${productType}`,
        change_type: 'both',
        interval_minutes: 45,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    const flags = await loadSubscriptionFlags({
      storeIds: [storeId, otherStoreId],
      productTypes: [productType, otherProductType],
      storeProductTypes: [
        { storeId, productType },
        { storeId: otherStoreId, productType }
      ],
      products: [
        { storeId, productId },
        { storeId, productId: 'another-product' }
      ]
    });

    assert.strictEqual(getStoreSubscriptionFlag(flags, storeId), true);
    assert.strictEqual(getStoreSubscriptionFlag(flags, otherStoreId), false);
    assert.strictEqual(getProductSubscriptionFlag(flags, storeId, productId), true);
    assert.strictEqual(getProductSubscriptionFlag(flags, storeId, 'another-product'), false);
    assert.strictEqual(getProductTypeSubscriptionFlag(flags, productType), true);
    assert.strictEqual(getProductTypeSubscriptionFlag(flags, otherProductType), false);
    assert.strictEqual(getStoreProductTypeSubscriptionFlag(flags, storeId, productType), true);
    assert.strictEqual(getStoreProductTypeSubscriptionFlag(flags, otherStoreId, productType), false);

    const emptyFlags = createEmptySubscriptionFlags();
    assert.strictEqual(getStoreSubscriptionFlag(emptyFlags, storeId), false);
  });

  it('calculates average price for variant data', () => {
    const variants = [
      { price: 10 },
      { price: 20 },
      { price: 30 }
    ];

    const average = calculateAveragePrice(variants);
    assert.strictEqual(average, 20);
  });
});

