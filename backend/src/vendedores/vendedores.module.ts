import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminVendedoresController } from './admin-vendedores.controller';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminVendedoresController],
  providers: [VendedoresHierarquiaService],
})
export class VendedoresModule {}
