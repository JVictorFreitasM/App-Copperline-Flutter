import { Controller, Get } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { PapelVendedor } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';

export interface MeuVendedorDto {
  vendedorId: string | null;
  papel: PapelVendedor | null;
  podeAprovar: boolean;
}

// GET /vendedores/me (OS-WEB-21) - so pra o front saber se mostra o link
// "Aprovações" na navegação (podeAprovar) sem ter que chamar
// GET /solicitacoes-desconto (que so lista as pendentes, nao "tenho
// permissao?") em toda pagina so pra decidir isso. Sessao/SSO normal (nao
// ApiKeyGuard) - qualquer usuario logado consulta o proprio papel, nunca o
// de outro usuario, entao nao ha dado sensivel de terceiro exposto aqui.
@Controller('vendedores')
export class VendedoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get('me')
  async meuVendedor(@CurrentUser() idpUser: IdpUser): Promise<MeuVendedorDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId: usuario.id },
      select: { id: true, papel: true },
    });

    const podeAprovar =
      idpUser.role === 'admin' ||
      vendedor?.papel === 'SUPERVISOR' ||
      vendedor?.papel === 'GERENTE';

    return {
      vendedorId: vendedor?.id ?? null,
      papel: vendedor?.papel ?? null,
      podeAprovar,
    };
  }
}
