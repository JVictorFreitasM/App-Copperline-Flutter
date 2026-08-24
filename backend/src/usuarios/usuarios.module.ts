import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [PrismaModule],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
