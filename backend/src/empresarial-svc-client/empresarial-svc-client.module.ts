import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EmpresarialSvcClientService } from './empresarial-svc-client.service';

@Module({
  imports: [HttpModule],
  providers: [EmpresarialSvcClientService],
  exports: [EmpresarialSvcClientService],
})
export class EmpresarialSvcClientModule {}
