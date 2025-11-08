import { connect, close } from './database/connection.js';
import { initializeIndexes } from './database/models.js';
import { pollAllStores } from './services/poller.js';
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
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  await close();
  process.exit(0);
});

main();
