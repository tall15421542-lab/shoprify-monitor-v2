import {
  ensureMonitoringIndexes,
  getSubscriptionsCollection,
  getChangeLogsCollection,
  getChangeCountersCollection
} from '../database/monitoring.js';
import { getProductsCollection } from '../database/models.js';
import { ObjectId } from 'mongodb';
import { calculateAveragePrice, calculateChangeMetrics, computeScopeHash } from './monitoring-utils.js';

const MS_PER_MINUTE = 60 * 1000;

function round(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value.toFixed(2));
}

async function findEligibleComparisonLog(subscriptionId, thresholdDate) {
  const changeLogs = getChangeLogsCollection();
  return changeLogs.findOne(
    {
      subscription_id: subscriptionId,
      detected_at: { $lte: thresholdDate }
    },
    {
      sort: { detected_at: -1 }
    }
  );
}

async function recordChange(subscription, previousValue, currentValue, detectedAt, context = {}) {
  const changeLogs = getChangeLogsCollection();
  const counters = getChangeCountersCollection();

  const { absolute_change, percentage_change } = calculateChangeMetrics(previousValue, currentValue);

  const document = {
    subscription_id: subscription._id,
    scope_type: subscription.scope_type,
    scope_key: subscription.scope_key,
    change_type: subscription.change_type,
    previous_value: round(previousValue),
    current_value: round(currentValue),
    absolute_change,
    percentage_change,
    detected_at: detectedAt,
    read_at: null,
    is_baseline: false,
    created_at: detectedAt
  };

  if (subscription.scope_type === 'product') {
    document.store_name = context.store_name ?? null;
    document.product_name = context.product_name ?? null;
  }

  await changeLogs.insertOne(document);
  await counters.updateOne(
    { subscription_id: subscription._id },
    {
      $inc: { unread_count: 1 },
      $set: { updated_at: detectedAt }
    },
    { upsert: true }
  );
}

function matchesDirection(subscription, previousValue, currentValue) {
  if (subscription.change_type === 'price_up') {
    return currentValue > previousValue;
  }
  if (subscription.change_type === 'price_down') {
    return currentValue < previousValue;
  }
  if (subscription.change_type === 'both') {
    return currentValue !== previousValue;
  }
  return currentValue !== previousValue;
}

export async function evaluateSubscriptionChange(subscription, currentValue, detectedAt = new Date(), context = {}) {
  if (currentValue === null || currentValue === undefined) {
    return false;
  }

  await ensureMonitoringIndexes();

  const thresholdDate = new Date(detectedAt.getTime() - subscription.interval_minutes * MS_PER_MINUTE);
  const comparisonLog = await findEligibleComparisonLog(subscription._id, thresholdDate);

  if (!comparisonLog) {
    return false;
  }

  if (comparisonLog.current_value === null || comparisonLog.current_value === undefined) {
    return false;
  }

  const previousRounded = round(comparisonLog.current_value);
  const currentRounded = round(currentValue);

  if (previousRounded === currentRounded) {
    return false;
  }

  if (!matchesDirection(subscription, comparisonLog.current_value, currentValue)) {
    return false;
  }

  await recordChange(subscription, comparisonLog.current_value, currentValue, detectedAt, context);
  return true;
}

export async function loadProductSubscriptionsForStore(storeId) {
  await ensureMonitoringIndexes();

  const subscriptions = await getSubscriptionsCollection()
    .find({
      scope_type: 'product',
      'scope_key.store_id': storeId
    })
    .toArray();

  const map = new Map();
  const objectIdEntries = [];

  for (const subscription of subscriptions) {
    const rawProductId = subscription?.scope_key?.product_id;
    if (!rawProductId) {
      continue;
    }

    const stringProductId = rawProductId.toString();
    if (ObjectId.isValid(stringProductId) && stringProductId.length === 24) {
      objectIdEntries.push({
        subscription,
        objectId: new ObjectId(stringProductId)
      });
      continue;
    }

    map.set(stringProductId, subscription);
  }

  if (objectIdEntries.length > 0) {
    const objectIds = objectIdEntries.map((entry) => entry.objectId);
    const products = await getProductsCollection()
      .find({ _id: { $in: objectIds } })
      .project({ _id: 1, product_id: 1 })
      .toArray();

    const shopifyIdByObjectId = new Map(
      products
        .filter((product) => product?.product_id)
        .map((product) => [product._id.toString(), product.product_id.toString()])
    );

    for (const { subscription, objectId } of objectIdEntries) {
      const shopifyId = shopifyIdByObjectId.get(objectId.toString());
      if (shopifyId) {
        map.set(shopifyId, subscription);
      } else {
        // Fallback to objectId-based key if we cannot resolve Shopify ID
        map.set(objectId.toString(), subscription);
      }
    }
  }

  return map;
}

export async function loadSubscriptionsByScope(scopeType) {
  await ensureMonitoringIndexes();

  const subscriptions = await getSubscriptionsCollection()
    .find({ scope_type: scopeType })
    .toArray();

  const map = new Map();
  for (const subscription of subscriptions) {
    map.set(subscription.scope_hash, subscription);
  }
  return map;
}

function buildScopeHashForRecord(scopeType, record) {
  switch (scopeType) {
    case 'store':
      return computeScopeHash(scopeType, { store_id: record.store_id.toString() });
    case 'product_type':
      return computeScopeHash(scopeType, { product_type: record.product_type });
    case 'store_product_type':
      return computeScopeHash(scopeType, {
        store_id: record.store_id.toString(),
        product_type: record.product_type
      });
    default:
      throw new Error(`Unsupported scope type for aggregation: ${scopeType}`);
  }
}

export async function evaluateAggregatedSubscriptions(scopeType, records, detectedAt) {
  if (!records || records.length === 0) {
    return;
  }

  const subscriptionMap = await loadSubscriptionsByScope(scopeType);
  if (subscriptionMap.size === 0) {
    return;
  }

  for (const record of records) {
    const hash = buildScopeHashForRecord(scopeType, record);
    const subscription = subscriptionMap.get(hash);

    if (!subscription) {
      continue;
    }

    const currentValue = typeof record.avg_price === 'number' ? Number(record.avg_price.toFixed(2)) : null;
    if (currentValue === null) {
      continue;
    }

    await evaluateSubscriptionChange(subscription, currentValue, detectedAt);
  }
}

export function computeProductAveragePrice(variantsData) {
  return calculateAveragePrice(variantsData);
}

