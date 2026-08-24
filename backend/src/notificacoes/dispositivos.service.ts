import { Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto';

@Injectable()
export class DispositivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuariosService: UsuariosService,
  ) {}

  // Upsert por token (nao usuarioId+plataforma) - cada instalacao do app
  // tem um token proprio e distinto; reinstalar/logar de novo no MESMO
  // aparelho gera um token novo, o antigo simplesmente para de ser usado
  // (sem necessidade de limpeza explicita - fora de escopo desta OS).
  async registrar(idpUser: IdpUser, dto: RegistrarDispositivoDto): Promise<void> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    await this.prisma.dispositivoUsuario.upsert({
      where: { token: dto.token },
      create: { token: dto.token, plataforma: dto.plataforma, usuarioId: usuario.id },
      update: { plataforma: dto.plataforma, usuarioId: usuario.id },
    });
  }
}
