import { ObjectId } from 'mongodb';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

export const SCOPE_TYPES = new Set([
  'product',
  'store',
  'product_type',
  'store_product_type'
]);

export const CHANGE_TYPES = new Set(['price_up', 'price_down', 'both']);

function ensureValidScopeType(scopeType) {
  if (!SCOPE_TYPES.has(scopeType)) {
    badRequest(`Invalid scope_type: ${scopeType}`);
  }
}

function ensureValidChangeType(changeType) {
  if (typeof changeType !== 'string') {
    badRequest('change_type must be a string');
  }

  const normalized = changeType.trim().toLowerCase();

  if (!CHANGE_TYPES.has(normalized)) {
    badRequest(`Invalid change_type: ${changeType}`);
  }

  return normalized;
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    badRequest(`${field} must be a non-empty string`);
  }
}

function assertObject(value, field) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    badRequest(`${field} must be an object`);
  }
}

function normalizeScope(scopeType, scopeKey) {
  assertObject(scopeKey, 'scope_key');

  switch (scopeType) {
    case 'product': {
      assertString(scopeKey.product_id, 'scope_key.product_id');
      assertString(scopeKey.store_id, 'scope_key.store_id');
      return {
        scope_key: {
          product_id: scopeKey.product_id,
          store_id: scopeKey.store_id
        },
        scope_hash: `product:${scopeKey.store_id}:${scopeKey.product_id}`
      };
    }
    case 'store': {
      assertString(scopeKey.store_id, 'scope_key.store_id');
      return {
        scope_key: { store_id: scopeKey.store_id },
        scope_hash: `store:${scopeKey.store_id}`
      };
    }
    case 'product_type': {
      assertString(scopeKey.product_type, 'scope_key.product_type');
      return {
        scope_key: { product_type: scopeKey.product_type },
        scope_hash: `product_type:${scopeKey.product_type}`
      };
    }
    case 'store_product_type': {
      assertString(scopeKey.store_id, 'scope_key.store_id');
      assertString(scopeKey.product_type, 'scope_key.product_type');
      return {
        scope_key: {
          store_id: scopeKey.store_id,
          product_type: scopeKey.product_type
        },
        scope_hash: `store_product_type:${scopeKey.store_id}:${scopeKey.product_type}`
      };
    }
    default:
      badRequest(`Unsupported scope_type: ${scopeType}`);
  }
}

export function validateCreatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    badRequest('Request body must be an object');
  }

  const { scope_type, scope_key, change_type } = payload;

  ensureValidScopeType(scope_type);
  const normalizedChangeType = ensureValidChangeType(change_type);

  const normalized = normalizeScope(scope_type, scope_key);

  return {
    scope_type,
    change_type: normalizedChangeType,
    ...normalized
  };
}

export function validateUpdatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    badRequest('Request body must be an object');
  }

  const result = {};

  if (payload.scope_type !== undefined || payload.scope_key !== undefined) {
    if (payload.scope_type === undefined || payload.scope_key === undefined) {
      badRequest('Updating scope requires both scope_type and scope_key');
    }
    ensureValidScopeType(payload.scope_type);
    const normalized = normalizeScope(payload.scope_type, payload.scope_key);
    result.scope_type = payload.scope_type;
    result.scope_key = normalized.scope_key;
    result.scope_hash = normalized.scope_hash;
  }

  if (payload.change_type !== undefined) {
    result.change_type = ensureValidChangeType(payload.change_type);
  }

  if (Object.keys(result).length === 0) {
    badRequest('No valid fields provided for update');
  }

  return result;
}

export function normalizeSubscriptionDocument(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: doc._id.toString(),
    scope_type: doc.scope_type,
    scope_key: doc.scope_key,
    scope_hash: doc.scope_hash,
    change_type: doc.change_type,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    store_name: typeof doc.store_name === 'string' ? doc.store_name : null,
    product_name: typeof doc.product_name === 'string' ? doc.product_name : null,
    unread_count: doc.unread_count ?? 0,
    unread_updated_at: doc.unread_updated_at ?? null,
    unread_change_logs: Array.isArray(doc.unread_change_logs) ? doc.unread_change_logs : []
  };
}

export function toObjectIdOrNull(value) {
  if (!value) {
    return null;
  }
  if (!ObjectId.isValid(value)) {
    badRequest('Invalid identifier');
  }
  return new ObjectId(value);
}

