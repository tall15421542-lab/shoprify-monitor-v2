import { ensureMonitoringCollections, getSubscriptionsCollection } from '../database/monitoring.js';

function buildStoreHash(storeId) {
  return `store:${storeId}`;
}

function buildProductTypeHash(productType) {
  return `product_type:${productType}`;
}

function buildStoreProductTypeHash(storeId, productType) {
  return `store_product_type:${storeId}:${productType}`;
}

function buildProductHash(storeId, productId) {
  return `product:${storeId}:${productId}`;
}

function toUniqueArray(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function createEmptySubscriptionFlags() {
  return {
    store: new Map(),
    productType: new Map(),
    storeProductType: new Map(),
    product: new Map()
  };
}

export async function loadSubscriptionFlags({
  storeIds = [],
  productTypes = [],
  storeProductTypes = [],
  products = []
} = {}) {
  await ensureMonitoringCollections();
  const hashes = new Set();

  const storeHashMap = new Map();
  for (const storeId of toUniqueArray(storeIds)) {
    const hash = buildStoreHash(storeId);
    hashes.add(hash);
    storeHashMap.set(storeId, hash);
  }

  const productTypeHashMap = new Map();
  for (const productType of toUniqueArray(productTypes)) {
    const hash = buildProductTypeHash(productType);
    hashes.add(hash);
    productTypeHashMap.set(productType, hash);
  }

  const storeProductTypeHashMap = new Map();
  for (const entry of storeProductTypes) {
    const { storeId, productType } = entry || {};
    if (!storeId || !productType) continue;
    const key = `${storeId}:${productType}`;
    if (storeProductTypeHashMap.has(key)) continue;
    const hash = buildStoreProductTypeHash(storeId, productType);
    hashes.add(hash);
    storeProductTypeHashMap.set(key, hash);
  }

  const productHashMap = new Map();
  for (const entry of products) {
    const { storeId, productId } = entry || {};
    if (!storeId || !productId) continue;
    const key = `${storeId}:${productId}`;
    if (productHashMap.has(key)) continue;
    const hash = buildProductHash(storeId, productId);
    hashes.add(hash);
    productHashMap.set(key, hash);
  }

  if (hashes.size === 0) {
    return createEmptySubscriptionFlags();
  }

  const subscriptions = await getSubscriptionsCollection()
    .find({ scope_hash: { $in: Array.from(hashes) } })
    .project({ scope_hash: 1 })
    .toArray();

  const activeHashes = new Set(subscriptions.map((doc) => doc.scope_hash));

  const storeFlags = new Map();
  for (const [storeId, hash] of storeHashMap) {
    storeFlags.set(storeId, activeHashes.has(hash));
  }

  const productTypeFlags = new Map();
  for (const [productType, hash] of productTypeHashMap) {
    productTypeFlags.set(productType, activeHashes.has(hash));
  }

  const storeProductTypeFlags = new Map();
  for (const [key, hash] of storeProductTypeHashMap) {
    storeProductTypeFlags.set(key, activeHashes.has(hash));
  }

  const productFlags = new Map();
  for (const [key, hash] of productHashMap) {
    productFlags.set(key, activeHashes.has(hash));
  }

  return {
    store: storeFlags,
    productType: productTypeFlags,
    storeProductType: storeProductTypeFlags,
    product: productFlags
  };
}

export function getStoreSubscriptionFlag(flags, storeId) {
  return flags.store.get(storeId) ?? false;
}

export function getProductTypeSubscriptionFlag(flags, productType) {
  return flags.productType.get(productType) ?? false;
}

export function getStoreProductTypeSubscriptionFlag(flags, storeId, productType) {
  const key = `${storeId}:${productType}`;
  return flags.storeProductType.get(key) ?? false;
}

export function getProductSubscriptionFlag(flags, storeId, productId) {
  const key = `${storeId}:${productId}`;
  return flags.product.get(key) ?? false;
}

