import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CredenciaisErpService } from '../credenciais-erp/credenciais-erp.service';
import type { CredencialErpDto } from '../credenciais-erp/credenciais-erp.service';
import { ErpClientService } from '../erp-client/erp-client.service';
import { AtualizarCredenciaisErpDto } from './dto/atualizar-credenciais-erp.dto';

export interface TesteConexaoErpDto {
  ok: boolean;
  mensagem: string;
}

// Protegido por requireAuth + requireRole('admin') (ver configuracoes.module.ts).
// Senhas nunca saem daqui (so "definida"); valores sao gravados cifrados.
@Controller('admin/configuracoes/credenciais-erp')
export class AdminCredenciaisErpController {
  constructor(
    private readonly credenciais: CredenciaisErpService,
    private readonly erpClient: ErpClientService,
  ) {}

  @Get()
  listar(): CredencialErpDto[] {
    return this.credenciais.listar();
  }

  @Patch()
  async atualizar(
    @Body() dto: AtualizarCredenciaisErpDto,
    @CurrentUser() admin: IdpUser,
  ): Promise<CredencialErpDto[]> {
    await this.credenciais.salvar(dto.valores, admin.sub);
    return this.credenciais.listar();
  }

  // Autentica no WK Radar com as credenciais atuais (so o POST de token - nao
  // altera nada no ERP). Acionado pelo admin no botao "Testar conexao".
  @Post('testar-radar')
  @HttpCode(200)
  async testarRadar(): Promise<TesteConexaoErpDto> {
    try {
      await this.erpClient.testarAutenticacao();
      return { ok: true, mensagem: 'Autenticação no WK Radar realizada com sucesso.' };
    } catch (erro) {
      return { ok: false, mensagem: `Não foi possível autenticar no WK Radar: ${mensagemDoErro(erro)}` };
    }
  }
}

function mensagemDoErro(erro: unknown): string {
  const resposta = (erro as { response?: { status?: number; data?: { message?: string; error?: string } } })
    .response;
  if (resposta) {
    const detalhe = resposta.data?.message ?? resposta.data?.error;
    return `HTTP ${resposta.status ?? '?'}${detalhe ? ` - ${detalhe}` : ''}`;
  }
  return erro instanceof Error ? erro.message : String(erro);
}
