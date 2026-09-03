import { Controller, Get } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { PapelVendedor } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { SemanaVendaDto } from './vendedor-vendas-semanais.service';
import { VendedorVendasSemanaisService } from './vendedor-vendas-semanais.service';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';
import type { VendedorEquipeDto } from './vendedores-hierarquia.service';

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
    private readonly vendedoresHierarquiaService: VendedoresHierarquiaService,
    private readonly vendedorVendasSemanaisService: VendedorVendasSemanaisService,
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

  // GET /vendedores/equipe (OS-WEB-26) - so o roster (id/nome) da equipe de
  // quem chama, pra popular o filtro por vendedor do painel de visitas.
  @Get('equipe')
  async equipe(@CurrentUser() idpUser: IdpUser): Promise<VendedorEquipeDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedoresHierarquiaService.listarEquipe(idpUser, usuario.id);
  }

  // GET /vendedores/me/vendas-semanais (OS-MOBILE-41 - sparkline de vendas
  // na home do app) - sempre o PROPRIO vendedor de quem chama, sem :id nem
  // checagem de escopo (mesmo raciocinio de /vendedores/me acima): nao ha
  // dado de terceiro exposto aqui. Sem vendedor vinculado -> lista vazia,
  // nao erro (usuario admin puro, por exemplo, nao tem vendas pra mostrar).
  @Get('me/vendas-semanais')
  async minhasVendasSemanais(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SemanaVendaDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId: usuario.id },
      select: { id: true },
    });
    if (!vendedor) return [];
    return this.vendedorVendasSemanaisService.obter(vendedor.id);
  }
}
