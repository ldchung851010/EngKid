import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { asrRoutes } from './routes/asr.js';
import { intentRoutes } from './routes/intent.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);

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
