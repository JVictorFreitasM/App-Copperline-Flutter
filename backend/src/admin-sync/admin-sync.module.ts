import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { AdminSyncController } from './admin-sync.controller';

@Module({
  imports: [SyncModule],
  controllers: [AdminSyncController],
})
export class AdminSyncModule {}
