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
const DEFAULT_WINDOW_COUNT = 1;
const DEFAULT_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = process.env.MONGODB_DB_NAME || 'shopify_monitor';
const DEFAULT_AGGREGATE_URL = process.env.AGGREGATE_URL || 'http://localhost:3001/aggregate';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const pollUrlInput = args.pollUrl ?? args.pollUrls ?? args.pollUrlList;
  const pollUrlValues = extractPollUrls(pollUrlInput);

  if (pollUrlValues.length === 0) {
    console.error('Error: At least one --poll-url is required.');
    process.exitCode = 1;
    return;
  }

  const normalizedPollUrls = [];
  for (const pollUrl of pollUrlValues) {
    try {
      normalizedPollUrls.push(normalizeStoreUrl(pollUrl));
    } catch (error) {
      console.error(`Invalid poll URL "${pollUrl}": ${error.message}`);
    }
  }

  if (normalizedPollUrls.length === 0) {
    console.error('Error: No valid --poll-url values provided.');
    process.exitCode = 1;
    return;
  }

  const limitArg = getLastValue(args.limit);
  const pageArg = getLastValue(args.page);
  const adjustRangeArg = getLastValue(args.adjustPriceRange);
  const ratioArg = getLastValue(args.ratioOfMock);
  const windowCountArg = getLastValue(
    args.windowCount ?? args.repeat ?? args.iterations ?? args.repeatCount ?? args.count
  );
  const mongoUriArg = getLastValue(args.mongoUri);
  const dbNameArg = getLastValue(args.dbName);
  const aggregateUrlArg = getLastValue(args.aggregateUrl);

  const sharedConfig = {
    limit: Number.isFinite(limitArg) ? limitArg : DEFAULT_LIMIT,
    page: Number.isFinite(pageArg) ? pageArg : DEFAULT_PAGE,
    adjustRange: Number.isFinite(adjustRangeArg) ? adjustRangeArg : DEFAULT_PRICE_RANGE,
    ratio: clampRatio(ratioArg ?? DEFAULT_RATIO),
    windowCount: normalizeWindowCount(windowCountArg ?? DEFAULT_WINDOW_COUNT),
    mongoUri: typeof mongoUriArg === 'string' && mongoUriArg.length > 0 ? mongoUriArg : DEFAULT_MONGO_URI,
    dbName: typeof dbNameArg === 'string' && dbNameArg.length > 0 ? dbNameArg : DEFAULT_DB_NAME,
    aggregateUrl: typeof aggregateUrlArg === 'string' && aggregateUrlArg.length > 0
      ? aggregateUrlArg
      : DEFAULT_AGGREGATE_URL
  };

  let client;
  let encounteredError = false;

  const aggregateWindows = new Set();

  try {
    client = new MongoClient(sharedConfig.mongoUri);
    await client.connect();
    const db = client.db(sharedConfig.dbName);

    for (const pollUrl of normalizedPollUrls) {
      console.log(`\n=== Generating mock data for ${pollUrl} ===`);
      try {
        const windowStarts = await generateMockDataForStore(db, { ...sharedConfig, pollUrl });
        if (Array.isArray(windowStarts)) {
          for (const windowStart of windowStarts) {
            if (windowStart instanceof Date && !Number.isNaN(windowStart.getTime())) {
              aggregateWindows.add(windowStart.toISOString());
            }
          }
        }
      } catch (error) {
        encounteredError = true;
        console.error(`[${pollUrl}] Mock data generation failed:`, error);
      }
    }
  } catch (error) {
    console.error('Mock data generation failed:', error);
    process.exitCode = 1;
    return;
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }

  if (aggregateWindows.size > 0) {
    const sortedWindowStarts = Array.from(aggregateWindows).sort();
    for (const iso of sortedWindowStarts) {
      const windowStart = new Date(iso);
      if (Number.isNaN(windowStart.getTime())) {
        continue;
      }
      const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);
      await triggerAggregate(sharedConfig.aggregateUrl, windowStart, windowEnd);
    }
  }

  if (encounteredError) {
    process.exitCode = 1;
  }
}

async function generateMockDataForStore(db, config) {
  const productsPayload = await fetchProducts(config.pollUrl, config.limit, config.page);
  const products = productsPayload.products ?? [];

  if (products.length === 0) {
    console.log(`[${config.pollUrl}] No products returned from storefront. Nothing to do.`);
    return;
  }

  const windowCount = normalizeWindowCount(config.windowCount);
  console.log(
    `[${config.pollUrl}] Fetched ${products.length} products from storefront (planning ${windowCount} contiguous window(s)).`
  );

  const windowStarts = await computeWindowStarts(db, config.pollUrl, windowCount);

  if (windowStarts.length === 0) {
    console.warn(`[${config.pollUrl}] Unable to determine window schedule. Skipping.`);
    return [];
  }

  console.log(
    `[${config.pollUrl}] Window schedule prepared: ${windowStarts
      .map((date) => date.toISOString())
      .join(' -> ')}`
  );

  await processProductPlansForWindows(db, config, {
    products,
    windowStarts
  });

  return windowStarts;
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
      assignArgValue(args, toCamelCase(key), true);
      continue;
    }
    assignArgValue(args, toCamelCase(key), parseArgValue(next));
    i += 1;
  }
  return args;
}

function assignArgValue(args, key, value) {
  if (Object.prototype.hasOwnProperty.call(args, key)) {
    const existing = args[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      args[key] = [existing, value];
    }
  } else {
    args[key] = value;
  }
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

function normalizeWindowCount(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WINDOW_COUNT;
  }
  return Math.floor(parsed);
}

function extractPollUrls(input) {
  if (Array.isArray(input)) {
    return input.flatMap((value) => extractPollUrls(value));
  }
  if (typeof input !== 'string') {
    return [];
  }
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getLastValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[value.length - 1] : undefined;
  }
  return value;
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

async function computeWindowStarts(db, pollUrl, windowCount) {
  if (!Number.isFinite(windowCount) || windowCount <= 0) {
    return [];
  }

  const windowStarts = [];
  const firstWindowStart = await computeNextWindowFromDb(db, pollUrl);
  if (!(firstWindowStart instanceof Date) || Number.isNaN(firstWindowStart.getTime())) {
    return [];
  }
  windowStarts.push(firstWindowStart);

  for (let index = 1; index < windowCount; index += 1) {
    const previous = windowStarts[index - 1];
    const next = new Date(previous.getTime() + 60 * 60 * 1000);
    windowStarts.push(next);
  }

  return windowStarts;
}

async function processProductPlansForWindows(db, config, payload) {
  const { products, windowStarts } = payload;
  const finalWindowStart = windowStarts[windowStarts.length - 1];
  const storeDoc = await ensureStore(db, config.pollUrl, windowStarts[0]);

  const plans = buildProductPlans(products, {
    store: storeDoc,
    adjustRange: config.adjustRange,
    ratio: config.ratio,
    windowStarts
  });

  if (plans.length === 0) {
    console.log(`[${config.pollUrl}] No product plans generated. Nothing to persist.`);
    return;
  }

  const productIds = plans.map((plan) => plan.productId);

  const productsCollection = db.collection('products');
  const existingProducts = await productsCollection
    .find({ store_id: storeDoc._id, product_id: { $in: productIds } })
    .toArray();
  const existingProductMap = new Map(existingProducts.map((doc) => [doc.product_id, doc]));

  const subscriptionsCollection = db.collection('subscriptions');
  const changeLogsCollection = db.collection('change_logs');
  const changeCountersCollection = db.collection('change_read_counters');
  const snapshotDocs = [];

  let insertedProducts = 0;
  let updatedVariants = 0;
  let totalAdjustedVariants = 0;
  let productChangeLogsInserted = 0;
  let finalWindowAdjustedVariants = 0;
  const finalWindowIndex = windowStarts.length - 1;

  for (const plan of plans) {
    const existingProduct = existingProductMap.get(plan.productId);
    let productMongoId = existingProduct?._id ?? null;

    if (!existingProduct) {
      const insertDoc = buildProductInsertDocument(plan, windowStarts);
      const insertResult = await productsCollection.insertOne(insertDoc);
      productMongoId = insertResult.insertedId;
      insertedProducts += 1;
    } else {
      const { updateDoc, modifiedVariants } = buildProductUpdateDocument(existingProduct, plan, finalWindowStart);
      await productsCollection.updateOne(
        { _id: existingProduct._id },
        { $set: updateDoc }
      );
      updatedVariants += modifiedVariants;
      productMongoId = existingProduct._id;
    }

    totalAdjustedVariants += plan.totalVariantAdjustments;
    if (plan.snapshots.length > 0) {
      snapshotDocs.push(...plan.snapshots);
    }

    finalWindowAdjustedVariants += plan.variantTimelines.reduce(
      (variantSum, timeline) => {
        const entry = timeline.history[finalWindowIndex];
        return variantSum + (entry?.adjusted ? 1 : 0);
      },
      0
    );

    let isNewProduct = !existingProduct;
    for (const summary of plan.windowSummaries) {
      const changeLogged = await maybeRecordProductChangeLog(
        {
          subscriptionsCollection,
          changeLogsCollection,
          changeCountersCollection
        },
        {
          storeId: storeDoc._id.toString(),
          storeName: storeDoc.store_name,
          productId: productMongoId ? productMongoId.toString() : String(plan.productId),
          productName: plan.productName,
          currentAverage: summary.averagePrice,
          detectedAt: summary.windowStart,
          isNewProduct,
          priceAdjusted: summary.priceAdjusted
        }
      );

      if (changeLogged) {
        productChangeLogsInserted += 1;
      }
      isNewProduct = false;
    }
  }

  if (snapshotDocs.length > 0) {
    await db.collection('price_snapshots').insertMany(snapshotDocs);
  }

  await db.collection('stores').updateOne(
    { _id: storeDoc._id },
    {
      $set: {
        last_polled_at: finalWindowStart,
        updated_at: finalWindowStart,
        active: true
      }
    }
  );

  console.log(
    `[${config.pollUrl}] Inserted products: ${insertedProducts}, variants updated: ${updatedVariants}`
  );
  console.log(
    `[${config.pollUrl}] Inserted price snapshots: ${snapshotDocs.length}, adjusted variants (all windows): ${totalAdjustedVariants}`
  );
  console.log(
    `[${config.pollUrl}] [monitoring] Product change logs inserted: ${productChangeLogsInserted}`
  );

  await verifyInserts(db, storeDoc, finalWindowStart, finalWindowAdjustedVariants);
}

function buildProductPlans(products, context) {
  const { store, adjustRange, ratio, windowStarts } = context;
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const windowSelections = windowStarts.map(() => pickProductIds(products, ratio));
  const plans = [];

  for (const product of products) {
    const tags = Array.isArray(product.tags)
      ? product.tags
      : typeof product.tags === 'string'
        ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];

    const normalizedProductType = typeof product.product_type === 'string'
      ? product.product_type.trim()
      : '';
    const hasProductType = normalizedProductType.length > 0;

    const baseInsertFields = {
      product_id: product.id,
      store_id: store._id,
      store_url: store.store_url,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor || null,
      tags,
      main_image_url: product.image?.src || null,
      raw_data: product,
      ...(hasProductType ? { product_type: normalizedProductType } : {})
    };

    const baseUpdateFields = {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor || null,
      tags,
      main_image_url: product.image?.src || null,
      raw_data: product,
      store_url: store.store_url
    };

    const variantTimelines = [];
    const variantMap = new Map();
    const variantList = Array.isArray(product.variants) ? product.variants : [];
    let totalVariantAdjustments = 0;

    for (const variant of variantList) {
      const basePrice = parseFloat(variant.price ?? variant.compare_at_price ?? '0') || 0;
      const timeline = {
        variant_id: variant.id,
        variant_title: variant.title,
        sku: variant.sku || null,
        image_url: variant.featured_image?.src || product.image?.src || null,
        basePrice,
        history: []
      };
      variantTimelines.push(timeline);
      variantMap.set(variant.id, timeline);
    }

    const windowSummaries = [];

    for (let index = 0; index < windowStarts.length; index += 1) {
      const windowStart = windowStarts[index];
      const shouldAdjustProduct = windowSelections[index].has(product.id);

      const pricesForAverage = [];
      for (const timeline of variantTimelines) {
        const entry = buildTimelineEntry(timeline, {
          windowStart,
          adjustRange,
          shouldAdjustProduct
        });
        timeline.history.push(entry);
        if (entry.adjusted) {
          totalVariantAdjustments += 1;
        }
        if (entry?.price !== null && entry?.price !== undefined) {
          pricesForAverage.push(entry.price);
        }
      }

      const averagePrice = pricesForAverage.length > 0
        ? Number((pricesForAverage.reduce((sum, value) => sum + value, 0) / pricesForAverage.length).toFixed(2))
        : null;

      windowSummaries.push({
        windowStart,
        averagePrice,
        priceAdjusted: shouldAdjustProduct
      });
    }

    const snapshots = [];
    for (const timeline of variantTimelines) {
      for (const entry of timeline.history) {
        if (!entry.adjusted) {
          continue;
        }
        const snapshotMetadata = {
          store_id: store._id,
          product_id: product.id,
          variant_id: timeline.variant_id,
          tags
        };
        if (hasProductType) {
          snapshotMetadata.product_type = normalizedProductType;
        }
        snapshots.push({
          timestamp: entry.recorded_at,
          price: entry.price,
          store_name: store.store_name,
          metadata: snapshotMetadata
        });
      }
    }

    plans.push({
      productId: product.id,
      productName: product.title,
      baseInsertFields,
      baseUpdateFields,
      variantTimelines,
      windowSummaries,
      totalVariantAdjustments,
      snapshots
    });
  }

  return plans;
}

function buildTimelineEntry(timeline, options) {
  const { windowStart, adjustRange, shouldAdjustProduct } = options;
  const basePrice = timeline.basePrice;
  let price = basePrice;
  let adjusted = false;

  if (shouldAdjustProduct && basePrice > 0) {
    const delta = (Math.random() * 2 * adjustRange) - adjustRange;
    price = roundPrice(Math.max(0, basePrice + delta));
    adjusted = true;
  }

  return {
    price,
    recorded_at: windowStart,
    adjusted
  };
}

function buildProductInsertDocument(plan, windowStarts) {
  const firstWindow = windowStarts[0];
  const finalWindow = windowStarts[windowStarts.length - 1];

  const variants = plan.variantTimelines.map((timeline) => {
    const history = timeline.history.map((entry) => ({
      price: entry.price,
      recorded_at: entry.recorded_at
    }));

    return {
      variant_id: timeline.variant_id,
      variant_title: timeline.variant_title,
      sku: timeline.sku,
      current_price: history.length > 0 ? history[history.length - 1].price : null,
      image_url: timeline.image_url,
      price_history: history
    };
  });

  return {
    ...plan.baseInsertFields,
    variants,
    created_at: firstWindow,
    updated_at: finalWindow,
    last_polled_at: finalWindow
  };
}

function buildProductUpdateDocument(existingProduct, plan, finalWindowStart) {
  const existingVariants = Array.isArray(existingProduct.variants) ? [...existingProduct.variants] : [];
  const variantIndexMap = new Map(
    existingVariants.map((variant, index) => [variant.variant_id, { variant, index }])
  );

  const updatedVariants = [...existingVariants];
  let modifiedVariants = 0;

  for (const timeline of plan.variantTimelines) {
    const timelineHistory = timeline.history.map((entry) => ({
      price: entry.price,
      recorded_at: entry.recorded_at
    }));

    const existing = variantIndexMap.get(timeline.variant_id);

    if (existing) {
      const { variant, index } = existing;
      const mergedHistory = Array.isArray(variant.price_history) ? [...variant.price_history] : [];
      let appended = 0;
      for (const entry of timelineHistory) {
        const existingEntry = mergedHistory.find((item) => {
          if (!(item?.recorded_at)) {
            return false;
          }
          const recordedAt = item.recorded_at instanceof Date ? item.recorded_at : new Date(item.recorded_at);
          return recordedAt.getTime() === entry.recorded_at.getTime();
        });

        if (!existingEntry) {
          mergedHistory.push(entry);
          appended += 1;
        }
      }

      if (appended > 0) {
        modifiedVariants += 1;
      }

      mergedHistory.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

      const latestPrice = timelineHistory.length > 0
        ? timelineHistory[timelineHistory.length - 1].price
        : variant.current_price ?? null;

      updatedVariants[index] = {
        ...variant,
        current_price: latestPrice,
        price_history: mergedHistory
      };
    } else {
      const newVariant = {
        variant_id: timeline.variant_id,
        variant_title: timeline.variant_title,
        sku: timeline.sku,
        current_price: timelineHistory.length > 0
          ? timelineHistory[timelineHistory.length - 1].price
          : null,
        image_url: timeline.image_url,
        price_history: timelineHistory
      };
      updatedVariants.push(newVariant);
      modifiedVariants += 1;
    }
  }

  const updateDoc = {
    variants: updatedVariants,
    updated_at: finalWindowStart,
    last_polled_at: finalWindowStart
  };

  return { updateDoc, modifiedVariants };
}

async function computeNextWindowFromDb(db, pollUrl) {
  const storesCollection = db.collection('stores');
  const priceSnapshotsCollection = db.collection('price_snapshots');

  const existingStore = await storesCollection.findOne(
    { store_url: pollUrl },
    { projection: { _id: 1, store_name: 1, last_polled_at: 1 } }
  );

  if (!existingStore) {
    return computeNextHourWindow();
  }

  const candidateDates = [];

  if (existingStore.last_polled_at instanceof Date && !Number.isNaN(existingStore.last_polled_at.getTime())) {
    candidateDates.push(new Date(existingStore.last_polled_at));
  }

  const snapshotQuery = [{ 'metadata.store_id': existingStore._id }];

  if (existingStore.store_name) {
    snapshotQuery.push({ store_name: existingStore.store_name });
  }

  const latestSnapshot = await priceSnapshotsCollection
    .find({ $or: snapshotQuery })
    .sort({ timestamp: -1 })
    .limit(1)
    .next();

  if (latestSnapshot?.timestamp instanceof Date && !Number.isNaN(latestSnapshot.timestamp.getTime())) {
    candidateDates.push(new Date(latestSnapshot.timestamp));
  }

  if (candidateDates.length === 0) {
    return computeNextHourWindow();
  }

  candidateDates.sort((a, b) => b.getTime() - a.getTime());
  const next = new Date(candidateDates[0]);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

async function ensureStore(db, pollUrl, windowStart) {
  const stores = db.collection('stores');
  const existing = await stores.findOne({ store_url: pollUrl });
  if (existing) {
    const nextStoreName = existing.store_name || new URL(pollUrl).hostname;
    await stores.updateOne(
      { _id: existing._id },
      {
        $set: {
          last_polled_at: windowStart,
          updated_at: windowStart,
          active: true,
          store_name: nextStoreName
        },
        $setOnInsert: {
          created_at: windowStart
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
    created_at: windowStart,
    updated_at: windowStart,
    last_polled_at: windowStart
  };
  await stores.insertOne(storeDoc);
  return storeDoc;
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

async function triggerAggregate(aggregateUrl, windowStart, windowEndOverride) {
  const windowEnd = windowEndOverride ?? new Date(windowStart.getTime() + 60 * 60 * 1000);
  try {
    const response = await fetch(aggregateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
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

async function verifyInserts(db, store, windowStart, adjustedVariants) {
  const products = db.collection('products');
  const snapshots = db.collection('price_snapshots');

  const totalProducts = await products.countDocuments({ store_id: store._id });
  const windowSnapshots = await snapshots.countDocuments({ store_name: store.store_name, timestamp: windowStart });

  const sampleProducts = await products
    .find({ store_id: store._id })
    .sort({ updated_at: -1 })
    .limit(3)
    .project({ product_id: 1, title: 1, 'variants.current_price': 1 })
    .toArray();

  console.log('Verification Summary:');
  console.log(`- Total products for store: ${totalProducts}`);
  console.log(`- Snapshots at window ${windowStart.toISOString()}: ${windowSnapshots}`);
  console.log(`- Adjusted variants inserted: ${adjustedVariants}`);
  console.log('- Sample products:');
  for (const doc of sampleProducts) {
    console.log(`  · ${doc.product_id} "${doc.title}" variant prices -> ${doc.variants.map((v) => v.current_price).join(', ')}`);
  }
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
    read_at: isBaseline ? detectedAt : null,
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
          $set: { updated_at: detectedAt },
          $setOnInsert: { unread_count: 0 }
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
        $set: { updated_at: detectedAt },
        $setOnInsert: { unread_count: 0 }
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

