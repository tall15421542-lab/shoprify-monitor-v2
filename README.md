# Shopify Monitor v2

Monitors Shopify storefronts and tracks product price movement.

## Overview
- Data service polls Shopify, normalizes products, and writes analytics snapshots.
- Backend API reads MongoDB and exposes store, product, analytics, monitoring, and change log endpoints.
- Frontend dashboard consumes the API to show monitoring views and subscription tools.

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
- `node cli/mock-data-cli.js --poll-url https://your-store.myshopify.com` seeds mock monitoring data when needed.

## Monitoring Subscriptions
- Create subscriptions for stores, products, product types, or store plus product type pairs.
- Choose a change direction (`price_up`, `price_down`, or `both`) and an alert interval in minutes.
- The data service records price changes that meet the selected direction after the interval passes.
- The backend aggregates unread change logs and exposes them through `/api/subscriptions` and `/api/change-logs`.
- The frontend adds a Monitoring page with subscription CRUD flows and unread change badges.
- Change logs include baseline rows when a subscription starts so users can compare the next change.

## MongoDB Tips
- To restart the Dockerized MongoDB instance with empty collections, run:
  - `docker stop shopify-mongo`
  - `docker rm shopify-mongo`
  - Remove the `/data/db` and `/data/configdb` volumes reported by `docker inspect` (for example `docker volume rm <volume-id> ...`)
  - `docker run -d --name shopify-mongo -p 27017:27017 mongo:7 --replSet rs0`
- After recreating the container, initialize the replica set so the backend can connect:
  - `docker exec shopify-mongo mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }]})"`

## Tests
- `npm test` covers the data processing service.
- `npm run backend:test:integration` validates REST flows.
- `cd frontend && npm test` runs UI tests.

## Documentation
- `docs/database-schema.md`
- `docs/api.md`

## License

MIT
