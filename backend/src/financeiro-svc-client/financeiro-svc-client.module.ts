import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FinanceiroSvcClientService } from './financeiro-svc-client.service';

@Module({
  imports: [HttpModule],
  providers: [FinanceiroSvcClientService],
  exports: [FinanceiroSvcClientService],
})
export class FinanceiroSvcClientModule {}
