import cron from 'node-cron';
import {
  aggregateStoreAverages,
  aggregateTagAverages,
  aggregateStoreTagAverages
} from './aggregator.js';

let scheduledTask = null;
let isRunning = false;

/**
 * Calculate the time window for the previous hour
 * @returns {Object} { windowStart, windowEnd }
 */
export function getPreviousHourWindow() {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setMinutes(0, 0, 0); // Round down to the start of current hour
  
  const windowStart = new Date(windowEnd);
  windowStart.setHours(windowStart.getHours() - 1); // Go back one hour
  
  return { windowStart, windowEnd };
}

/**
 * Run all aggregations for a specific time window
 * @param {Date} windowStart - Start of the hour window
 * @param {Date} windowEnd - End of the hour window
 */
export async function runAggregations(windowStart, windowEnd) {
  console.log(`\n🔄 Starting aggregations for window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
  
  try {
    // Run all three aggregations
    const storeCount = await aggregateStoreAverages(windowStart, windowEnd);
    const tagCount = await aggregateTagAverages(windowStart, windowEnd);
    const storeTagCount = await aggregateStoreTagAverages(windowStart, windowEnd);
    
    console.log(`✅ Aggregation completed successfully:`);
    console.log(`   - ${storeCount} store averages`);
    console.log(`   - ${tagCount} tag averages`);
    console.log(`   - ${storeTagCount} store-tag averages\n`);
    
    return {
      success: true,
      storeCount,
      tagCount,
      storeTagCount
    };
  } catch (error) {
    console.error(`❌ Aggregation failed for window ${windowStart.toISOString()}:`, error.message);
    console.error(error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manually trigger aggregation for the previous hour
 * Useful for testing and manual replay
 */
export async function triggerManualAggregation() {
  const { windowStart, windowEnd } = getPreviousHourWindow();
  return await runAggregations(windowStart, windowEnd);
}

/**
 * Start the scheduled aggregation job
 * Runs at the top of every hour (e.g., 10:00, 11:00, 12:00)
 */
export function startScheduler() {
  if (isRunning) {
    console.log('Scheduler is already running');
    return;
  }
  
  // Schedule job to run at the top of every hour
  // Cron pattern: '0 * * * *' = at minute 0 of every hour
  scheduledTask = cron.schedule('0 * * * *', async () => {
    const { windowStart, windowEnd } = getPreviousHourWindow();
    await runAggregations(windowStart, windowEnd);
  });
  
  isRunning = true;
  console.log('✓ Scheduler started - aggregations will run at the top of every hour');
}

/**
 * Stop the scheduled aggregation job
 */
export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    // Destroy the task to prevent it from keeping the process alive
    if (typeof scheduledTask.destroy === 'function') {
      scheduledTask.destroy();
    }
    scheduledTask = null;
    isRunning = false;
    console.log('✓ Scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning() {
  return isRunning;
}

