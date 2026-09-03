import { Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { MesAnoQueryDto } from './dto/mes-ano-query.dto';
import type { MetaProgressoDto } from './meta-vendedor.service';
import { MetaVendedorService } from './meta-vendedor.service';
import type { RankingEquipeItemDto } from './ranking-equipe.service';
import { RankingEquipeService } from './ranking-equipe.service';

// Quem enxerga a meta/progresso de qual vendedor - mesmo escopo de
// hierarquia ja resolvido por VendedorEscopoService (admin ve tudo,
// supervisor/gerente ve a propria equipe, vendedor comum so' a si mesmo).
function vendedorVisivel(escopo: EscopoClientes, vendedorId: string): boolean {
  switch (escopo.tipo) {
    case 'TODOS':
      return true;
    case 'PROPRIO':
      return escopo.vendedorId === vendedorId;
    case 'EQUIPE':
      return escopo.vendedorIds.includes(vendedorId);
    case 'NENHUM':
      return false;
  }
}

// OS-BACKEND-44 - session auth via requireAuth (ver metas.module.ts),
// mesmo padrao de VendedoresController. Endpoints de LEITURA pro proprio
// vendedor/equipe consultarem progresso e ranking - configuracao da meta
// em si (escrita) fica em admin-metas.controller.ts (ApiKeyGuard).
@Controller()
export class MetasController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly metaVendedorService: MetaVendedorService,
    private readonly rankingEquipeService: RankingEquipeService,
  ) {}

  @Get('vendedores/:id/meta-progresso')
  async metaProgresso(
    @Param('id') id: string,
    @Query() query: MesAnoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<MetaProgressoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuario.id,
    );
    if (!vendedorVisivel(escopo, id)) {
      throw new ForbiddenException(
        'Sem permissão para consultar a meta deste vendedor',
      );
    }
    return this.metaVendedorService.obterProgresso(id, query.mesAno);
  }

  @Get('equipe/ranking')
  async ranking(
    @Query() query: MesAnoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<RankingEquipeItemDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.rankingEquipeService.obterParaUsuario(
      idpUser,
      usuario.id,
      query.mesAno,
    );
  }
}
