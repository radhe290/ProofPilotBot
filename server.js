import { createServer } from 'node:http';
import './src/loadEnv.js';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { getHttpConfiguration } from './src/config.js';
import { handleChatRequest } from './src/routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = resolve(__dirname);
const { allowedOrigins, rateLimitWindowMs, rateLimitMaxRequests } = getHttpConfiguration();
const rateLimitBuckets = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function getCorsHeaders(request) {
  const origin = request.headers.origin;

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
  };
}

function sendApiJson(request, response, statusCode, payload) {
  sendApiJsonWithHeaders(request, response, statusCode, payload);
}

function sendApiJsonWithHeaders(request, response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    ...getCorsHeaders(request),
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function getClientId(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.socket.remoteAddress || 'unknown';
}

function isRateLimited(request) {
  const now = Date.now();
  const clientId = getClientId(request);
  const bucket = rateLimitBuckets.get(clientId);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(clientId, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > rateLimitMaxRequests;
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  let filePath;
  try {
    filePath = resolve(publicDir, `.${decodeURIComponent(pathname)}`);
  } catch {
    sendJson(response, 400, { error: 'Invalid request path' });
    return;
  }

  const relativePath = relative(publicDir, filePath);

  if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const fileBuffer = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(request.method === 'HEAD' ? undefined : fileBuffer);
  } catch {
    if (pathname !== '/index.html' && request.method === 'GET') {
      try {
        const fallback = await readFile(join(publicDir, 'index.html'));
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        response.end(fallback);
        return;
      } catch {
        // fall through to the 404 below
      }
    }

    sendJson(response, 404, { error: 'Not found' });
  }
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Invalid request' });
    return;
  }

  const requestUrl = new URL(request.url, 'http://localhost');

  if (requestUrl.pathname === '/api/chat' && request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      ...getCorsHeaders(request),
    });
    response.end();
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/chat') {
    if (isRateLimited(request)) {
      sendApiJson(request, response, 429, { error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }

    await handleChatRequest(request, response, (res, statusCode, payload) => {
      sendApiJson(request, res, statusCode, payload);
    });
    return;
  }

  if (requestUrl.pathname === '/api/chat') {
    sendApiJsonWithHeaders(
      request,
      response,
      405,
      { error: 'Method not allowed. Use POST /api/chat.' },
      { Allow: 'POST, OPTIONS' },
    );
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    await serveStatic(request, response);
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed' });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`ProofPilot server listening on http://localhost:${port}`);
});
