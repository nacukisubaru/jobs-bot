import Redis from 'ioredis';

export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    });

    this.client.on('connect', () => console.log('[Redis] Connected'));
    this.client.on('error', (err: { message: string }) => console.warn('[Redis] Error:', err?.message));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async isMember(key: string, value: string): Promise<boolean> {
    return (await this.client.sismember(key, value)) === 1;
  }

  async addMember(key: string, value: string | string[], ttl?: number): Promise<void> {
    const values = Array.isArray(value) ? value : [value];

    await this.client.sadd(key, values);

    if (ttl) await this.client.expire(key, ttl);
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = new RedisService();
