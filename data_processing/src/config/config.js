export const config = {
  // MongoDB configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'shopify_monitor'
  },

  // Polling configuration
  polling: {
    defaultInterval: 3600 // seconds
  },

  // Trigger API configuration
  trigger: {
    port: parseInt(process.env.TRIGGER_PORT) || 3001
  }
};
