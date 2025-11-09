import storesRouter from './stores.js';
import productsRouter from './products.js';
import priceHistoryRouter from './price-history.js';
import analyticsRouter from './analytics.js';
import changelogsRouter from './changelogs.js';
import triggerRouter from './triggers.js';
import tagsRouter from './tags.js';
import productTypesRouter from './product-types.js';

/**
 * Register all API routes
 * @param {express.Application} app - Express application
 */
export function registerRoutes(app) {
  // API routes
  app.use('/stores', storesRouter);
  app.use('/', productsRouter); // Products routes include both /stores/:storeId/products and /products/:productId
  app.use('/', priceHistoryRouter);
  app.use('/', analyticsRouter);
  app.use('/', changelogsRouter);
  app.use('/', triggerRouter); // Poll and aggregate trigger routes via HTTP client (mounted at root like other routes)
  app.use('/', tagsRouter); // Tags routes
  app.use('/', productTypesRouter); // Product types routes
}

