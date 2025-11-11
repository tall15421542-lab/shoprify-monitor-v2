import { ObjectId } from 'mongodb';
import { getDb } from './connection.js';

let initialized = false;

/**
 * Ensure monitoring collections are initialized with indexes.
 */
export async function ensureMonitoringCollections() {
  if (initialized) {
    return;
  }

  const db = getDb();
  const subscriptions = db.collection('subscriptions');
  const changeLogs = db.collection('change_logs');
  const counters = db.collection('change_read_counters');

  await Promise.all([
    subscriptions.createIndex({ scope_type: 1 }),
    subscriptions.createIndex({ scope_hash: 1 }, { unique: true }),
    changeLogs.createIndex({ subscription_id: 1, detected_at: -1 }),
    changeLogs.createIndex(
      { read_at: 1, detected_at: -1 },
      { partialFilterExpression: { read_at: null } }
    ),
    counters.createIndex({ subscription_id: 1 }, { unique: true })
  ]);

  initialized = true;
}

export function getSubscriptionsCollection() {
  return getDb().collection('subscriptions');
}

export function getChangeLogsCollection() {
  return getDb().collection('change_logs');
}

export function getChangeCountersCollection() {
  return getDb().collection('change_read_counters');
}

export function toObjectId(value) {
  if (!ObjectId.isValid(value)) {
    throw new Error('Invalid identifier');
  }
  return new ObjectId(value);
}

