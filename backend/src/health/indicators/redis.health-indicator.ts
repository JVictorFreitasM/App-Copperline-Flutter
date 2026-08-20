import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      await client.ping();
      return indicator.up();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Falha ao conectar ao Redis';
      return indicator.down({ mensagem });
    } finally {
      client.disconnect();
    }
  }
}
