import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChaveLlmService } from './chave-llm.service';
import { ConfiguracaoLlmService } from './configuracao-llm.service';
import { LlmClientService } from './llm-client.service';

// Sem controller proprio (2026-09-24) - a aba "LLM" da tela de
// Configuracoes (AdminConfiguracaoLlmController) mora em
// backend/src/configuracoes/, que importa este modulo so pelos services.
@Module({
  imports: [HttpModule, PrismaModule],
  providers: [ConfiguracaoLlmService, ChaveLlmService, LlmClientService, SegredoCryptoService],
  exports: [LlmClientService, ConfiguracaoLlmService, ChaveLlmService],
})
export class LlmClientModule {}
