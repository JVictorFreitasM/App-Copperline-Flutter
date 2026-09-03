import { Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ListarOportunidadesQueryDto } from './dto/listar-oportunidades-query.dto';
import type { OportunidadeClienteDto } from './oportunidade-cliente.service';
import { OportunidadeClienteService } from './oportunidade-cliente.service';

// Mesmo criterio de visibilidade de MetasController.metaProgresso (OS-BACKEND-44):
// admin ve qualquer vendedor, supervisor/gerente ve a propria equipe,
// vendedor comum so' a si mesmo.
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

// OS-BACKEND-45 - session auth via requireAuth (ver oportunidades.module.ts).
@Controller('vendedores')
export class OportunidadesController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly oportunidadeClienteService: OportunidadeClienteService,
  ) {}

  @Get(':id/oportunidades')
  async listar(
    @Param('id') id: string,
    @Query() query: ListarOportunidadesQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<OportunidadeClienteDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuario.id,
    );
    if (!vendedorVisivel(escopo, id)) {
      throw new ForbiddenException(
        'Sem permissão para consultar as oportunidades deste vendedor',
      );
    }
    return this.oportunidadeClienteService.listarParaVendedor(
      id,
      query.limiarDiasSemPedido,
    );
  }
}
