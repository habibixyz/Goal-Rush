import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const publisher = new Redis(redisUrl);

publisher.on('connect', () => {
  console.log('Redis Publisher connected successfully');
});

publisher.on('error', (err) => {
  console.error('Redis Publisher Connection Error:', err);
});

export const publishEvent = async (channel: string, type: string, payload: any) => {
  try {
    const message = JSON.stringify({ type, ...payload });
    await publisher.publish(channel, message);
  } catch (err) {
    console.error(`Failed to publish event to Redis on channel ${channel}:`, err);
  }
};

export default publisher;
