/**
 * The Express app, without starting a server: index.js runs it,
 * and the tests call it directly with Supertest.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import sprintRoutes from './routes/sprints.js';
import taskRoutes from './routes/tasks.js';
import invitationRoutes from './routes/invitations.js';
import notificationRoutes from './routes/notifications.js';
import meRoutes from './routes/me.js';
import templateRoutes from './routes/templates.js';
import publicRoutes from './routes/public.js';
import oauthRoutes from './routes/oauth.js';
import webhookRoutes from './routes/webhooks.js';
import { enabledProviders } from './services/oauth.js';
import { attachmentsEnabled } from './services/cloudinary.js';
import { emitProjectChanged } from './realtime.js';
import { isAllowedOrigin } from './utils/cors.js';

const app = express();

// Render sits behind a proxy; needed for rate limiting by client IP
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      const allowed = isAllowedOrigin(origin);
      // Reject without throwing: the browser blocks the request, and the log says what to fix
      if (!allowed) console.warn(`CORS: origin ${origin} is not in CLIENT_URL (${config.clientUrls.join(', ')})`);
      callback(null, allowed);
    },
  })
);
// Webhooks read the raw body to check signatures: before the JSON parser
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
if (!config.isProd && process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Optional features the client should show (they depend on the server's environment)
app.get('/api/config', (_req, res) => {
  res.json({ attachments: attachmentsEnabled(), oauth: enabledProviders() });
});

app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/me', requireAuth, meRoutes);

// After any successful change inside a project, tell the people viewing it to refresh
app.use('/api/projects/:projectId', (req, res, next) => {
  if (req.method !== 'GET') {
    // Read now: Express restores the full URL once this middleware has passed the request on
    const kind = req.method === 'DELETE' && req.path === '/' ? 'deleted' : 'changed';
    const { projectId } = req.params;
    res.on('finish', () => {
      if (res.statusCode < 400) emitProjectChanged(projectId, { kind, exceptSocket: req.get('x-socket-id') });
    });
  }
  next();
});
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/projects/:projectId/sprints', requireAuth, sprintRoutes);
app.use('/api/projects/:projectId/tasks', requireAuth, taskRoutes);
app.use('/api/projects/:projectId/templates', requireAuth, templateRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
