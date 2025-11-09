import { connect, close } from './database/connection.js';
import { startServer } from './api/server.js';

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'shopify_monitor';

let server;

/**
 * Start the backend API server
 */
async function start() {
  try {
    console.log('🚀 Starting Shopify Monitor Backend API...\n');

    // Connect to MongoDB
    console.log(`Connecting to MongoDB...`);
    await connect(MONGODB_URI, MONGODB_DB_NAME);

    // Start Express server
    console.log(`\nStarting API server on port ${PORT}...`);
    server = await startServer(PORT);

    console.log('\n✅ Backend API is ready!\n');
    console.log(`API Endpoints:`);
    console.log(`  - Health Check: http://localhost:${PORT}/health`);
    console.log(`  - Stores: http://localhost:${PORT}/stores`);
    console.log(`  - Products: http://localhost:${PORT}/stores/:storeId/products`);
    console.log(`  - Price History: http://localhost:${PORT}/products/:productId/price-history`);
    console.log(`  - Analytics: http://localhost:${PORT}/analytics/*`);
    console.log(`  - Changelogs: http://localhost:${PORT}/changelogs/*`);
    console.log(`\nManual Trigger Endpoints:`);
    console.log(`  - Poll Store: POST http://localhost:${PORT}/api/poll/store/:storeId`);
    console.log(`  - Poll All Stores: POST http://localhost:${PORT}/api/poll/all`);
    console.log(`  - Aggregate (custom window): POST http://localhost:${PORT}/api/aggregate`);
    console.log(`  - Aggregate (current hour): POST http://localhost:${PORT}/api/aggregate/current`);
    console.log();

  } catch (error) {
    console.error('❌ Failed to start backend API:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n\n🛑 Shutting down gracefully...');

  try {
    // Close server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('✓ Server closed');
    }

    // Close database connection
    await close();

    console.log('✓ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the application
start();

