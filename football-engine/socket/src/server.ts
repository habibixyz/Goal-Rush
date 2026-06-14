import { Server } from 'socket.io';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

const port = process.env.PORT || 4000;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup HTTP server and Socket.io
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Redis Subscriber
const subscriber = new Redis(redisUrl);

subscriber.on('connect', () => {
  console.log('WebSocket Redis Subscriber connected successfully');
});

subscriber.on('error', (err) => {
  console.error('WebSocket Redis Subscriber Error:', err);
});

// Event deduplication cache (stores event hash for 30 seconds)
const processedEvents = new Set<string>();

const isDuplicateEvent = (matchId: string, eventType: string, payload: any): boolean => {
  let eventHash = `${matchId}:${eventType}`;
  if (payload.event && payload.event.id) {
    eventHash += `:${payload.event.id}`;
  } else if (payload.match && payload.match.updatedAt) {
    eventHash += `:${payload.match.updatedAt}`;
  } else {
    eventHash += `:${JSON.stringify(payload)}`;
  }

  if (processedEvents.has(eventHash)) {
    return true;
  }

  processedEvents.add(eventHash);
  setTimeout(() => processedEvents.delete(eventHash), 30000); // clear cache after 30s
  return false;
};

// Subscribe to all match updates
subscriber.psubscribe('match:*').then(() => {
  console.log('Successfully subscribed to match:* channels');
});

subscriber.on('pmessage', (pattern, channel, message) => {
  try {
    const matchId = channel.split(':')[1];
    const payload = JSON.parse(message);
    const { type } = payload;

    if (isDuplicateEvent(matchId, type, payload)) {
      console.log(`[Socket] Deduplicated duplicate event: ${type} for match ${matchId}`);
      return;
    }

    console.log(`[Socket] Broadcasting event [${type}] on room [match:${matchId}]`);
    io.to(`match:${matchId}`).emit('match_event', payload);
  } catch (err) {
    console.error('Failed to parse and broadcast message from Redis:', err);
  }
});

// Client connection logic
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join match room
  socket.on('join_match', (matchId: string) => {
    socket.join(`match:${matchId}`);
    console.log(`[Socket] Client ${socket.id} joined match room: match:${matchId}`);
    socket.emit('joined_room', { matchId });
  });

  // Leave match room
  socket.on('leave_match', (matchId: string) => {
    socket.leave(`match:${matchId}`);
    console.log(`[Socket] Client ${socket.id} left match room: match:${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(port, () => {
  console.log(`[Socket] WebSocket server is listening on port ${port}`);
});
