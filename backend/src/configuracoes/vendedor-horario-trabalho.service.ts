import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracaoRastreioService } from './configuracao-rastreio.service';

export interface HorarioTrabalhoDto {
  horarioInicioTrabalho: string | null;
  horarioFimTrabalho: string | null;
  // true quando o admin desabilitou a edicao (ConfiguracaoRastreio.
  // desabilitarEdicaoHorarioTrabalhoAndroid) - o app usa isso pra
  // mostrar os campos so leitura em vez de deixar o vendedor tentar
  // editar e levar 403.
  edicaoDesabilitada: boolean;
}

// GET/PATCH /vendedores/me/horario-trabalho (Epico 4, config-aba-
// rastreio.jpg - "Desabilitar edição de horário de trabalho no
// Android"). Vive em ConfiguracoesModule (nao VendedoresModule) so pra
// evitar import circular: VendedoresModule -> ConfiguracoesModule (pra
// ler o toggle) -> SolicitacoesDescontoModule -> VendedoresModule (ja
// importado la pra VendedorEscopoService). O path da rota continua
// /vendedores/me/... (Nest nao exige que o path bata com o nome do
// modulo que declara o controller).
@Injectable()
export class VendedorHorarioTrabalhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracaoRastreioService: ConfiguracaoRastreioService,
  ) {}

  async obter(usuarioId: string): Promise<HorarioTrabalhoDto> {
    const [vendedor, configRastreio] = await Promise.all([
      this.prisma.vendedor.findFirst({
        where: { usuarioId },
        select: { horarioInicioTrabalho: true, horarioFimTrabalho: true },
      }),
      this.configuracaoRastreioService.obter(),
    ]);

    return {
      horarioInicioTrabalho: vendedor?.horarioInicioTrabalho ?? null,
      horarioFimTrabalho: vendedor?.horarioFimTrabalho ?? null,
      edicaoDesabilitada: configRastreio.desabilitarEdicaoHorarioTrabalhoAndroid,
    };
  }

  async atualizar(
    usuarioId: string,
    input: { horarioInicioTrabalho: string; horarioFimTrabalho: string },
  ): Promise<HorarioTrabalhoDto> {
    const configRastreio = await this.configuracaoRastreioService.obter();
    if (configRastreio.desabilitarEdicaoHorarioTrabalhoAndroid) {
      throw new ForbiddenException(
        'Edição de horário de trabalho está desabilitada pelo admin - o horário global de rastreio é usado pra todos os vendedores',
      );
    }

    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - não tem horário de trabalho pra editar',
      );
    }

    const atualizado = await this.prisma.vendedor.update({
      where: { id: vendedor.id },
      data: {
        horarioInicioTrabalho: input.horarioInicioTrabalho,
        horarioFimTrabalho: input.horarioFimTrabalho,
      },
      select: { horarioInicioTrabalho: true, horarioFimTrabalho: true },
    });

    return {
      horarioInicioTrabalho: atualizado.horarioInicioTrabalho,
      horarioFimTrabalho: atualizado.horarioFimTrabalho,
      edicaoDesabilitada: false,
    };
  }
}
