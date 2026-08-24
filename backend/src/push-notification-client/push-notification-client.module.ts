import { Module } from '@nestjs/common';
import { PushNotificationClientService } from './push-notification-client.service';

@Module({
  providers: [PushNotificationClientService],
  exports: [PushNotificationClientService],
})
export class PushNotificationClientModule {}
