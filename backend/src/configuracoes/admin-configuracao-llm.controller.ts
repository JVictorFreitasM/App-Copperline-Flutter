import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ChaveLlmService } from '../llm-client/chave-llm.service';
import type { ChaveLlmDto } from '../llm-client/chave-llm.service';
import { ConfiguracaoLlmService } from '../llm-client/configuracao-llm.service';
import type { ConfiguracaoLlmDto } from '../llm-client/configuracao-llm.service';
import { AtualizarChaveLlmDto } from '../llm-client/dto/atualizar-chave-llm.dto';
import { AtualizarConfiguracaoLlmDto } from '../llm-client/dto/atualizar-configuracao-llm.dto';
import { CriarChaveLlmDto } from '../llm-client/dto/criar-chave-llm.dto';
import { ReordenarChavesLlmDto } from '../llm-client/dto/reordenar-chaves-llm.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver configuracoes.module.ts) - aba "LLM" da tela de Configuracoes
// (2026-09-24, unificada com as outras 3 abas - antes vivia sozinha em
// /admin/llm, ApiKeyGuard). GET/PATCH aqui sao so provedor/modelo -
// gerenciamento das chaves em si fica em /chaves abaixo (lista com
// fallback em cadeia, ver ChaveLlmService).
@Controller('admin/configuracoes/llm')
export class AdminConfiguracaoLlmController {
  constructor(
    private readonly configuracaoLlmService: ConfiguracaoLlmService,
    private readonly chaveLlmService: ChaveLlmService,
  ) {}

  @Get()
  obterConfiguracao(): Promise<ConfiguracaoLlmDto> {
    return this.configuracaoLlmService.obter();
  }

  @Patch()
  atualizarConfiguracao(
    @Body() dto: AtualizarConfiguracaoLlmDto,
  ): Promise<ConfiguracaoLlmDto> {
    return this.configuracaoLlmService.atualizar(dto);
  }

  @Get('chaves')
  listarChaves(): Promise<ChaveLlmDto[]> {
    return this.chaveLlmService.listar();
  }

  @Post('chaves')
  criarChave(@Body() dto: CriarChaveLlmDto): Promise<ChaveLlmDto> {
    return this.chaveLlmService.criar(dto);
  }

  // "/ordem" ANTES de "/:id" no roteamento do Nest so importa quando os
  // dois casam pra mesma verbo+forma de path - aqui "/chaves/ordem" (2
  // segmentos fixos) nunca colide com "/chaves/:id" (:id vira "ordem" só
  // se essa rota especifica não existisse, mas o Nest resolve por ordem de
  // declaração quando ambíguo, então literal primeiro por segurança).
  @Patch('chaves/ordem')
  reordenarChaves(@Body() dto: ReordenarChavesLlmDto): Promise<ChaveLlmDto[]> {
    return this.chaveLlmService.reordenar(dto.ids);
  }

  @Patch('chaves/:id')
  atualizarChave(
    @Param('id') id: string,
    @Body() dto: AtualizarChaveLlmDto,
  ): Promise<ChaveLlmDto> {
    return this.chaveLlmService.atualizar(id, dto);
  }

  @Delete('chaves/:id')
  async removerChave(@Param('id') id: string): Promise<void> {
    await this.chaveLlmService.remover(id);
  }
}
