import { ObjectId } from 'mongodb';
import { getDb } from './connection.js';

let monitoringInitialized = false;

export async function ensureMonitoringIndexes() {
  if (monitoringInitialized) {
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
    counters.createIndex({ subscription_id: 1 }, { unique: true })
  ]);

  monitoringInitialized = true;
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
  return new ObjectId(value);
}

