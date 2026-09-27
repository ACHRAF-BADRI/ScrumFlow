import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { config } from './config.js';
import Project from './models/Project.js';
import User from './models/User.js';
import { isAllowedOrigin } from './utils/cors.js';

/*
 * Realtime layer (Socket.io).
 * Rooms:
 *   user:<id>     notifications and "your project list changed"
 *   project:<id>  "this project changed, reload" + who is viewing it
 * Data still goes through the REST API; sockets only tell clients when to refresh.
 */

let io = null;
// projectId -> Map(socketId -> { _id, name, avatarColor })
const viewers = new Map();

function presence(projectId) {
  const unique = new Map();
  for (const user of viewers.get(projectId)?.values() ?? []) unique.set(user._id, user);
  return [...unique.values()];
}

function leaveProject(socket) {
  const projectId = socket.data.projectId;
  if (!projectId) return;
  socket.leave(`project:${projectId}`);
  socket.data.projectId = null;
  const map = viewers.get(projectId);
  map?.delete(socket.id);
  if (map && map.size === 0) viewers.delete(projectId);
  io.to(`project:${projectId}`).emit('presence', { projectId, users: presence(projectId) });
}

export function initRealtime(server) {
  io = new Server(server, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) },
  });

  // Same JWT as the REST API, sent in the handshake
  io.use(async (socket, next) => {
    try {
      const { sub } = jwt.verify(socket.handshake.auth?.token ?? '', config.jwtSecret);
      const user = await User.findById(sub).select('name avatarColor');
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { _id: String(user._id), name: user.name, avatarColor: user.avatarColor };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user._id}`);

    socket.on('project:join', async (projectId, ack) => {
      if (!mongoose.isValidObjectId(projectId)) return ack?.({ ok: false });
      const project = await Project.findById(projectId).select('members');
      if (!project?.roleOf(socket.data.user._id)) return ack?.({ ok: false });

      if (socket.data.projectId !== projectId) leaveProject(socket);
      socket.join(`project:${projectId}`);
      socket.data.projectId = projectId;
      if (!viewers.has(projectId)) viewers.set(projectId, new Map());
      viewers.get(projectId).set(socket.id, socket.data.user);
      io.to(`project:${projectId}`).emit('presence', { projectId, users: presence(projectId) });
      return ack?.({ ok: true });
    });

    socket.on('project:leave', () => leaveProject(socket));
    socket.on('disconnect', () => leaveProject(socket));
  });

  return io;
}

/**
 * Tell everyone viewing the project that it changed, except the socket that
 * made the change (sent by the client as the X-Socket-Id header).
 */
export function emitProjectChanged(projectId, { kind = 'changed', exceptSocket } = {}) {
  if (!io) return;
  const room = io.to(`project:${projectId}`);
  (exceptSocket ? room.except(exceptSocket) : room).emit('project:changed', { projectId: String(projectId), kind });
}

export function emitToUser(userId, event, payload = {}) {
  io?.to(`user:${userId}`).emit(event, payload);
}
