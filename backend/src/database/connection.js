import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Connect to MongoDB
 * @param {string} uri - MongoDB connection URI
 * @param {string} dbName - Database name
 * @returns {Promise<Db>} Database instance
 */
export async function connect(uri = 'mongodb://localhost:27017', dbName = 'shopify_monitor') {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log(`✓ Connected to MongoDB: ${dbName}`);
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Get database instance
 * @returns {Db} Database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

/**
 * Get MongoDB client instance
 * @returns {MongoClient} MongoDB client instance
 */
export function getClient() {
  if (!client) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return client;
}

/**
 * Close database connection
 */
export async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✓ Disconnected from MongoDB');
  }
}

