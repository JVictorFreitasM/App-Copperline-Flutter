import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { MensagemPeriodica } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularProximoEnvio,
  RecorrenciaInvalidaError,
  type FrequenciaMensagem,
  type RecorrenciaMensagem,
} from './domain/proximo-envio-periodico';
import type { SalvarMensagemPeriodicaDto } from './dto/salvar-mensagem-periodica.dto';
import { MensagensNotificacaoService, rotuloDoDestino } from './mensagens-notificacao.service';

export interface MensagemPeriodicaDto {
  id: string;
  assunto: string;
  corpo: string;
  destino: 'TODOS' | 'VENDEDOR' | 'GRUPO';
  destinoRotulo: string;
  vendedorId: string | null;
  grupoId: string | null;
  frequencia: FrequenciaMensagem;
  horario: string;
  diaSemana: number | null;
  diaMes: number | null;
  ativa: boolean;
  proximoEnvioEm: string;
  ultimoEnvioEm: string | null;
  ultimoErro: string | null;
}

type PeriodicaComDestino = MensagemPeriodica & {
  vendedor: { nome: string | null } | null;
  grupo: { nome: string } | null;
};

const INCLUDE_DESTINO = {
  vendedor: { select: { nome: true } },
  grupo: { select: { nome: true } },
} as const;

// Agendamento de mensagens manuais. O QUANDO e' regra de dominio
// (domain/proximo-envio-periodico.ts); este service so orquestra: grava,
// e a cada minuto dispara as que venceram reaproveitando o MESMO caminho de
// envio avulso (MensagensNotificacaoService.enviar) - historico, inbox e
// push ficam identicos.
@Injectable()
export class MensagensPeriodicasService {
  private readonly logger = new Logger(MensagensPeriodicasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mensagensService: MensagensNotificacaoService,
  ) {}

  async listar(): Promise<MensagemPeriodicaDto[]> {
    const periodicas = await this.prisma.mensagemPeriodica.findMany({
      orderBy: [{ ativa: 'desc' }, { proximoEnvioEm: 'asc' }],
      include: INCLUDE_DESTINO,
    });
    return periodicas.map(paraDto);
  }

  async criar(autorId: string, dto: SalvarMensagemPeriodicaDto): Promise<MensagemPeriodicaDto> {
    await this.garantirDestinoExiste(dto);
    const proximoEnvioEm = this.proximoEnvio(dto, new Date());

    const criada = await this.prisma.mensagemPeriodica.create({
      data: { autorId, ...dadosDoDto(dto), proximoEnvioEm },
      include: INCLUDE_DESTINO,
    });
    return paraDto(criada);
  }

  async atualizar(id: string, dto: SalvarMensagemPeriodicaDto): Promise<MensagemPeriodicaDto> {
    await this.garantirExiste(id);
    await this.garantirDestinoExiste(dto);
    // Editar reagenda a partir de agora - nunca dispara na hora so porque o
    // horario antigo ja tinha passado.
    const proximoEnvioEm = this.proximoEnvio(dto, new Date());

    const atualizada = await this.prisma.mensagemPeriodica.update({
      where: { id },
      data: { ...dadosDoDto(dto), proximoEnvioEm, ultimoErro: null },
      include: INCLUDE_DESTINO,
    });
    return paraDto(atualizada);
  }

  async alternar(id: string, ativa: boolean): Promise<MensagemPeriodicaDto> {
    const existente = await this.garantirExiste(id);
    const data: { ativa: boolean; proximoEnvioEm?: Date } = { ativa };
    if (ativa) {
      // Religar nao pode "recuperar" os disparos perdidos enquanto estava
      // pausada - reagenda a partir de agora.
      data.proximoEnvioEm = this.proximoEnvio(existente, new Date());
    }
    const atualizada = await this.prisma.mensagemPeriodica.update({
      where: { id },
      data,
      include: INCLUDE_DESTINO,
    });
    return paraDto(atualizada);
  }

  async remover(id: string): Promise<void> {
    await this.garantirExiste(id);
    // Mensagens ja enviadas por ela ficam no historico (periodicaId vira null).
    await this.prisma.mensagemPeriodica.delete({ where: { id } });
  }

  // Chamado a cada minuto pelo processor. Cada periodica vencida e'
  // "reivindicada" com um update condicional em proximoEnvioEm ANTES de
  // enviar - se dois workers/jobs sobrepostos pegarem a mesma, so um ganha
  // (count 1) e o outro pula, entao nunca envia em duplicidade. Backend
  // parado por dias dispara UMA vez ao voltar (o proximo envio e' calculado
  // a partir de agora), nunca uma rajada de mensagens atrasadas.
  async executarDevidas(agora: Date = new Date()): Promise<number> {
    const devidas = await this.prisma.mensagemPeriodica.findMany({
      where: { ativa: true, proximoEnvioEm: { lte: agora } },
      orderBy: { proximoEnvioEm: 'asc' },
    });

    let enviadas = 0;
    for (const periodica of devidas) {
      const reivindicada = await this.prisma.mensagemPeriodica.updateMany({
        where: { id: periodica.id, ativa: true, proximoEnvioEm: periodica.proximoEnvioEm },
        data: { proximoEnvioEm: this.proximoEnvio(periodica, agora) },
      });
      if (reivindicada.count === 0) continue;

      try {
        await this.mensagensService.enviar(
          periodica.autorId,
          {
            destino: periodica.destino,
            vendedorId: periodica.vendedorId ?? undefined,
            grupoId: periodica.grupoId ?? undefined,
            assunto: periodica.assunto,
            mensagem: periodica.corpo,
          },
          periodica.id,
        );
        await this.prisma.mensagemPeriodica.update({
          where: { id: periodica.id },
          data: { ultimoEnvioEm: agora, ultimoErro: null },
        });
        enviadas += 1;
      } catch (error) {
        const motivo = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Mensagem periódica ${periodica.id} não enviada: ${motivo}`);
        await this.prisma.mensagemPeriodica.update({
          where: { id: periodica.id },
          data: { ultimoErro: motivo.slice(0, 500) },
        });
      }
    }
    return enviadas;
  }

  private proximoEnvio(recorrencia: RecorrenciaMensagem, apos: Date): Date {
    try {
      return calcularProximoEnvio(recorrencia, apos);
    } catch (error) {
      if (error instanceof RecorrenciaInvalidaError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }
  }

  private async garantirExiste(id: string): Promise<MensagemPeriodica> {
    const periodica = await this.prisma.mensagemPeriodica.findUnique({ where: { id } });
    if (!periodica) {
      throw new NotFoundException(`Mensagem periódica '${id}' não encontrada`);
    }
    return periodica;
  }

  private async garantirDestinoExiste(dto: SalvarMensagemPeriodicaDto): Promise<void> {
    if (dto.destino === 'VENDEDOR') {
      const vendedor = await this.prisma.vendedor.findUnique({ where: { id: dto.vendedorId } });
      if (!vendedor) throw new NotFoundException(`Vendedor '${dto.vendedorId}' não encontrado`);
    }
    if (dto.destino === 'GRUPO') {
      const grupo = await this.prisma.grupoMensagem.findUnique({ where: { id: dto.grupoId } });
      if (!grupo) throw new NotFoundException(`Grupo '${dto.grupoId}' não encontrado`);
    }
  }
}

function dadosDoDto(dto: SalvarMensagemPeriodicaDto) {
  return {
    destino: dto.destino,
    vendedorId: dto.destino === 'VENDEDOR' ? dto.vendedorId : null,
    grupoId: dto.destino === 'GRUPO' ? dto.grupoId : null,
    assunto: dto.assunto,
    corpo: dto.mensagem,
    frequencia: dto.frequencia,
    horario: dto.horario,
    diaSemana: dto.frequencia === 'SEMANAL' ? dto.diaSemana : null,
    diaMes: dto.frequencia === 'MENSAL' ? dto.diaMes : null,
  };
}

function paraDto(periodica: PeriodicaComDestino): MensagemPeriodicaDto {
  return {
    id: periodica.id,
    assunto: periodica.assunto,
    corpo: periodica.corpo,
    destino: periodica.destino,
    destinoRotulo: rotuloDoDestino(
      periodica.destino,
      periodica.vendedor?.nome ?? null,
      periodica.grupo?.nome ?? null,
    ),
    vendedorId: periodica.vendedorId,
    grupoId: periodica.grupoId,
    frequencia: periodica.frequencia,
    horario: periodica.horario,
    diaSemana: periodica.diaSemana,
    diaMes: periodica.diaMes,
    ativa: periodica.ativa,
    proximoEnvioEm: periodica.proximoEnvioEm.toISOString(),
    ultimoEnvioEm: periodica.ultimoEnvioEm ? periodica.ultimoEnvioEm.toISOString() : null,
    ultimoErro: periodica.ultimoErro,
  };
}
