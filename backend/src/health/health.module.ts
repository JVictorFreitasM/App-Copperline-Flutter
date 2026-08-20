import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
