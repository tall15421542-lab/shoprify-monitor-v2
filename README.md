# Shopify Monitor v2

A Node.js application that monitors Shopify stores for product and price changes, storing historical data in MongoDB.

## Features

- Polls multiple Shopify stores for product data
- Tracks price history for all product variants
- Embedded document design for efficient queries
- Records price on every poll for complete historical tracking
- Configurable polling intervals
- Comprehensive test suite

## Installation

```bash
npm install
```

## Prerequisites

- Node.js 18+
- MongoDB (running locally or via Docker)

### Start MongoDB with Docker

```bash
docker run -d --name shopify-mongo -p 27017:27017 mongo:7
```

## Usage

### Add a Store

First, insert a store into the database:

```javascript
import { connect, close } from './src/database/connection.js';
import { initializeIndexes } from './src/database/models.js';
import { insertStore } from './src/database/operations.js';

await connect();
await initializeIndexes();

await insertStore({
  store_url: 'https://mous.co',
  store_name: 'Mous',
  active: true,
  polling_interval: 60
});

await close();
```

### Run the Monitor

```bash
npm start
```

This will:
1. Connect to MongoDB
2. Create indexes
3. Poll all active stores
4. Continue polling at configured intervals

### Environment Variables

- `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017`)
- `MONGODB_DB_NAME` - Database name (default: `shopify_monitor`)

## Testing

The project includes comprehensive unit, integration, and end-to-end tests.

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Unit tests (parser only - fast, no external dependencies)
npm run test:unit

# Integration tests (fetcher + database - requires MongoDB + network)
npm run test:integration

# End-to-end tests (full polling cycle - requires MongoDB + network)
npm run test:e2e
```

## Database Schema

### Stores Collection

```javascript
{
  _id: ObjectId,
  store_url: "https://mous.co",
  store_name: "Mous",
  active: true,
  polling_interval: 60,
  created_at: ISODate,
  last_polled_at: ISODate
}
```

### Products Collection

```javascript
{
  _id: ObjectId,
  product_id: 6655824986170,
  store_id: ObjectId,
  handle: "iphone-15-pro-max-case",
  title: "iPhone 15 Pro Max Case",
  product_type: "Phone Cases",
  vendor: "Mous",
  tags: ["iPhone", "Case"],
  main_image_url: "https://...",
  created_at: ISODate,
  updated_at: ISODate,
  last_polled_at: ISODate,

  variants: [
    {
      variant_id: 39491972595770,
      variant_title: "Black - Aramid Fibre",
      current_price: 49.99,
      image_url: "https://...",
      price_history: [
        { price: 59.99, recorded_at: ISODate },
        { price: 49.99, recorded_at: ISODate }
      ]
    }
  ],

  raw_data: { /* Full Shopify JSON */ }
}
```

## Key Design Decisions

1. **Embedded Documents**: Variants and price history are embedded in the product document for fast reads and simple queries
2. **Complete Price History**: Appends to price history on every poll for complete historical tracking
3. **Upsert Strategy**: Products are upserted on each poll - new products inserted, existing products updated
4. **Raw Data Preservation**: Full Shopify JSON stored for future extensibility
5. **Indexes**: Created on commonly queried fields (product_id, store_id, variant_id, handle)

## License

MIT
