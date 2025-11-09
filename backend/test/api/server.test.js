import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../../src/api/server.js';
import http from 'http';

describe('Express Server', () => {
  let app;
  let server;
  const port = 3001; // Use different port for testing

  beforeEach(() => {
    app = createApp();
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('should create Express app', () => {
    assert.ok(app);
    assert.strictEqual(typeof app, 'function');
  });

  it('should respond to health check', async () => {
    server = app.listen(port);
    
    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.timestamp);
  });

  it('should return 404 for unknown routes', async () => {
    server = app.listen(port);
    
    const response = await fetch(`http://localhost:${port}/unknown-route`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 404);
    assert.ok(data.error);
  });

  it('should handle CORS', async () => {
    server = app.listen(port);
    
    const response = await fetch(`http://localhost:${port}/health`);
    
    assert.ok(response.headers.get('access-control-allow-origin'));
  });
});

