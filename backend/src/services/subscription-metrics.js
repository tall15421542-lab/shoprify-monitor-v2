import { ObjectId } from 'mongodb';
import { getDb } from '../database/connection.js';
import { triggerAggregation } from '../api/clients/trigger-client.js';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function toObjectIdOrNull(value) {
  if (!value) {
    return null;
  }
  if (!ObjectId.isValid(value)) {
    badRequest('Invalid store identifier');
  }
  return new ObjectId(value);
}

function normalizeNumericValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value.valueOf === 'function') {
    const next = value.valueOf();
    if (typeof next === 'number' && Number.isFinite(next)) {
      return Number(next.toFixed(2));
    }
    if (typeof next === 'string') {
      const parsed = Number(next);
      if (!Number.isNaN(parsed)) {
        return Number(parsed.toFixed(2));
      }
    }
  }
  if (typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    if (!Number.isNaN(parsed)) {
      return Number(parsed.toFixed(2));
    }
  }
  return null;
}

function averageVariantPrice(product) {
  if (!product?.variants?.length) {
    return null;
  }

  const prices = product.variants
    .map((variant) => normalizeNumericValue(variant.current_price))
    .filter((price) => price !== null && price !== undefined);

  if (prices.length === 0) {
    return null;
  }

  const total = prices.reduce((sum, price) => sum + price, 0);
  return Number((total / prices.length).toFixed(2));
}

async function getProductBaselineValue(scopeKey) {
  const db = getDb();
  const storeId = toObjectIdOrNull(scopeKey.store_id);
  const products = db.collection('products');
  const rawProductId = scopeKey.product_id;

  if (!ObjectId.isValid(rawProductId)) {
    return null;
  }

  const product = await products.findOne({
    _id: new ObjectId(rawProductId),
    store_id: storeId
  });

  return averageVariantPrice(product);
}

async function getStoreBaselineValue(scopeKey) {
  const db = getDb();
  const storeId = toObjectIdOrNull(scopeKey.store_id);
  if (!storeId) {
    return null;
  }

  const query = { store_id: storeId };
  let latest = await db.collection('hourly_store_avg').findOne(
    query,
    { sort: { window_start: -1 } }
  );

  if (!latest) {
    try {
      const { windowStart, windowEnd } = getPreviousHourWindow();
      await triggerAggregation({
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
      });
      latest = await db.collection('hourly_store_avg').findOne(
        query,
        { sort: { window_start: -1 } }
      );
    } catch (error) {
      console.error(`Failed to trigger store aggregation: ${error.message}`);
    }
  }

  return normalizeNumericValue(latest?.avg_price ?? null);
}

async function getProductTypeBaselineValue(scopeKey) {
  const db = getDb();
  const query = { product_type: scopeKey.product_type };
  let latest = await db.collection('hourly_product_type_avg').findOne(
    query,
    { sort: { window_start: -1 } }
  );

  if (!latest) {
    try {
      const { windowStart, windowEnd } = getPreviousHourWindow();
      await triggerAggregation({
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
      });
      latest = await db.collection('hourly_product_type_avg').findOne(
        query,
        { sort: { window_start: -1 } }
      );
    } catch (error) {
      console.error(`Failed to trigger product type aggregation: ${error.message}`);
    }
  }

  return normalizeNumericValue(latest?.avg_price ?? null);
}

function getPreviousHourWindow() {
  const windowEnd = new Date();
  windowEnd.setMinutes(0, 0, 0);

  const windowStart = new Date(windowEnd);
  windowStart.setHours(windowStart.getHours() - 1);

  return { windowStart, windowEnd };
}

async function getStoreProductTypeBaselineValue(scopeKey) {
  const db = getDb();
  const storeId = toObjectIdOrNull(scopeKey.store_id);
  if (!storeId) {
    return null;
  }

  const query = {
    store_id: storeId,
    product_type: scopeKey.product_type
  };

  let latest = await db.collection('hourly_store_product_type_avg').findOne(
    query,
    { sort: { window_start: -1 } }
  );

  if (!latest) {
    try {
      const { windowStart, windowEnd } = getPreviousHourWindow();
      await triggerAggregation({
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
      });
      latest = await db.collection('hourly_store_product_type_avg').findOne(
        query,
        { sort: { window_start: -1 } }
      );
    } catch (error) {
      console.error(`Failed to trigger store-product-type aggregation: ${error.message}`);
    }
  }

  return normalizeNumericValue(latest?.avg_price ?? null);
}


export async function getBaselineValueForScope(scopeType, scopeKey) {
  switch (scopeType) {
    case 'product':
      return getProductBaselineValue(scopeKey);
    case 'store':
      return getStoreBaselineValue(scopeKey);
    case 'product_type':
      return getProductTypeBaselineValue(scopeKey);
    case 'store_product_type':
      return getStoreProductTypeBaselineValue(scopeKey);
    default:
      badRequest(`Unsupported scope_type: ${scopeType}`);
      return null;
  }
}

export function calculateChangeMetrics(previousValue, currentValue) {
  if (previousValue === null || previousValue === undefined || currentValue === null || currentValue === undefined) {
    return {
      absolute_change: null,
      percentage_change: null
    };
  }

  const absolute = Number((currentValue - previousValue).toFixed(2));
  const percent = previousValue === 0 ? null : Number(((absolute / previousValue) * 100).toFixed(2));

  return {
    absolute_change: absolute,
    percentage_change: percent
  };
}

