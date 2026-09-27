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

const app = express();

// Render sits behind a proxy; needed for rate limiting by client IP
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin tools (curl, health checks), configured origins and Netlify deploy previews
      const allowed =
        !origin ||
        config.clientUrls.includes(origin) ||
        config.clientUrls.some((url) => url.endsWith('.netlify.app') && origin.endsWith(`--${url.replace(/^https?:\/\//, '')}`));
      // Reject without throwing: the browser blocks the request, and the log says what to fix
      if (!allowed) console.warn(`CORS: origin ${origin} is not in CLIENT_URL (${config.clientUrls.join(', ')})`);
      callback(null, allowed);
    },
  })
);
app.use(express.json({ limit: '1mb' }));
if (!config.isProd) app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/projects/:projectId/sprints', requireAuth, sprintRoutes);
app.use('/api/projects/:projectId/tasks', requireAuth, taskRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
