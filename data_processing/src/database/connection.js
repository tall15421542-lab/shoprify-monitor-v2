import { MongoClient } from 'mongodb';
import { config } from '../config/config.js';

let client = null;
let db = null;

/**
 * Connect to MongoDB
 */
export async function connect(uri = config.mongodb.uri, dbName = config.mongodb.dbName) {
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
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
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
