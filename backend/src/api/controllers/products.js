import { ObjectId } from 'mongodb';
import { getDb } from '../../database/connection.js';
import {
  getProductSubscriptionFlag,
  getProductTypeSubscriptionFlag,
  getStoreProductTypeSubscriptionFlag,
  getStoreSubscriptionFlag,
  loadSubscriptionFlags
} from '../../services/subscription-flags.js';

/**
 * Get all products for a specific store
 * GET /stores/:storeId/products
 */
export async function getStoreProducts(req, res, next) {
  try {
    const { storeId } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(storeId)) {
      return res.status(400).json({
        error: 'Invalid store ID format'
      });
    }

    const db = getDb();
    const stores = db.collection('stores');
    const products = db.collection('products');

    // Check if store exists
    const store = await stores.findOne({ _id: new ObjectId(storeId) });
    if (!store) {
      return res.status(404).json({
        error: 'Store not found'
      });
    }

    // Get all products for this store
    const storeProducts = await products
      .find({ store_id: new ObjectId(storeId) })
      .sort({ last_polled_at: -1 })
      .toArray();

    const storeIdString = storeId;
    const productIdList = storeProducts
      .map((product) => product?._id?.toString())
      .filter((value) => typeof value === 'string');

    const productTypeSet = new Set();
    const storeProductTypeKeys = new Set();

    for (const product of storeProducts) {
      const productType = typeof product?.product_type === 'string' && product.product_type.trim() !== ''
        ? product.product_type
        : null;

      if (productType) {
        productTypeSet.add(productType);
        storeProductTypeKeys.add(`${storeIdString}::${productType}`);
      }
    }

    const storeProductTypes = Array.from(storeProductTypeKeys).map((key) => {
      const separatorIndex = key.indexOf('::');
      return {
        storeId: key.slice(0, separatorIndex),
        productType: key.slice(separatorIndex + 2)
      };
    });

    const subscriptionFlags = await loadSubscriptionFlags({
      storeIds: [storeIdString],
      productTypes: Array.from(productTypeSet),
      storeProductTypes,
      products: productIdList.map((productId) => ({
        storeId: storeIdString,
        productId
      }))
    });

    const storeSubscribed = getStoreSubscriptionFlag(subscriptionFlags, storeIdString);

    const productsWithMonitoring = storeProducts.map((product) => {
      const productId = product?._id?.toString();
      const productType = typeof product?.product_type === 'string' && product.product_type.trim() !== ''
        ? product.product_type
        : null;

      const productSubscribed = productId
        ? getProductSubscriptionFlag(subscriptionFlags, storeIdString, productId)
        : false;

      const productTypeSubscribed = productType
        ? getProductTypeSubscriptionFlag(subscriptionFlags, productType)
        : false;

      const storeProductTypeSubscribed = productType
        ? getStoreProductTypeSubscriptionFlag(subscriptionFlags, storeIdString, productType)
        : false;

      return {
        ...product,
        monitoring: {
          store: {
            subscribed: storeSubscribed
          },
          product: {
            subscribed: productSubscribed
          },
          productType: {
            subscribed: productTypeSubscribed
          },
          storeProductType: {
            subscribed: storeProductTypeSubscribed
          }
        }
      };
    });

    res.json({
      store_id: storeId,
      store_name: store.store_name,
      count: productsWithMonitoring.length,
      products: productsWithMonitoring
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single product by ID
 * GET /products/:productId
 */
export async function getProductById(req, res, next) {
  try {
    const { productId } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({
        error: 'Invalid product ID format'
      });
    }

    const db = getDb();
    const products = db.collection('products');

    const product = await products.findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    const storeIdString = product?.store_id?.toString();
    const productIdString = product?._id?.toString();
    const productType = typeof product?.product_type === 'string' && product.product_type.trim() !== ''
      ? product.product_type
      : null;

    const subscriptionFlags = await loadSubscriptionFlags({
      storeIds: storeIdString ? [storeIdString] : [],
      productTypes: productType ? [productType] : [],
      storeProductTypes: productType && storeIdString ? [{ storeId: storeIdString, productType }] : [],
      products: storeIdString && productIdString ? [{ storeId: storeIdString, productId: productIdString }] : []
    });

    const storeSubscribed = storeIdString
      ? getStoreSubscriptionFlag(subscriptionFlags, storeIdString)
      : false;

    const productSubscribed = (storeIdString && productIdString)
      ? getProductSubscriptionFlag(subscriptionFlags, storeIdString, productIdString)
      : false;

    const productTypeSubscribed = productType
      ? getProductTypeSubscriptionFlag(subscriptionFlags, productType)
      : false;

    const storeProductTypeSubscribed = productType && storeIdString
      ? getStoreProductTypeSubscriptionFlag(subscriptionFlags, storeIdString, productType)
      : false;

    res.json({
      product: {
        ...product,
        monitoring: {
          store: {
            subscribed: storeSubscribed
          },
          product: {
            subscribed: productSubscribed
          },
          productType: {
            subscribed: productTypeSubscribed
          },
          storeProductType: {
            subscribed: storeProductTypeSubscribed
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

