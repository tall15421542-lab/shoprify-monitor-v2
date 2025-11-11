import { ObjectId } from 'mongodb';
import {
  ensureMonitoringCollections,
  getSubscriptionsCollection,
  getChangeLogsCollection,
  getChangeCountersCollection
} from '../../database/monitoring.js';
import {
  validateCreatePayload,
  validateUpdatePayload,
  normalizeSubscriptionDocument,
  SCOPE_TYPES
} from '../../utils/subscriptions.js';
import {
  getBaselineValueForScope,
  calculateChangeMetrics
} from '../../services/subscription-metrics.js';
import { getClient, getDb } from '../../database/connection.js';

const MAX_LIMIT = 100;
const MAX_INLINE_UNREAD_LOGS = 10;

function parseLimit(value) {
  if (value === undefined) {
    return 50;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('limit must be a positive integer');
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value) {
  if (value === undefined) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('offset must be zero or a positive integer');
  }
  return parsed;
}

function parseSince(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid since timestamp');
  }
  return date;
}

function toObjectId(id, field = 'id') {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ${field}`);
  }
  return new ObjectId(id);
}

function mapChangeLog(doc) {
  return {
    id: doc._id.toString(),
    subscription_id: doc.subscription_id.toString(),
    scope_type: doc.scope_type,
    scope_key: doc.scope_key,
    change_type: doc.change_type,
    current_value: doc.current_value,
    previous_value: doc.previous_value,
    absolute_change: doc.absolute_change,
    percentage_change: doc.percentage_change,
    detected_at: doc.detected_at,
    read_at: doc.read_at,
    is_baseline: doc.is_baseline,
    store_name: doc.store_name ?? null,
    product_name: doc.product_name ?? null
  };
}

async function resolveProductScopeNames(scopeKey) {
  const db = getDb();
  const storesCollection = db.collection('stores');
  const productsCollection = db.collection('products');

  let storeName = null;
  let productName = null;
  const storeId = scopeKey?.store_id;
  let storeObjectId = null;

  if (storeId && ObjectId.isValid(storeId)) {
    storeObjectId = new ObjectId(storeId);
    const storeDoc = await storesCollection.findOne(
      { _id: storeObjectId },
      { projection: { store_name: 1 } }
    );
    if (storeDoc && typeof storeDoc.store_name === 'string') {
      storeName = storeDoc.store_name;
    }
  }

  const productId = scopeKey?.product_id;
  if (productId) {
    const productQueries = [];
    if (ObjectId.isValid(productId)) {
      const byObjectId = { _id: new ObjectId(productId) };
      if (storeObjectId) {
        byObjectId.store_id = storeObjectId;
      }
      productQueries.push(byObjectId);
    }

    const byProductId = { product_id: productId };
    if (storeObjectId) {
      byProductId.store_id = storeObjectId;
    }
    productQueries.push(byProductId);

    for (const query of productQueries) {
      const normalizedQuery = { ...query };
      if (normalizedQuery.store_id === undefined) {
        delete normalizedQuery.store_id;
      }
      const productDoc = await productsCollection.findOne(
        normalizedQuery,
        { projection: { title: 1 } }
      );
      if (productDoc) {
        if (typeof productDoc.title === 'string') {
          productName = productDoc.title;
        }
        break;
      }
    }
  }

  return {
    store_name: storeName,
    product_name: productName
  };
}

async function buildSubscriptionNames(scopeType, scopeKey) {
  if (scopeType !== 'product') {
    return {};
  }
  const { store_name, product_name } = await resolveProductScopeNames(scopeKey);
  return {
    store_name: store_name ?? null,
    product_name: product_name ?? null
  };
}

async function insertBaselineChangeLog(subscriptionDoc, session) {
  const changeLogs = getChangeLogsCollection();
  const counters = getChangeCountersCollection();
  const now = new Date();
  const baselineValue = await getBaselineValueForScope(subscriptionDoc.scope_type, subscriptionDoc.scope_key);

  if (baselineValue === null || baselineValue === undefined) {
    const error = new Error('Unable to determine baseline value for the selected scope. Ensure price data exists before creating a subscription.');
    error.statusCode = 422;
    throw error;
  }

  const normalizedValue = Number(baselineValue);
  const { absolute_change, percentage_change } = calculateChangeMetrics(normalizedValue, normalizedValue);

  const logDocument = {
    subscription_id: subscriptionDoc._id,
    scope_type: subscriptionDoc.scope_type,
    scope_key: subscriptionDoc.scope_key,
    change_type: subscriptionDoc.change_type,
    current_value: normalizedValue,
    previous_value: normalizedValue,
    absolute_change,
    percentage_change,
    detected_at: now,
    read_at: null,
    is_baseline: true,
    created_at: now
  };

  if (subscriptionDoc.scope_type === 'product') {
    logDocument.store_name = subscriptionDoc.store_name ?? null;
    logDocument.product_name = subscriptionDoc.product_name ?? null;
  }

  await changeLogs.insertOne(logDocument, { session });
  await counters.updateOne(
    { subscription_id: subscriptionDoc._id },
    {
      $inc: { unread_count: 1 },
      $set: { updated_at: now }
    },
    { session, upsert: true }
  );

  return {
    detectedAt: now,
    baselineValue: normalizedValue
  };
}

export async function createSubscription(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const validated = validateCreatePayload(req.body);
    const subscriptions = getSubscriptionsCollection();
    const counters = getChangeCountersCollection();
    const client = getClient();
    const now = new Date();
    const metadata = await buildSubscriptionNames(validated.scope_type, validated.scope_key);

    const session = client.startSession();
    let created;

    try {
      await session.withTransaction(async () => {
        const document = {
          ...validated,
          ...metadata,
          created_at: now,
          updated_at: now
        };
        const result = await subscriptions.insertOne(document, { session });
        document._id = result.insertedId;
        await counters.insertOne({
          subscription_id: result.insertedId,
          unread_count: 0,
          updated_at: now
        }, { session });

        const baselineResult = await insertBaselineChangeLog(document, session);
        document.unread_count = 1;
        document.unread_updated_at = baselineResult.detectedAt;
        created = document;
      });
    } catch (error) {
      if (error.code === 11000) {
        const conflictError = new Error('A subscription with the same scope already exists');
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    res.status(201).json(normalizeSubscriptionDocument(created));
  } catch (error) {
    next(error);
  }
}

export async function listSubscriptions(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const subscriptions = getSubscriptionsCollection();
    const changeLogs = getChangeLogsCollection();
    const docs = await subscriptions.find({}).sort({ created_at: -1 }).toArray();

    const ids = docs.map((doc) => doc._id);
    const counters = await getChangeCountersCollection()
      .find({ subscription_id: { $in: ids } })
      .toArray();
    const counterMap = new Map(
      counters.map((counter) => [
        counter.subscription_id.toString(),
        {
          unread_count: counter.unread_count,
          unread_updated_at: counter.updated_at
        }
      ])
    );

    const unreadSubscriptionIds = [];
    for (const doc of docs) {
      const counter = counterMap.get(doc._id.toString());
      if (counter) {
        doc.unread_count = counter.unread_count;
        doc.unread_updated_at = counter.unread_updated_at;
      } else {
        doc.unread_count = 0;
        doc.unread_updated_at = null;
      }

      if (doc.unread_count > 0) {
        unreadSubscriptionIds.push(doc._id);
      }
    }

    let unreadLogsBySubscription = new Map();

    if (unreadSubscriptionIds.length > 0) {
      const unreadResults = await changeLogs
        .aggregate([
          {
            $match: {
              subscription_id: { $in: unreadSubscriptionIds },
              read_at: null
            }
          },
          { $sort: { detected_at: -1 } },
          {
            $group: {
              _id: '$subscription_id',
              entries: { $push: '$$ROOT' }
            }
          },
          {
            $project: {
              _id: 0,
              subscription_id: '$_id',
              entries: { $slice: ['$entries', MAX_INLINE_UNREAD_LOGS] }
            }
          }
        ])
        .toArray();

      unreadLogsBySubscription = new Map(
        unreadResults.map((result) => [result.subscription_id.toString(), result.entries])
      );
    }

    const normalized = await Promise.all(
      docs.map(async (doc) => {
        doc.unread_change_logs = unreadLogsBySubscription.get(doc._id.toString()) ?? [];
        const normalizedDoc = normalizeSubscriptionDocument(doc);
        if (normalizedDoc) {
          normalizedDoc.unread_change_logs = Array.isArray(doc.unread_change_logs)
            ? doc.unread_change_logs.map(mapChangeLog)
            : [];
        }
        return normalizedDoc;
      })
    );

    res.json({
      count: docs.length,
      subscriptions: normalized
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSubscription(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const { id } = req.params;
    const updatePayload = validateUpdatePayload(req.body);
    const subscriptions = getSubscriptionsCollection();
    const subscriptionId = toObjectId(id);
    const now = new Date();

    const existing = await subscriptions.findOne({ _id: subscriptionId });
    if (!existing) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const finalScopeType = updatePayload.scope_type ?? existing.scope_type;
    const finalScopeKey = updatePayload.scope_key ?? existing.scope_key;
    const metadata =
      finalScopeType === 'product'
        ? await buildSubscriptionNames(finalScopeType, finalScopeKey)
        : {};

    const updateDoc = {
      $set: {
        ...updatePayload,
        ...metadata,
        updated_at: now
      }
    };

    if (finalScopeType !== 'product') {
      updateDoc.$unset = {
        store_name: '',
        product_name: ''
      };
    }

    const updatedDoc = await subscriptions.findOneAndUpdate(
      { _id: subscriptionId },
      updateDoc,
      { returnDocument: 'after' }
    );

    res.json(normalizeSubscriptionDocument(updatedDoc));
  } catch (error) {
    next(error);
  }
}

export async function deleteSubscription(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const { id } = req.params;
    const subscriptionId = toObjectId(id);
    const subscriptions = getSubscriptionsCollection();
    const changeLogs = getChangeLogsCollection();
    const counters = getChangeCountersCollection();

    const deletedDoc = await subscriptions.findOneAndDelete({ _id: subscriptionId });
    if (!deletedDoc) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await Promise.all([
      changeLogs.deleteMany({ subscription_id: subscriptionId }),
      counters.deleteOne({ subscription_id: subscriptionId })
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function listChangeLogs(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const {
      subscription_id: subscriptionIdParam,
      scope_type: scopeType,
      read_state: readState,
      since,
      limit,
      offset
    } = req.query;

    const filter = {};

    if (subscriptionIdParam) {
      filter.subscription_id = toObjectId(subscriptionIdParam, 'subscription_id');
    }

    if (scopeType) {
      if (!SCOPE_TYPES.has(scopeType)) {
        throw new Error(`Invalid scope_type filter: ${scopeType}`);
      }
      filter.scope_type = scopeType;
    }

    if (readState) {
      if (readState === 'unread') {
        filter.read_at = null;
      } else if (readState === 'read') {
        filter.read_at = { $ne: null };
      } else {
        throw new Error('Invalid read_state filter');
      }
    }

    const sinceDate = parseSince(since);
    if (sinceDate) {
      filter.detected_at = { ...(filter.detected_at || {}), $gt: sinceDate };
    }

    const parsedLimit = parseLimit(limit);
    const parsedOffset = parseOffset(offset);

    const changeLogs = getChangeLogsCollection();
    const [total, entries] = await Promise.all([
      changeLogs.countDocuments(filter),
      changeLogs
        .find(filter)
        .sort({ detected_at: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .toArray()
    ]);

    const subscriptionIds = [...new Set(entries.map((entry) => entry.subscription_id.toString()))];
    const counters = getChangeCountersCollection();
    const counterDocs = await counters.find({
      ...(subscriptionIds.length > 0 ? { subscription_id: { $in: subscriptionIds.map((id) => new ObjectId(id)) } } : {})
    }).toArray();

    const unreadCounters = counterDocs.map((counter) => ({
      subscription_id: counter.subscription_id.toString(),
      unread_count: counter.unread_count,
      updated_at: counter.updated_at
    }));

    res.json({
      count: total,
      limit: parsedLimit,
      offset: parsedOffset,
      entries: entries.map(mapChangeLog),
      unread_counters: unreadCounters
    });
  } catch (error) {
    next(error);
  }
}

async function executeWithOptionalTransaction(fn) {
  const client = getClient();
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    if (error?.message?.includes('Transaction numbers are only allowed')) {
      return fn(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function markChangeLogsRead(req, res, next) {
  try {
    await ensureMonitoringCollections();
    const { ids } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('ids must be a non-empty array');
    }

    const logIds = ids.map((id) => toObjectId(id, 'ids'));
    const changeLogs = getChangeLogsCollection();
    const counters = getChangeCountersCollection();
    const now = new Date();

    const result = await executeWithOptionalTransaction(async (session) => {
      const docs = await changeLogs.find(
        { _id: { $in: logIds } },
        { session }
      ).toArray();

      const unreadBySubscription = new Map();
      const unreadIds = [];
      for (const doc of docs) {
        if (!doc.read_at) {
          const key = doc.subscription_id.toString();
          unreadBySubscription.set(key, (unreadBySubscription.get(key) || 0) + 1);
          unreadIds.push(doc._id);
        }
      }

      if (unreadIds.length === 0) {
        return {
          updated_ids: [],
          unread_counters: []
        };
      }

      await changeLogs.updateMany(
        { _id: { $in: unreadIds } },
        { $set: { read_at: now } },
        { session }
      );

      const counterResults = [];
      for (const [subscriptionIdStr, decrement] of unreadBySubscription.entries()) {
        const subscriptionId = new ObjectId(subscriptionIdStr);
        const counterDoc = await counters.findOne({ subscription_id: subscriptionId }, { session });
        const currentCount = counterDoc?.unread_count ?? 0;
        const newCount = Math.max(currentCount - decrement, 0);
        await counters.updateOne(
          { subscription_id: subscriptionId },
          {
            $set: {
              unread_count: newCount,
              updated_at: now
            }
          },
          { session }
        );
        counterResults.push({
          subscription_id: subscriptionIdStr,
          unread_count: newCount,
          updated_at: now
        });
      }

      return {
        updated_ids: unreadIds.map((id) => id.toString()),
        unread_counters: counterResults
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

