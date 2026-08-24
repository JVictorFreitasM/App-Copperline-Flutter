import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminLlmController } from './admin-llm.controller';
import { ConfiguracaoLlmService } from './configuracao-llm.service';
import { LlmClientService } from './llm-client.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [AdminLlmController],
  providers: [ConfiguracaoLlmService, LlmClientService],
  exports: [LlmClientService],
})
export class LlmClientModule {}
