# Shopify Monitor Backend API

REST API for the Shopify Monitor application. Provides endpoints for store management, product viewing, price history, analytics, and changelogs.

## Features

- **Store Management** - Add and list Shopify stores
- **Product Views** - View products from monitored stores
- **Price History** - Track price changes over time
- **Analytics** - Get average prices by store, tag, or both
- **Changelogs** - See price change history

## Prerequisites

- Node.js 18+
- MongoDB 6+
- Running MongoDB instance

## Installation

```bash
# Install dependencies (from project root)
npm install
```

## Configuration

Set environment variables (optional):

```bash
PORT=3000                                    # API server port (default: 3000)
MONGODB_URI=mongodb://localhost:27017       # MongoDB connection URI
MONGODB_DB_NAME=shopify_monitor             # Database name
```

## Running the Server

```bash
# Start the backend API server
npm run backend:start
```

The API will be available at `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Store Management
- `POST /stores` - Add a new store
- `GET /stores` - List all stores
- `GET /stores/:storeId` - Get single store

### Products
- `GET /stores/:storeId/products` - Get products for a store
- `GET /products/:productId` - Get single product

### Price History
- `GET /products/:productId/price-history` - Get price history for a product
  - Query params: `start_date`, `end_date`, `variant_id`

### Analytics
- `GET /analytics/stores/:storeId/average-price` - Average price by store
- `GET /analytics/tags/:tag/average-price` - Average price by tag
- `GET /analytics/stores/:storeId/tags/:tag/average-price` - Average price by store and tag
  - Query params: `start_date`, `end_date`, `window_hours`

### Changelogs
- `GET /changelogs/products` - Product price changes
  - Query params: `store_id`, `start_date`, `end_date`
- `GET /changelogs/stores/average-price` - Store average price changes
  - Query params: `store_id`, `start_date`, `end_date`
- `GET /changelogs/tags/average-price` - Tag average price changes
  - Query params: `tag`, `start_date`, `end_date`
- `GET /changelogs/stores/:storeId/tags/:tag/average-price` - Store-tag average changes
  - Query params: `start_date`, `end_date`

## Testing

```bash
# Run all backend tests (individually)
npm run backend:test:server
npm run backend:test:stores
npm run backend:test:products
npm run backend:test:price-history
npm run backend:test:analytics
npm run backend:test:changelogs

# Run integration test
npm run backend:test:integration
```

**Note:** Individual test files should be run separately to avoid database conflicts.

## Project Structure

```
backend/
├── src/
│   ├── main.js                  # Application entry point
│   ├── database/
│   │   └── connection.js        # MongoDB connection helper
│   └── api/
│       ├── server.js            # Express server setup
│       ├── routes/              # API route definitions
│       │   ├── index.js
│       │   ├── stores.js
│       │   ├── products.js
│       │   ├── price-history.js
│       │   ├── analytics.js
│       │   └── changelogs.js
│       └── controllers/         # Request handlers
│           ├── stores.js
│           ├── products.js
│           ├── price-history.js
│           ├── analytics.js
│           └── changelogs.js
└── test/
    ├── api/                     # API endpoint tests
    └── integration/             # Integration tests
```

## Database Collections

The API reads from the following MongoDB collections (created by Phase 1 & 3):

- `stores` - Store information
- `products` - Product data with embedded variants and price history
- `price_snapshots` - Time-series price data
- `hourly_store_avg` - Pre-aggregated store averages
- `hourly_tag_avg` - Pre-aggregated tag averages
- `hourly_store_tag_avg` - Pre-aggregated store-tag averages

## Example Usage

### Add a Store

```bash
curl -X POST http://localhost:3000/stores \
  -H "Content-Type: application/json" \
  -d '{
    "store_url": "https://example.myshopify.com",
    "store_name": "Example Store",
    "poll_interval": 60
  }'
```

### Get Products

```bash
curl http://localhost:3000/stores/{storeId}/products
```

### Get Price History

```bash
curl "http://localhost:3000/products/{productId}/price-history?start_date=2025-01-01"
```

### Get Analytics

```bash
curl "http://localhost:3000/analytics/stores/{storeId}/average-price?window_hours=24"
```

## Development

The backend is built with:
- **Express.js** - Web framework
- **MongoDB Node.js Driver** - Database access
- **Node.js Test Runner** - Testing

## License

MIT

