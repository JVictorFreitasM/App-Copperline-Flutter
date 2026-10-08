import { Global, Module } from '@nestjs/common';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CredenciaisErpService } from './credenciais-erp.service';

// Global: todos os clients do ERP (Radar, Executivo/Estoque/Empresarial/
// Financeiro.svc) leem as credenciais daqui, sem cada modulo importar este.
@Global()
@Module({
  imports: [PrismaModule],
  providers: [CredenciaisErpService, SegredoCryptoService],
  exports: [CredenciaisErpService],
})
export class CredenciaisErpModule {}
