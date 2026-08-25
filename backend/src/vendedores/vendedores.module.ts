import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminVendedoresController } from './admin-vendedores.controller';
import { VendedorEscopoService } from './vendedor-escopo.service';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminVendedoresController],
  providers: [VendedoresHierarquiaService, VendedorEscopoService],
  // VendedorEscopoService exportado pra ClientesModule (OS-BACKEND-23)
  // resolver o escopo de GET /clientes sem duplicar a logica de
  // hierarquia/papel aqui.
  exports: [VendedorEscopoService],
})
export class VendedoresModule {}
