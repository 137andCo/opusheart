import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Group } from '../models/Group.js';

const MAX_MESSAGE_LENGTH = 10_000;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MESSAGE_RATE_MAX = 10;

export function setupWebSocket(
  httpServer: HttpServer,
  jwtSecret: string,
  corsOrigins: string[] = [],
): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : false,
      credentials: true,
    },
    path: '/ws',
    maxHttpBufferSize: 64 * 1024, // 64KB max message size
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  // Track connections per IP for DoS protection
  const connectionsPerIp = new Map<string, number>();
  const MAX_CONNECTIONS_PER_IP = 10;

  io.use((socket, next) => {
    // Connection limit per IP
    const ip = socket.handshake.address;
    const current = connectionsPerIp.get(ip) || 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Too many connections from this IP'));
    }
    connectionsPerIp.set(ip, current + 1);
    socket.on('disconnect', () => {
      const count = connectionsPerIp.get(ip) || 1;
      if (count <= 1) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, count - 1);
    });

    // JWT auth with algorithm pinning
    const token = socket.handshake.auth?.['token'] || socket.handshake.headers?.['authorization']?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as { sub: string; role: string };
      (socket as any).userId = decoded.sub;
      (socket as any).userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId;

    // Per-socket message rate limiter
    const messageTimes: number[] = [];

    try {
      const groups = await Group.find({ 'members.userId': userId, active: true }).select('_id');
      for (const group of groups) {
        socket.join(`group:${group._id}`);
      }
    } catch (err) {
      console.error('Failed to join group rooms:', err);
    }

    socket.on('group:message', async (data: { groupId: string; content: string }) => {
      // Rate limit
      const now = Date.now();
      while (messageTimes.length > 0 && messageTimes[0]! < now - MESSAGE_RATE_WINDOW_MS) {
        messageTimes.shift();
      }
      if (messageTimes.length >= MESSAGE_RATE_MAX) {
        return socket.emit('error', { message: 'Rate limit exceeded' });
      }
      messageTimes.push(now);

      const { groupId, content } = data;

      // Validate content
      if (!content || typeof content !== 'string' || content.length > MAX_MESSAGE_LENGTH) {
        return socket.emit('error', { message: 'Invalid message content' });
      }
      if (!groupId || typeof groupId !== 'string') {
        return socket.emit('error', { message: 'Invalid groupId' });
      }

      const group = await Group.findOne({ _id: groupId, 'members.userId': userId });
      if (!group) return socket.emit('error', { message: 'Not a member of this group' });
      io.to(`group:${groupId}`).emit('group:message', {
        groupId, userId, content, timestamp: new Date().toISOString(),
      });
    });

    // Validate membership before allowing room join
    socket.on('group:join', async (groupId: string) => {
      if (!groupId || typeof groupId !== 'string') return;
      const group = await Group.findOne({ _id: groupId, 'members.userId': userId }).select('_id');
      if (group) socket.join(`group:${groupId}`);
    });
    socket.on('group:leave', (groupId: string) => { socket.leave(`group:${groupId}`); });
  });

  return io;
}
