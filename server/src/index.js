import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
import { initRealtime } from './realtime.js';
import { startRecurringJob } from './services/recurring.js';

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    const server = http.createServer(app);
    initRealtime(server);
    server.listen(config.port, () => console.log(`API listening on port ${config.port}`));
    startRecurringJob();
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
