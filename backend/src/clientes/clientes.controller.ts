import { Controller, Get, Param, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import type { ClienteEstatisticasDto } from './cliente-estatisticas.service';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import type { ClienteResumoLlmDto } from './cliente-resumo-llm.service';
import { ClientesService } from './clientes.service';
import type { ConflitoClienteDto } from './clientes.service';
import type {
  ClienteDetalheDto,
  ClienteResumoDto,
} from './dto/cliente-response.dto';
import { ClienteEstatisticasQueryDto } from './dto/cliente-estatisticas-query.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';
import { VerificarConflitoQueryDto } from './dto/verificar-conflito-query.dto';
import type { PaginatedResult } from '../common/pagination';
import { VisitasService } from '../visitas/visitas.service';
import type { VisitaDto } from '../visitas/dto/visita-response.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver clientes.module.ts,
// mesmo padrao da OS 03). GET /clientes e /:id sao escopados por vendedor
// (OS-BACKEND-23, ver VendedorEscopoService) - qualquer usuario autenticado
// acessa a ROTA, mas o CONTEUDO retornado depende de quem esta logado.
@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly clienteResumoLlmService: ClienteResumoLlmService,
    private readonly clienteEstatisticasService: ClienteEstatisticasService,
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly visitasService: VisitasService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarClientesQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PaginatedResult<ClienteResumoDto>> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clientesService.listar(query, escopo);
  }

  // Literal, ANTES de `:id` - mesmo motivo de 'favoritos' em
  // produtos.controller.ts (OS-BACKEND-19): `:id` (GET) casaria com
  // "verificar-conflito" como valor de id se viesse antes. Unica rota de
  // cliente SEM escopo por vendedor de proposito (ver
  // ClientesService.verificarConflito).
  @Get('verificar-conflito')
  verificarConflito(
    @Query() query: VerificarConflitoQueryDto,
  ): Promise<ConflitoClienteDto> {
    return this.clientesService.verificarConflito(query.documento);
  }

  @Get(':id')
  async buscarPorId(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteDetalheDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clientesService.buscarPorId(id, escopo);
  }

  // OS-BACKEND-20 - "/:id/resumo" e' mais especifico que "/:id" (3
  // segmentos vs 2), sem risco de colisao independente da ordem de
  // declaracao (diferente do caso de /produtos/favoritos, ver
  // produtos.controller.ts).
  @Get(':id/resumo')
  async obterResumo(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteResumoLlmDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteResumoLlmService.obterResumo(id, escopo);
  }

  // OS-BACKEND-26 - "/:id/estatisticas" e' mais especifico que "/:id" (3
  // segmentos vs 2), mesmo raciocinio de "/:id/resumo" acima.
  @Get(':id/estatisticas')
  async obterEstatisticas(
    @Param('id') id: string,
    @Query() query: ClienteEstatisticasQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteEstatisticasDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteEstatisticasService.obter(id, query.meses, escopo);
  }

  // OS-BACKEND-28 - historico de visitas, pra exibir junto das
  // estatisticas (OS-BACKEND-26). Mesmo raciocinio de rota mais especifica
  // que "/:id" das rotas acima.
  @Get(':id/visitas')
  async listarVisitas(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto[]> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.visitasService.listarPorCliente(id, escopo);
  }

  private async resolverEscopo(idpUser: IdpUser): Promise<EscopoClientes> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuario.id);
  }
}
