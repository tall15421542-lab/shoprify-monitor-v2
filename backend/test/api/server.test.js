import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import http from 'http';

describe('Express Server', () => {
  let app;
  let server;
  let port;

  const startServer = () =>
    new Promise((resolve, reject) => {
      const instance = app.listen(0, () => {
        const address = instance.address();
        if (typeof address === 'object' && address && 'port' in address) {
          resolve({ server: instance, port: address.port });
        } else {
          reject(new Error('Unable to determine server port'));
        }
      });
      instance.on('error', reject);
    });

  beforeEach(() => {
    app = createApp();
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = undefined;
      port = undefined;
    }
  });

  it('should create Express app', () => {
    assert.ok(app);
    assert.strictEqual(typeof app, 'function');
  });

  it('should respond to health check', async () => {
    ({ server, port } = await startServer());
    
    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.timestamp);
  });

  it('should return 404 for unknown routes', async () => {
    ({ server, port } = await startServer());
    
    const response = await fetch(`http://localhost:${port}/unknown-route`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 404);
    assert.ok(data.error);
  });

  it('should handle CORS', async () => {
    ({ server, port } = await startServer());
    
    const response = await fetch(`http://localhost:${port}/health`);
    
    assert.ok(response.headers.get('access-control-allow-origin'));
  });
});

