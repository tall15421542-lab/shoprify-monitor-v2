import { connect, close } from './database/connection.js';
import { initializeIndexes } from './database/models.js';
import { initializeAnalyticsSchema } from './database/analytics-schema.js';
import { pollAllStores } from './services/poller.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { startTriggerServer } from './api/server.js';
import { config } from './config/config.js';

/**
 * Main application entry point
 */
async function main() {
  try {
    console.log('🛍️  Shopify Monitor v2');
    console.log('='.repeat(60));

    // Connect to database
    await connect();
    await initializeIndexes();
    
    // Initialize analytics schema
    console.log('\n📊 Initializing analytics...');
    await initializeAnalyticsSchema();
    
    // Start analytics services
    // Note: Price snapshots are now written directly during product upsert
    // No separate transformer service is needed
    
    // Start aggregation scheduler
    startScheduler();
    
    console.log('✓ Analytics services initialized\n');

    // Start HTTP API server for trigger endpoints
    await startTriggerServer(config.trigger.port);
    console.log(`✓ Trigger API server started on port ${config.trigger.port}\n`);

    // Poll all stores once
    await pollAllStores();

    // If polling interval is set, schedule continuous polling
    const pollingInterval = config.polling.defaultInterval * 1000;
    if (pollingInterval > 0) {
      console.log(`\n⏰ Scheduling next poll in ${config.polling.defaultInterval} seconds...\n`);

      setInterval(async () => {
        try {
          await pollAllStores();
          console.log(`\n⏰ Next poll in ${config.polling.defaultInterval} seconds...\n`);
        } catch (error) {
          console.error('Polling error:', error.message);
        }
      }, pollingInterval);
    } else {
      // One-time poll, exit
      await close();
      console.log('\n✓ Polling complete. Exiting...');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    await close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  console.log('Stopping analytics services...');
  stopScheduler();
  await close();
  console.log('✓ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  console.log('Stopping analytics services...');
  stopScheduler();
  await close();
  console.log('✓ Shutdown complete');
  process.exit(0);
});

main();
