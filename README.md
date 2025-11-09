# Shopify Monitor v2

Monitors Shopify storefronts and tracks product price movement.

## Overview
- Data service polls Shopify, normalizes products, and writes analytics snapshots.
- Backend API reads MongoDB and exposes store, product, analytics, and change log endpoints.
- Frontend dashboard consumes the API to show monitoring views.

## Requirements
- Node.js 18 or newer.
- MongoDB 5 or newer accessible through `MONGODB_URI`.

## Setup
1. Run `npm install` in the repository root.
2. Define `MONGODB_URI`, `MONGODB_DB_NAME`, and optional `TRIGGER_PORT`, `TRIGGER_API_URL`, or `PORT`.
3. Seed the `stores` collection with active stores before polling.

## Run
- `npm start` launches the data processing service and trigger API (default port 3001).
- `npm run backend:start` starts the REST API (default port 3000).
- `cd frontend && npm install && npm run dev` serves the dashboard (default port 5173).

## Tests
- `npm test` covers the data processing service.
- `npm run backend:test:integration` validates REST flows.
- `cd frontend && npm test` runs UI tests.

## Documentation
- `docs/database-schema.md`
- `docs/api.md`

## License

MIT
