import { Controller, Get, Header, StreamableFile, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { AppVersaoService, type AppVersaoDto } from './app-versao.service';

// Protegido por requireAuth via MiddlewareConsumer (ver app-versao.module.ts):
// so quem esta logado consulta a versao e baixa o APK.
@Controller('app/versao')
export class AppVersaoController {
  constructor(private readonly appVersaoService: AppVersaoService) {}

  @Get('android')
  async versao(): Promise<AppVersaoDto> {
    const { arquivo: _arquivo, ...versao } = await this.appVersaoService.obterUltima();
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
    return new StreamableFile(stream, {
      type: 'application/vnd.android.package-archive',
      disposition: `attachment; filename="${nomeArquivo}"`,
      length: tamanhoBytes,
    });
  }
}
