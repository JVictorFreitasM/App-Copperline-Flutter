import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ErpClientService } from './erp-client.service';

@Module({
  imports: [HttpModule],
  providers: [ErpClientService],
  exports: [ErpClientService],
})
export class ErpClientModule {}
