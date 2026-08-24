import { Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { Usuario } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Identidade local minima (OS-BACKEND-19) - o restante do backend so
// conhece o usuario via claims do JWT (@CurrentUser(), sub/email/name),
// sem persistir nada. DispositivoUsuario/ProdutoFavorito precisam de FK
// de verdade - este service e' o unico ponto que cria/atualiza Usuario,
// sempre por upsert (idpUser e' a fonte da verdade; email/nome sao
// mantidos atualizados a cada chamada, nunca editados aqui).
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async obterOuCriarPorSub(idpUser: IdpUser): Promise<Usuario> {
    return this.prisma.usuario.upsert({
      where: { sub: idpUser.sub },
      create: { sub: idpUser.sub, email: idpUser.email, nome: idpUser.name },
      update: { email: idpUser.email, nome: idpUser.name },
    });
  }
}
