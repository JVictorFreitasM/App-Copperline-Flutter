import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EstoqueSvcClientService } from './estoque-svc-client.service';

@Module({
  imports: [HttpModule],
  providers: [EstoqueSvcClientService],
  exports: [EstoqueSvcClientService],
})
export class EstoqueSvcClientModule {}
