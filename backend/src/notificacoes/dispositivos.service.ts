import { Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type {
  RegistrarDispositivoDto,
  RemoverDispositivoDto,
} from './dto/registrar-dispositivo.dto';

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

  // Logout no app: tira o aparelho da lista de quem recebe push, pra a conta
  // que saiu nao continuar recebendo as notificacoes dela naquele celular.
  // So remove token que pertence a QUEM chama (confere na propria query) -
  // um token alheio, ou inexistente, vira no-op (sem confirmar existencia).
  async remover(idpUser: IdpUser, dto: RemoverDispositivoDto): Promise<void> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    await this.prisma.dispositivoUsuario.deleteMany({
      where: { token: dto.token, usuarioId: usuario.id },
    });
  }
}
