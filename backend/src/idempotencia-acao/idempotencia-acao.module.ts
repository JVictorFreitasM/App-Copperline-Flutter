import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdempotenciaAcaoService } from './idempotencia-acao.service';

@Module({
  imports: [PrismaModule],
  providers: [IdempotenciaAcaoService],
  exports: [IdempotenciaAcaoService],
})
export class IdempotenciaAcaoModule {}
