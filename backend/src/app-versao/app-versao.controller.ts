import {
  Controller,
  Get,
  Header,
  Logger,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AppVersaoService, type AppVersaoDto } from './app-versao.service';

// Protegido por requireAuth via MiddlewareConsumer (ver app-versao.module.ts):
// so quem esta logado consulta a versao e baixa o APK.
@Controller('app/versao')
export class AppVersaoController {
  private readonly logger = new Logger(AppVersaoController.name);

  constructor(private readonly appVersaoService: AppVersaoService) {}

  // `instalada` (versionCode que o celular roda) so serve de registro: o backend
  // nao decide nada por ele - quem compara e bloqueia e' o app. Util pra saber
  // quem ainda esta numa versao velha e pra diagnosticar "a atualizacao nao
  // apareceu" (sem esta linha nao ha como saber se o celular chegou a perguntar).
  @Get('android')
  async versao(@Query('instalada') instalada?: string): Promise<AppVersaoDto> {
    const { arquivo: _arquivo, ...versao } = await this.appVersaoService.obterUltima();
    const rodando = /^\d{1,9}$/.test(instalada ?? '') ? Number(instalada) : null;
    this.logger.log(
      `Consulta de versao: celular na versao ${rodando ?? 'desconhecida'}, publicada ${versao.versionCode}` +
        (rodando !== null && rodando < versao.versionCode ? ' (precisa atualizar)' : ''),
    );
    return versao;
  }

  // Limite por usuario: o APK tem ~20 MB; sem limite, um app em loop de
  // download esgota banda do servidor.
  @Get('android/apk')
  @UseGuards(RateLimitGuard)
  @RateLimit({ prefixo: 'app-apk', limite: 10, janelaSegundos: 60 })
  @Header('Cache-Control', 'no-store')
  async apk(): Promise<StreamableFile> {
    const { stream, tamanhoBytes, nomeArquivo } = await this.appVersaoService.abrirApk();
    this.logger.log(`Download do APK ${nomeArquivo} iniciado`);
    return new StreamableFile(stream, {
      type: 'application/vnd.android.package-archive',
      disposition: `attachment; filename="${nomeArquivo}"`,
      length: tamanhoBytes,
    });
  }
}
