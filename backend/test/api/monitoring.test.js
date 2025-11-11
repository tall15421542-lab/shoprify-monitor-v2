import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { createApp } from '../../src/api/server.js';
import { connect, close, getDb } from '../../src/database/connection.js';

describe('Monitoring API', () => {
  let app;
  let server;
  const port = 3010;
  let baseUrl;
  let storeId;

  before(async () => {
    await connect('mongodb://localhost:27017', 'shopify_monitor_test');
    app = createApp();
    server = app.listen(port);
    baseUrl = `http://localhost:${port}/api`;
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await close();
  });

  beforeEach(async () => {
    const db = getDb();
    storeId = new ObjectId();

    await Promise.all([
      db.collection('subscriptions').deleteMany({}),
      db.collection('change_logs').deleteMany({}),
      db.collection('change_read_counters').deleteMany({}),
      db.collection('products').deleteMany({}),
      db.collection('stores').deleteMany({}),
      db.collection('hourly_store_avg').deleteMany({}),
      db.collection('hourly_product_type_avg').deleteMany({}),
      db.collection('hourly_store_product_type_avg').deleteMany({})
    ]);

    await db.collection('stores').insertOne({
      _id: storeId,
      store_url: 'https://monitoring-test.myshopify.com',
      store_name: 'Monitoring Test Store',
      poll_interval: 60,
      active: true,
      created_at: new Date()
    });

    await db.collection('products').insertOne({
      product_id: 'prod-123',
      store_id: storeId,
      handle: 'monitor-product',
      title: 'Monitor Product',
      product_type: 'Shoes',
      vendor: 'Monitor Vendor',
      tags: ['tag-a'],
      main_image_url: 'https://example.com/image.jpg',
      created_at: new Date(),
      updated_at: new Date(),
      last_polled_at: new Date(),
      variants: [
        {
          variant_id: 'v-1',
          variant_title: 'Default',
          current_price: 99.5,
          image_url: 'https://example.com/variant.jpg',
          price_history: [
            {
              price: 99.5,
              recorded_at: new Date()
            }
          ]
        }
      ]
    });
  });

  async function createSubscription(body) {
    const response = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  it('creates subscription with baseline change log', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'both',
      interval_minutes: 120
    };

    const { status, data } = await createSubscription(payload);
    assert.strictEqual(status, 201);
    assert.ok(data.id);
    assert.strictEqual(data.scope_type, payload.scope_type);
    assert.strictEqual(data.interval_minutes, payload.interval_minutes);

    const db = getDb();
    const changeLogs = await db.collection('change_logs').find({ subscription_id: new ObjectId(data.id) }).toArray();
    assert.strictEqual(changeLogs.length, 1);
    assert.strictEqual(changeLogs[0].is_baseline, true);
    assert.ok(changeLogs[0].read_at);

    const counters = await db.collection('change_read_counters').findOne({ subscription_id: new ObjectId(data.id) });
    assert.ok(counters);
    assert.strictEqual(counters.unread_count, 0);
  });

  it('prevents duplicate subscription scopes', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_up',
      interval_minutes: 60
    };

    const first = await createSubscription(payload);
    assert.strictEqual(first.status, 201);

    const second = await createSubscription(payload);
    assert.strictEqual(second.status, 409);
    assert.match(second.data.error, /same scope/i);
  });

  it('lists existing subscriptions', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_down',
      interval_minutes: 90
    };

    await createSubscription(payload);

    const response = await fetch(`${baseUrl}/subscriptions`);
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.count, 1);
    assert.strictEqual(data.subscriptions.length, 1);
    assert.strictEqual(data.subscriptions[0].scope_type, 'product');
    assert.strictEqual(data.subscriptions[0].unread_count, 0);
  });

  it('batches unread change logs per subscription without N+1 queries', async () => {
    const payloadA = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_down',
      interval_minutes: 60
    };

    const payloadB = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_up',
      interval_minutes: 45
    };

    const createdA = await createSubscription(payloadA);
    const createdB = await createSubscription(payloadB);
    const subscriptionIdA = new ObjectId(createdA.data.id);
    const subscriptionIdB = new ObjectId(createdB.data.id);

    const db = getDb();
    const now = new Date();

    // Mark baseline rows as read so they are not part of unread assertions.
    await db.collection('change_logs').updateMany(
      { subscription_id: { $in: [subscriptionIdA, subscriptionIdB] } },
      { $set: { read_at: now } }
    );

    const unreadLogsA = Array.from({ length: 12 }, (_, index) => ({
      subscription_id: subscriptionIdA,
      scope_type: 'product',
      scope_key: payloadA.scope_key,
      change_type: 'price_down',
      current_value: 100 - index,
      previous_value: 99.5 - index,
      absolute_change: 0.5,
      percentage_change: 0.5,
      detected_at: new Date(now.getTime() - index * 1000),
      read_at: null,
      is_baseline: false
    }));

    const unreadLogsB = Array.from({ length: 3 }, (_, index) => ({
      subscription_id: subscriptionIdB,
      scope_type: 'product',
      scope_key: payloadB.scope_key,
      change_type: 'price_up',
      current_value: 100 + index,
      previous_value: 99 + index,
      absolute_change: 1,
      percentage_change: 1,
      detected_at: new Date(now.getTime() - index * 2000),
      read_at: null,
      is_baseline: false
    }));

    await db.collection('change_logs').insertMany([...unreadLogsA, ...unreadLogsB]);

    await Promise.all([
      db.collection('change_read_counters').updateOne(
        { subscription_id: subscriptionIdA },
        { $set: { unread_count: unreadLogsA.length, updated_at: now } }
      ),
      db.collection('change_read_counters').updateOne(
        { subscription_id: subscriptionIdB },
        { $set: { unread_count: unreadLogsB.length, updated_at: now } }
      )
    ]);

    const response = await fetch(`${baseUrl}/subscriptions`);
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.count, 2);

    const subscriptionA = data.subscriptions.find((sub) => sub.id === createdA.data.id);
    const subscriptionB = data.subscriptions.find((sub) => sub.id === createdB.data.id);

    assert(subscriptionA);
    assert(subscriptionB);

    assert.strictEqual(subscriptionA.unread_count, unreadLogsA.length);
    assert.strictEqual(subscriptionA.unread_change_logs.length, 10);
    assert.strictEqual(
      new Date(subscriptionA.unread_change_logs[0].detected_at).getTime(),
      unreadLogsA[0].detected_at.getTime()
    );
    for (let i = 1; i < subscriptionA.unread_change_logs.length; i += 1) {
      const prev = new Date(subscriptionA.unread_change_logs[i - 1].detected_at);
      const curr = new Date(subscriptionA.unread_change_logs[i].detected_at);
      assert.ok(prev >= curr);
    }

    assert.strictEqual(subscriptionB.unread_count, unreadLogsB.length);
    assert.strictEqual(subscriptionB.unread_change_logs.length, unreadLogsB.length);
    for (let i = 1; i < subscriptionB.unread_change_logs.length; i += 1) {
      const prev = new Date(subscriptionB.unread_change_logs[i - 1].detected_at);
      const curr = new Date(subscriptionB.unread_change_logs[i].detected_at);
      assert.ok(prev >= curr);
    }
  });

  it('updates subscription interval', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_up',
      interval_minutes: 30
    };

    const created = await createSubscription(payload);
    assert.strictEqual(created.status, 201);
    const db = getDb();
    const stored = await db.collection('subscriptions').findOne({ _id: new ObjectId(created.data.id) });
    assert.ok(stored);

    const response = await fetch(`${baseUrl}/subscriptions/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_minutes: 45 })
    });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.interval_minutes, 45);
  });

  it('deletes subscription and associated change logs', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'both',
      interval_minutes: 45
    };

    const created = await createSubscription(payload);
    const subscriptionId = new ObjectId(created.data.id);

    const db = getDb();
    await db.collection('change_logs').insertOne({
      subscription_id: subscriptionId,
      scope_type: 'product',
      scope_key: payload.scope_key,
      change_type: 'both',
      current_value: 120,
      previous_value: 99.5,
      absolute_change: 20.5,
      percentage_change: 20.6,
      detected_at: new Date(),
      read_at: null,
      is_baseline: false
    });
    await db.collection('change_read_counters').updateOne(
      { subscription_id: subscriptionId },
      { $set: { unread_count: 1, updated_at: new Date() } }
    );

    const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId.toString()}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);

    const remainingLogs = await db.collection('change_logs').countDocuments({ subscription_id: subscriptionId });
    assert.strictEqual(remainingLogs, 0);
    const counter = await db.collection('change_read_counters').findOne({ subscription_id: subscriptionId });
    assert.strictEqual(counter, null);
  });

  it('lists change logs with filters and updates counters on mark-read', async () => {
    const payload = {
      scope_type: 'product',
      scope_key: { store_id: storeId.toString(), product_id: 'prod-123' },
      change_type: 'price_down',
      interval_minutes: 60
    };

    const created = await createSubscription(payload);
    const subscriptionId = new ObjectId(created.data.id);

    const db = getDb();
    const now = new Date();
    const earlier = new Date(now.getTime() - 60 * 60 * 1000);

    const insertedLogs = await db.collection('change_logs').insertMany([
      {
        subscription_id: subscriptionId,
        scope_type: 'product',
        scope_key: payload.scope_key,
        change_type: 'price_down',
        current_value: 110,
        previous_value: 99.5,
        absolute_change: 10.5,
        percentage_change: 10.55,
        detected_at: now,
        read_at: null,
        is_baseline: false
      },
      {
        subscription_id: subscriptionId,
        scope_type: 'product',
        scope_key: payload.scope_key,
        change_type: 'price_down',
        current_value: 115,
        previous_value: 110,
        absolute_change: 5,
        percentage_change: 4.55,
        detected_at: earlier,
        read_at: null,
        is_baseline: false
      }
    ]);

    await db.collection('change_read_counters').updateOne(
      { subscription_id: subscriptionId },
      { $set: { unread_count: 2, updated_at: now } }
    );

    const listResponse = await fetch(`${baseUrl}/change-logs?subscription_id=${subscriptionId.toString()}&read_state=unread`);
    const listData = await listResponse.json();

    assert.strictEqual(listResponse.status, 200);
    assert.ok(listData.entries.length >= 2);
    assert.strictEqual(listData.unread_counters[0].unread_count, 2);

    const markReadResponse = await fetch(`${baseUrl}/change-logs/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Object.values(insertedLogs.insertedIds).map((id) => id.toString()) })
    });
    const markData = await markReadResponse.json();

    assert.strictEqual(markReadResponse.status, 200);
    assert.strictEqual(markData.updated_ids.length, 2);
    assert.strictEqual(markData.unread_counters[0].unread_count, 0);

    const counter = await db.collection('change_read_counters').findOne({ subscription_id: subscriptionId });
    assert.strictEqual(counter.unread_count, 0);

    const sinceTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sinceResponse = await fetch(`${baseUrl}/change-logs?subscription_id=${subscriptionId.toString()}&since=${sinceTime}`);
    const sinceData = await sinceResponse.json();
    assert.strictEqual(sinceResponse.status, 200);
    assert.ok(sinceData.entries.every((entry) => new Date(entry.detected_at) > new Date(sinceTime)));
  });
});

