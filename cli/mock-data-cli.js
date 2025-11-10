#!/usr/bin/env node

/**
 * CLI tool to generate mock Shopify data for the monitoring system.
 *
 * Flow:
 * 1. Fetch products from the public Shopify storefront endpoint.
 * 2. Randomly select a portion of products and adjust variant prices within a range.
 * 3. Upsert products into the `products` collection with timestamps aligned to the next hour window.
 * 4. Insert corresponding entries into the `price_snapshots` time-series collection.
 * 5. Trigger the aggregate endpoint to refresh analytics.
 * 6. Verify inserts by querying the database and logging a concise summary.
 *
 * The tool is intentionally standalone and does not reuse code from existing packages.
 */

import process from 'node:process';
import { URL } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';

const DEFAULT_LIMIT = 250;
const DEFAULT_PAGE = 1;
const DEFAULT_PRICE_RANGE = 5;
const DEFAULT_RATIO = 0.2;
const DEFAULT_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = process.env.MONGODB_DB_NAME || 'shopify_monitor';
const DEFAULT_AGGREGATE_URL = process.env.AGGREGATE_URL || 'http://localhost:3001/aggregate';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.pollUrl) {
    console.error('Error: --poll-url is required.');
    process.exitCode = 1;
    return;
  }

  const config = {
    pollUrl: normalizeStoreUrl(args.pollUrl),
    limit: Number.isFinite(args.limit) ? args.limit : DEFAULT_LIMIT,
    page: Number.isFinite(args.page) ? args.page : DEFAULT_PAGE,
    adjustRange: Number.isFinite(args.adjustPriceRange) ? args.adjustPriceRange : DEFAULT_PRICE_RANGE,
    ratio: clampRatio(args.ratioOfMock ?? DEFAULT_RATIO),
    mongoUri: args.mongoUri || DEFAULT_MONGO_URI,
    dbName: args.dbName || DEFAULT_DB_NAME,
    aggregateUrl: args.aggregateUrl || DEFAULT_AGGREGATE_URL
  };

  let client;
  try {
    const productsPayload = await fetchProducts(config.pollUrl, config.limit, config.page);
    const products = productsPayload.products ?? [];
    if (products.length === 0) {
      console.log('No products returned from storefront. Nothing to do.');
      return;
    }

    const selectedIds = pickProductIds(products, config.ratio);
    console.log(`Fetched ${products.length} products. Adjusting ${selectedIds.size} of them.`);

    client = new MongoClient(config.mongoUri);
    await client.connect();
    const db = client.db(config.dbName);

    const nextWindow = await computeNextWindowFromDb(db, config.pollUrl);
    console.log(`Using next window ${nextWindow.toISOString()} for mock data insert.`);

    const storeDoc = await ensureStore(db, config.pollUrl, nextWindow);

    const productsCollection = db.collection('products');
    const subscriptionsCollection = db.collection('subscriptions');
    const changeLogsCollection = db.collection('change_logs');
    const changeCountersCollection = db.collection('change_read_counters');
    const snapshotDocs = [];
    let adjustedVariants = 0;
    let insertedProducts = 0;
    let updatedVariants = 0;
    let productChangeLogsInserted = 0;

    for (const product of products) {
      const shouldAdjust = selectedIds.has(product.id);
      const {
        productDoc,
        variantDocs,
        snapshots,
        variantAdjustmentCount
      } = transformProduct(product, {
        store: storeDoc,
        adjustRange: config.adjustRange,
        shouldAdjust,
        nextWindow
      });

      const existingProduct = await productsCollection.findOne({
        store_id: storeDoc._id,
        product_id: productDoc.product_id
      });

      let productMongoId = existingProduct?._id ?? null;
      let currentAverage = null;

      if (!existingProduct) {
        const insertResult = await productsCollection.insertOne(productDoc);
        productMongoId = insertResult.insertedId;
        insertedProducts += 1;
        currentAverage = computeAveragePriceFromVariants(productDoc.variants);
      } else {
        updatedVariants += await updateExistingProduct(productsCollection, existingProduct, variantDocs);
        const refreshedProduct = await productsCollection.findOne(
          { _id: existingProduct._id },
          { projection: { variants: 1 } }
        );
        const variantsSnapshot = refreshedProduct?.variants ?? existingProduct.variants ?? [];
        currentAverage = computeAveragePriceFromVariants(variantsSnapshot);
      }

      const productIdForSubscription = productMongoId ? productMongoId.toString() : String(productDoc.product_id);

      if (snapshots.length > 0) {
        snapshotDocs.push(...snapshots);
        adjustedVariants += variantAdjustmentCount;
      }

      const changeLogged = await maybeRecordProductChangeLog(
        {
          subscriptionsCollection,
          changeLogsCollection,
          changeCountersCollection
        },
        {
          storeId: storeDoc._id.toString(),
          storeName: storeDoc.store_name,
          productId: productIdForSubscription,
          productName: existingProduct?.title ?? productDoc.title,
          currentAverage,
          detectedAt: nextWindow,
          isNewProduct: !existingProduct,
          priceAdjusted: shouldAdjust
        }
      );

      if (changeLogged) {
        productChangeLogsInserted += 1;
      }
    }

    if (snapshotDocs.length > 0) {
      await db.collection('price_snapshots').insertMany(snapshotDocs);
    }

    console.log(`Inserted products: ${insertedProducts}, variants updated: ${updatedVariants}`);
    console.log(`Inserted price snapshots: ${snapshotDocs.length}, adjusted variants: ${adjustedVariants}`);
    console.log(`[monitoring] Product change logs inserted: ${productChangeLogsInserted}`);

    await triggerAggregate(config.aggregateUrl, nextWindow);

    await verifyInserts(db, storeDoc, nextWindow, adjustedVariants);
  } catch (error) {
    console.error('Mock data generation failed:', error);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[toCamelCase(key)] = true;
      continue;
    }
    args[toCamelCase(key)] = parseArgValue(next);
    i += 1;
  }
  return args;
}

function parseArgValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}

function toCamelCase(flag) {
  return flag.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function normalizeStoreUrl(input) {
  try {
    const parsed = new URL(input);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid poll URL: ${input}`);
  }
}

function clampRatio(ratio) {
  if (typeof ratio !== 'number' || Number.isNaN(ratio)) {
    return DEFAULT_RATIO;
  }
  if (ratio <= 0) return DEFAULT_RATIO;
  if (ratio > 1) return 1;
  return ratio;
}

async function fetchProducts(baseUrl, limit, page) {
  const endpoint = `${baseUrl}/products.json?limit=${limit}&page=${page}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch products (${response.status} ${response.statusText}) from ${endpoint}`);
  }
  return response.json();
}

function pickProductIds(products, ratio) {
  const count = Math.max(1, Math.floor(products.length * ratio));
  const shuffled = [...products];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return new Set(shuffled.slice(0, count).map((product) => product.id));
}

function computeNextHourWindow() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

async function computeNextWindowFromDb(db, pollUrl) {
  const storesCollection = db.collection('stores');
  const priceSnapshotsCollection = db.collection('price_snapshots');
  const productsCollection = db.collection('products');

  const existingStore = await storesCollection.findOne(
    { store_url: pollUrl },
    { projection: { _id: 1, last_polled_at: 1 } }
  );

  const candidates = [];

  if (existingStore?.last_polled_at instanceof Date && !Number.isNaN(existingStore.last_polled_at.getTime())) {
    candidates.push(new Date(existingStore.last_polled_at));
  }

  const snapshotQuery = existingStore?._id ? { 'metadata.store_id': existingStore._id } : {};
  const latestSnapshot = await priceSnapshotsCollection
    .find(snapshotQuery)
    .sort({ timestamp: -1 })
    .limit(1)
    .next();

  if (latestSnapshot?.timestamp instanceof Date && !Number.isNaN(latestSnapshot.timestamp.getTime())) {
    candidates.push(new Date(latestSnapshot.timestamp));
  }

  const productQuery = existingStore?._id ? { store_id: existingStore._id } : {};
  const latestProduct = await productsCollection
    .find(productQuery)
    .project({ updated_at: 1 })
    .sort({ updated_at: -1 })
    .limit(1)
    .next();

  if (latestProduct?.updated_at instanceof Date && !Number.isNaN(latestProduct.updated_at.getTime())) {
    candidates.push(new Date(latestProduct.updated_at));
  }

  if (candidates.length === 0) {
    return computeNextHourWindow();
  }

  candidates.sort((a, b) => b.getTime() - a.getTime());
  const latest = candidates[0];
  const next = new Date(latest);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

async function ensureStore(db, pollUrl, nextWindow) {
  const stores = db.collection('stores');
  const existing = await stores.findOne({ store_url: pollUrl });
  if (existing) {
    const nextStoreName = existing.store_name || new URL(pollUrl).hostname;
    await stores.updateOne(
      { _id: existing._id },
      {
        $set: {
          last_polled_at: nextWindow,
          updated_at: nextWindow,
          active: true,
          store_name: nextStoreName
        },
        $setOnInsert: {
          created_at: nextWindow
        }
      }
    );
    return { ...existing, store_name: nextStoreName };
  }

  const parsed = new URL(pollUrl);
  const storeDoc = {
    _id: new ObjectId(),
    store_url: pollUrl,
    store_name: parsed.hostname,
    poll_interval: 3600,
    active: true,
    created_at: nextWindow,
    updated_at: nextWindow,
    last_polled_at: nextWindow
  };
  await stores.insertOne(storeDoc);
  return storeDoc;
}

function transformProduct(product, { store, adjustRange, shouldAdjust, nextWindow }) {
  const tags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === 'string'
      ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

  const productDoc = {
    product_id: product.id,
    store_id: store._id,
    store_url: store.store_url,
    handle: product.handle,
    title: product.title,
    product_type: product.product_type || null,
    vendor: product.vendor || null,
    tags,
    main_image_url: product.image?.src || null,
    created_at: nextWindow,
    updated_at: nextWindow,
    last_polled_at: nextWindow,
    raw_data: product,
    variants: []
  };

  const snapshots = [];
  let variantAdjustmentCount = 0;
  const variantDocs = [];

  for (const variant of product.variants || []) {
    const basePrice = parseFloat(variant.price ?? variant.compare_at_price ?? '0') || 0;
    let adjustedPrice = basePrice;

    if (shouldAdjust && basePrice > 0) {
      const delta = (Math.random() * 2 * adjustRange) - adjustRange;
      adjustedPrice = roundPrice(Math.max(0, basePrice + delta));
      variantAdjustmentCount += 1;
    }

    const variantDoc = {
      variant_id: variant.id,
      variant_title: variant.title,
      sku: variant.sku || null,
      current_price: adjustedPrice,
      image_url: variant.featured_image?.src || product.image?.src || null,
      price_history: [
        {
          price: adjustedPrice,
          recorded_at: nextWindow
        }
      ]
    };

    productDoc.variants.push(variantDoc);
    variantDocs.push(variantDoc);

    if (shouldAdjust) {
      snapshots.push({
        timestamp: nextWindow,
        price: adjustedPrice,
        store_name: store.store_name,
        metadata: {
          store_id: store._id,
          product_id: product.id,
          variant_id: variant.id,
          product_type: product.product_type || null,
          tags
        }
      });
    }
  }

  return {
    productDoc,
    variantDocs,
    snapshots,
    variantAdjustmentCount
  };
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

async function triggerAggregate(aggregateUrl, nextWindow) {
  try {
    const response = await fetch(aggregateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowStart: nextWindow.toISOString(),
        windowEnd: new Date(nextWindow.getTime() + 60 * 60 * 1000).toISOString()
      })
    });

    if (!response.ok) {
      console.warn(`Aggregate trigger responded with ${response.status}: ${response.statusText}`);
      return;
    }

    console.log('Aggregate endpoint triggered successfully.');
  } catch (error) {
    console.warn(`Failed to trigger aggregate endpoint: ${error.message}`);
  }
}

async function verifyInserts(db, store, nextWindow, adjustedVariants) {
  const products = db.collection('products');
  const snapshots = db.collection('price_snapshots');

  const totalProducts = await products.countDocuments({ store_id: store._id });
  const windowSnapshots = await snapshots.countDocuments({ store_name: store.store_name, timestamp: nextWindow });

  const sampleProducts = await products
    .find({ store_id: store._id })
    .sort({ updated_at: -1 })
    .limit(3)
    .project({ product_id: 1, title: 1, 'variants.current_price': 1 })
    .toArray();

  console.log('Verification Summary:');
  console.log(`- Total products for store: ${totalProducts}`);
  console.log(`- Snapshots at window ${nextWindow.toISOString()}: ${windowSnapshots}`);
  console.log(`- Adjusted variants inserted: ${adjustedVariants}`);
  console.log('- Sample products:');
  for (const doc of sampleProducts) {
    console.log(`  · ${doc.product_id} "${doc.title}" variant prices -> ${doc.variants.map((v) => v.current_price).join(', ')}`);
  }
}

function computeAveragePriceFromVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  const prices = variants
    .map((variant) => {
      if (typeof variant?.current_price === 'number') {
        return variant.current_price;
      }
      if (typeof variant?.price === 'number') {
        return variant.price;
      }
      return null;
    })
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (prices.length === 0) {
    return null;
  }

  const total = prices.reduce((sum, value) => sum + value, 0);
  return Number((total / prices.length).toFixed(2));
}

function roundToTwo(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(2));
}

function calculateChangeMetrics(previousValue, currentValue) {
  if (
    previousValue === null ||
    previousValue === undefined ||
    currentValue === null ||
    currentValue === undefined
  ) {
    return {
      absolute_change: null,
      percentage_change: null
    };
  }

  const absoluteChange = Number((currentValue - previousValue).toFixed(2));
  const percentageChange = previousValue === 0
    ? null
    : Number(((absoluteChange / previousValue) * 100).toFixed(2));

  return {
    absolute_change: absoluteChange,
    percentage_change: percentageChange
  };
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

function buildChangeLogDocument(subscription, previousValue, currentValue, detectedAt, context, options = {}) {
  const { storeName, productName } = context;
  const { isBaseline = false } = options;
  const { absolute_change, percentage_change } = calculateChangeMetrics(previousValue, currentValue);

  return {
    subscription_id: subscription._id,
    scope_type: subscription.scope_type,
    scope_key: subscription.scope_key,
    change_type: subscription.change_type,
    previous_value: previousValue === null || previousValue === undefined ? null : roundToTwo(previousValue),
    current_value: currentValue === null || currentValue === undefined ? null : roundToTwo(currentValue),
    absolute_change,
    percentage_change,
    detected_at: detectedAt,
    read_at: null,
    is_baseline: isBaseline,
    created_at: detectedAt,
    store_name: storeName ?? null,
    product_name: productName ?? null
  };
}

async function maybeRecordProductChangeLog(collections, payload) {
  const {
    subscriptionsCollection,
    changeLogsCollection,
    changeCountersCollection
  } = collections;
  const {
    storeId,
    storeName,
    productId,
    productName,
    currentAverage,
    detectedAt,
    isNewProduct,
    priceAdjusted
  } = payload;

  const storeLabel = storeName ?? storeId;
  const productLabel = productName ?? productId;

  const subscriptionQuery = {
    scope_type: 'product',
    'scope_key.store_id': storeId,
    'scope_key.product_id': productId
  };

  let subscription = await subscriptionsCollection.findOne(subscriptionQuery);

  if (!subscription && ObjectId.isValid(productId)) {
    subscription = await subscriptionsCollection.findOne({
      ...subscriptionQuery,
      'scope_key.product_id': new ObjectId(productId)
    });
  }

  if (!subscription) {
    console.log(
      `[monitoring] Skipped product change log: no subscription for ${storeLabel} - ${productLabel}.`
    );
    return false;
  }

  const context = {
    storeName: storeLabel,
    productName: productLabel
  };

  const skipLog = (reason) => {
    console.log(
      `[monitoring] Skipped product change log for subscription ${subscription._id.toString()} ` +
        `(${context.storeName} - ${context.productName}): ${reason}`
    );
  };

  const latestLog = await changeLogsCollection.findOne(
    { subscription_id: subscription._id },
    { sort: { detected_at: -1 } }
  );

  if (isNewProduct) {
    if (currentAverage === null || currentAverage === undefined) {
      skipLog('no current average available for new product');
      return false;
    }

    if (!latestLog) {
      const baselineDoc = buildChangeLogDocument(
        subscription,
        currentAverage,
        currentAverage,
        detectedAt,
        context,
        { isBaseline: true }
      );

      await changeLogsCollection.insertOne(baselineDoc);
      await changeCountersCollection.updateOne(
        { subscription_id: subscription._id },
        {
          $inc: { unread_count: 1 },
          $set: { updated_at: detectedAt }
        },
        { upsert: true }
      );
      console.log(
        `[monitoring] Created baseline change log for subscription ${subscription._id.toString()} ` +
          `(${context.storeName ?? storeId} - ${context.productName ?? productId}) at ${detectedAt.toISOString()}`
      );
      return true;
    }

    if (!priceAdjusted) {
      skipLog('product price not adjusted after baseline already exists');
      return false;
    }
  } else if (!priceAdjusted) {
    skipLog('product price not adjusted');
    return false;
  }

  if (!latestLog) {
    if (currentAverage === null || currentAverage === undefined) {
      skipLog('no current average available and no prior change log');
      return false;
    }

    const baselineDoc = buildChangeLogDocument(
      subscription,
      currentAverage,
      currentAverage,
      detectedAt,
      context,
      { isBaseline: true }
    );

    await changeLogsCollection.insertOne(baselineDoc);
    await changeCountersCollection.updateOne(
      { subscription_id: subscription._id },
      {
        $inc: { unread_count: 1 },
        $set: { updated_at: detectedAt }
      },
      { upsert: true }
    );
    console.log(
      `[monitoring] Created baseline change log for subscription ${subscription._id.toString()} ` +
        `(${context.storeName ?? storeId} - ${context.productName ?? productId}) at ${detectedAt.toISOString()}`
    );
    return true;
  }

  const previousValue = latestLog.current_value;

  if (
    previousValue === null ||
    previousValue === undefined ||
    currentAverage === null ||
    currentAverage === undefined
  ) {
    skipLog('missing previous or current value');
    return false;
  }

  if (roundToTwo(previousValue) === roundToTwo(currentAverage)) {
    skipLog(
      `values unchanged (previous=${roundToTwo(previousValue)}, current=${roundToTwo(currentAverage)})`
    );
    return false;
  }

  if (!matchesDirection(subscription, previousValue, currentAverage)) {
    skipLog(
      `change direction does not match subscription (${subscription.change_type}) ` +
        `previous=${roundToTwo(previousValue)} current=${roundToTwo(currentAverage)}`
    );
    return false;
  }

  const changeDoc = buildChangeLogDocument(
    subscription,
    previousValue,
    currentAverage,
    detectedAt,
    context
  );

  await changeLogsCollection.insertOne(changeDoc);
  await changeCountersCollection.updateOne(
    { subscription_id: subscription._id },
    {
      $inc: { unread_count: 1 },
      $set: { updated_at: detectedAt }
    },
    { upsert: true }
  );
  console.log(
    `[monitoring] Recorded change log for subscription ${subscription._id.toString()} ` +
      `(${context.storeName ?? storeId} - ${context.productName ?? productId}) ` +
      `previous=${roundToTwo(previousValue)} current=${roundToTwo(currentAverage)} ` +
      `detected_at=${detectedAt.toISOString()}`
  );

  return true;
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});

async function updateExistingProduct(collection, existingProduct, variantDocs) {
  let modifiedVariants = 0;

  for (const variantDoc of variantDocs) {
    const priceEntry = variantDoc.price_history[0];
    const existingVariant = Array.isArray(existingProduct.variants)
      ? existingProduct.variants.find((item) => item.variant_id === variantDoc.variant_id)
      : undefined;

    if (existingVariant) {
      const lastHistoryEntry = Array.isArray(existingVariant.price_history) && existingVariant.price_history.length > 0
        ? existingVariant.price_history[existingVariant.price_history.length - 1]
        : null;

      const lastTimestamp = lastHistoryEntry?.recorded_at ? new Date(lastHistoryEntry.recorded_at) : null;
      const shouldUpdatePrice = !lastTimestamp || priceEntry.recorded_at > lastTimestamp;

      const update = {
        $push: {
          'variants.$[elem].price_history': priceEntry
        }
      };

      if (shouldUpdatePrice) {
        update.$set = {
          'variants.$[elem].current_price': variantDoc.current_price
        };
      }

      const result = await collection.updateOne(
        { _id: existingProduct._id },
        update,
        { arrayFilters: [{ 'elem.variant_id': variantDoc.variant_id }] }
      );

      if (result.modifiedCount > 0) {
        modifiedVariants += 1;
      }

      // Keep in-memory representation loosely updated for subsequent comparisons
      if (shouldUpdatePrice) {
        existingVariant.current_price = variantDoc.current_price;
      }
      if (Array.isArray(existingVariant.price_history)) {
        existingVariant.price_history.push(priceEntry);
      }
    } else {
      const pushResult = await collection.updateOne(
        { _id: existingProduct._id },
        {
          $push: {
            variants: variantDoc
          }
        }
      );

      if (pushResult.modifiedCount > 0) {
        modifiedVariants += 1;
        if (!Array.isArray(existingProduct.variants)) {
          existingProduct.variants = [];
        }
        existingProduct.variants.push({
          ...variantDoc
        });
      }
    }
  }

  return modifiedVariants;
}

