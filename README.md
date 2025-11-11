# Shopify Monitor v2

Monitors Shopify storefronts and tracks product price movement.

## Architecture
- **Data service** polls Shopify, normalizes products, writes analytics snapshots (port 3001).
- **Backend API** reads MongoDB and exposes REST endpoints (port 3000).
- **Frontend** dashboard shows monitoring views and subscription tools (port 5173).

## Quick Start

**Requirements:**
- Node.js 18+
- MongoDB 5+ (replica set enabled)

**Setup:**
```bash
npm install
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB_NAME="shopify_monitor"
```

**Run:**
```bash
# Terminal 1: Data service + trigger API (port 3001)
npm start

# Terminal 2: Backend API (port 3000)
npm run backend:start

# Terminal 3: Frontend dashboard (port 5173)
cd frontend && npm install && npm run dev
```

**Seed data:**
```bash
node cli/mock-data-cli.js --poll-url https://your-store.myshopify.com
```

## Features

**Monitoring Subscriptions:**
- Subscribe to price changes for stores, products, product types, or combinations.
- Filter by direction: `price_up`, `price_down`, or `both`.
- View unread change logs with baseline comparisons.

**Analytics:**
- Hourly price averages per store, tag, product type.
- Historical price tracking per product variant.
- Change logs with percentage and absolute deltas.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | required | MongoDB connection string |
| `MONGODB_DB_NAME` | required | Database name |
| `PORT` | 3000 | Backend API port |
| `TRIGGER_PORT` | 3001 | Data service trigger API port |
| `TRIGGER_API_URL` | `http://localhost:3001` | Trigger API base URL |

## MongoDB Setup (Docker)

**Start MongoDB with replica set:**
```bash
docker run -d --name shopify-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec shopify-mongo mongosh --quiet --eval \
  "rs.initiate({_id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }]})"
```

**Reset to empty state:**
```bash
docker stop shopify-mongo
docker rm shopify-mongo
docker volume rm $(docker volume ls -q | grep shopify-mongo)
# Then run the start commands above
```

## Tests
- `npm test` covers the data processing service.
- `npm run backend:test:integration` validates REST flows.
- `cd frontend && npm test` runs UI tests.

## Documentation
- `docs/database-schema.md`
- `docs/api.md`

## License

MIT
