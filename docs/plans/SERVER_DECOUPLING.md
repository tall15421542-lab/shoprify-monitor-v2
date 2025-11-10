# Server Decoupling - REST Communication

## Overview

The backend and src servers have been decoupled to communicate via REST API instead of direct module imports. This improves separation of concerns, allows independent deployment, and enables better scalability.

## Architecture Changes

### Before (Coupled)
```
backend/
└── src/api/routes/index.js
    └── import triggerRouter from '../../../../src/api/routes.js'  ❌ Direct import
```

The backend server was directly importing the trigger router from the src server, creating tight coupling between the two applications.

### After (Decoupled)
```
backend/                                src/
├── src/api/                           ├── api/
│   ├── clients/                       │   ├── server.js         (HTTP API server)
│   │   └── trigger-client.js  ←──────────────────────────┐
│   └── routes/                        │   └── routes.js         │  REST API
│       └── triggers.js                │                          │
└── ...                                └── main.js  ──────────────┘
                                          (starts HTTP server)
```

Now the servers communicate via REST HTTP requests.

## New Files

### 1. `src/api/server.js`
Creates and starts an HTTP server for the src application, exposing trigger endpoints:
- `POST /poll/store/:storeId` - Trigger polling for specific store
- `POST /poll/all` - Trigger polling for all stores
- `POST /aggregate` - Trigger aggregation with custom window
- `POST /aggregate/current` - Trigger current hour aggregation

### 2. `backend/src/api/clients/trigger-client.js`
HTTP client for making requests to the src server's trigger API:
```javascript
import { triggerStorePoll, triggerAllStoresPoll } from './clients/trigger-client.js';
```

### 3. `backend/src/api/routes/triggers.js`
Backend routes that proxy requests to the src server via the HTTP client.

## Configuration

### Environment Variables

**Backend Server:**
- `PORT` - Backend API server port (default: 3000)
- `TRIGGER_API_URL` - URL of the trigger API server (default: http://localhost:3001)

**Src Server:**
- `TRIGGER_PORT` - Trigger API server port (default: 3001)
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB_NAME` - MongoDB database name

### Running Both Servers

**Terminal 1 - Start src server (with trigger API):**
```bash
npm start
# or
TRIGGER_PORT=3001 node src/main.js
```

**Terminal 2 - Start backend server:**
```bash
npm run backend:start
# or
TRIGGER_API_URL=http://localhost:3001 node backend/src/main.js
```

## Testing

### REST Communication Test
```bash
npm run test:rest-communication
```

This test verifies that:
1. Backend can successfully make requests to the src trigger API
2. Responses are correctly proxied through the backend
3. Errors are properly handled and forwarded
4. No direct imports exist between servers

### Trigger API Tests (Direct)
```bash
npm run test:triggers
```

Tests the trigger API endpoints directly on the src server.

## Benefits

1. **Loose Coupling**: Servers can be developed, tested, and deployed independently
2. **Scalability**: Each server can be scaled independently based on load
3. **Network Flexibility**: Servers can run on different machines/containers
4. **Technology Flexibility**: Easier to replace or rewrite one server without affecting the other
5. **Clear API Contracts**: REST APIs provide clear boundaries and documentation

## Migration Notes

- The backend routes remain the same from the client perspective
- The trigger endpoints are now proxied through the backend
- Both servers need to be running for full functionality
- Connection errors are properly handled if the src server is unavailable

## Example API Flow

1. Client makes request to backend:
   ```
   POST http://localhost:3000/poll/all
   ```

2. Backend proxies to src server:
   ```
   POST http://localhost:3001/poll/all
   ```

3. Src server processes request and returns response

4. Backend forwards response to client

All of this happens transparently to the end user.

