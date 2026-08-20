import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

// Modulo de referencia (OS 03) - nao e um modulo de negocio. Demonstra os
// tres padroes de protecao de rota disponiveis no projeto, pra futuros
// modulos copiarem em vez de reinventar. Ver README.md desta pasta.
@Controller('exemplos/autorizacao')
export class AuthorizationExampleController {
  // Protegido so por requireAuth (ver AuthorizationExampleModule.configure).
  // Qualquer usuario autenticado no SSO, independente de role, acessa.
  @Get('perfil')
  perfil(@CurrentUser() user: IdpUser): IdpUser {
    return user;
  }

  // Protegido por requireAuth + requireRole('admin') encadeados (ver
  // AuthorizationExampleModule.configure). Autenticado mas sem o role
  // 'admin' recebe 403 do proprio requireRole.
  @Post('admin')
  admin(@CurrentUser() user: IdpUser): { mensagem: string } {
    return { mensagem: `Acao administrativa executada por ${user.email}` };
  }

  // Protegido por ApiKeyGuard (nao passa pelo SSO) - padrao pra endpoints
  // administrativos internos chamados por automacao/servico, nao por um
  // usuario logado (ex: disparo manual de sincronizacao com o ERP).
  @Post('sync-manual')
  @UseGuards(ApiKeyGuard)
  syncManual(): { mensagem: string } {
    return { mensagem: 'Sincronizacao manual disparada' };
  }
}
