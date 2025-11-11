import express from 'express';
import cors from 'cors';
import triggerRouter, { createApiRouter } from './routes.js';

/**
 * Create and configure Express application for trigger API
 * @returns {express.Application} Configured Express app
 */
export function createTriggerApp({ router, routeOverrides } = {}) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register trigger routes
  const resolvedRouter = router ?? (routeOverrides ? createApiRouter(routeOverrides) : triggerRouter);
  app.use('/', resolvedRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  return app;
}

/**
 * Start Express server for trigger API
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>} HTTP server instance
 */
export async function startTriggerServer(port = 3001) {
  const app = createTriggerApp();
  
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`✓ Trigger API server running on port ${port}`);
      resolve(server);
    }).on('error', reject);
  });
}

