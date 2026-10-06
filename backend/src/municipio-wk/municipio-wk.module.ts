import { Module } from '@nestjs/common';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { RedisModule } from '../redis/redis.module';
import { MunicipioWkService } from './municipio-wk.service';

@Module({
  imports: [ErpClientModule, RedisModule],
  providers: [MunicipioWkService],
  exports: [MunicipioWkService],
})
export class MunicipioWkModule {}
