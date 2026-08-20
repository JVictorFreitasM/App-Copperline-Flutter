import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WkBiClientService } from './wk-bi-client.service';

@Module({
  imports: [HttpModule],
  providers: [WkBiClientService],
  exports: [WkBiClientService],
})
export class WkBiClientModule {}
