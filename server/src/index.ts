import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { asrRoutes } from './routes/asr.js';
import { intentRoutes } from './routes/intent.js';

const app = Fastify({
  logger: true, // built-in pino logger
});

await app.register(cors, { origin: true });
await app.register(multipart);

// Request logging middleware
app.addHook('onRequest', async (request) => {
  console.log(`[server] ← ${request.method} ${request.url}`);
});

app.addHook('onResponse', async (request, reply) => {
  console.log(`[server] → ${reply.statusCode} ${request.method} ${request.url} (${Math.round(reply.elapsedTime)}ms)`);
});

await app.register(asrRoutes, { prefix: '/api' });
await app.register(intentRoutes, { prefix: '/api' });

app.get('/api/health', async () => ({ status: 'ok' }));

try {
  await app.listen({ port: 3001 });
  console.log('🚀 Server listening on http://localhost:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
