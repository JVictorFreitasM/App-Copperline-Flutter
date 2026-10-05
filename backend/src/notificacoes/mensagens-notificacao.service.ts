import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { EnviarMensagemDto } from './dto/enviar-mensagem.dto';

export interface DestinatarioMensagemDto {
  id: string;
  nome: string;
  papel: 'VENDEDOR' | 'SUPERVISOR' | 'GERENTE';
  // false = vendedor sem usuario vinculado (nunca logou no app) - aparece na
  // lista pro admin saber, mas nao recebe a mensagem.
  comApp: boolean;
}

export interface MensagemEnviadaDto {
  id: string;
  assunto: string;
  corpo: string;
  destino: 'TODOS' | 'VENDEDOR' | 'GRUPO';
  destinoRotulo: string;
  totalDestinatarios: number;
  autorNome: string;
  criadoEm: string;
}

export interface ResultadoEnvioMensagemDto {
  id: string;
  totalDestinatarios: number;
  // Vendedores do destino escolhido que ficaram de fora por nao terem
  // usuario vinculado - nunca silencioso, a tela mostra esse numero.
  semAppVinculado: number;
}

interface VendedorAlvo {
  id: string;
  nome: string | null;
  usuarioId: string | null;
}

// Mensagem manual do admin pro app do vendedor. Transporte puro (resolve
// destinatarios, grava, enfileira) - sem regra de negocio que justifique
// entidade de dominio. Os destinatarios sao resolvidos UMA vez, no envio,
// e gravados como NotificacaoUsuario do evento: o inbox e o push
// (NotificacaoDispatchService) leem dali, nenhum dos dois re-resolve
// "Todos"/grupo depois.
@Injectable()
export class MensagensNotificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async enviar(autorId: string, dto: EnviarMensagemDto): Promise<ResultadoEnvioMensagemDto> {
    const alvos = await this.resolverVendedoresAlvo(dto);
    const usuarioIds = [
      ...new Set(alvos.flatMap((vendedor) => (vendedor.usuarioId ? [vendedor.usuarioId] : []))),
    ];

    if (usuarioIds.length === 0) {
      throw new UnprocessableEntityException(
        'Nenhum destinatário com o app vinculado - ninguém receberia a mensagem.',
      );
    }

    const mensagemId = await this.prisma.$transaction(async (tx) => {
      const mensagem = await tx.mensagemNotificacao.create({
        data: {
          autorId,
          destino: dto.destino,
          vendedorId: dto.destino === 'VENDEDOR' ? dto.vendedorId : null,
          grupoId: dto.destino === 'GRUPO' ? dto.grupoId : null,
          assunto: dto.assunto,
          corpo: dto.mensagem,
          totalDestinatarios: usuarioIds.length,
        },
      });
      const evento = await tx.eventoNotificacao.create({
        data: {
          tipo: 'MENSAGEM_DIRETA',
          referenciaId: mensagem.id,
          titulo: dto.assunto,
          corpo: dto.mensagem,
          dados: { mensagemId: mensagem.id },
        },
      });
      await tx.notificacaoUsuario.createMany({
        data: usuarioIds.map((usuarioId) => ({ usuarioId, eventoId: evento.id })),
        skipDuplicates: true,
      });
      return mensagem.id;
    });

    return {
      id: mensagemId,
      totalDestinatarios: usuarioIds.length,
      semAppVinculado: alvos.length - usuarioIds.length,
    };
  }

  async listarDestinatarios(): Promise<DestinatarioMensagemDto[]> {
    const vendedores = await this.prisma.vendedor.findMany({
      where: { inativo: false },
      select: { id: true, nome: true, papel: true, usuarioId: true },
      orderBy: { nome: 'asc' },
    });
    return vendedores.map((vendedor) => ({
      id: vendedor.id,
      nome: vendedor.nome ?? 'Sem nome',
      papel: vendedor.papel,
      comApp: vendedor.usuarioId !== null,
    }));
  }

  async listarEnviadas(page: number, limit: number): Promise<PaginatedResult<MensagemEnviadaDto>> {
    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemNotificacao.findMany({
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          autor: { select: { nome: true } },
          vendedor: { select: { nome: true } },
          grupo: { select: { nome: true } },
        },
      }),
      this.prisma.mensagemNotificacao.count(),
    ]);

    return paginar(
      mensagens.map((mensagem) => ({
        id: mensagem.id,
        assunto: mensagem.assunto,
        corpo: mensagem.corpo,
        destino: mensagem.destino,
        destinoRotulo: rotuloDoDestino(
          mensagem.destino,
          mensagem.vendedor?.nome ?? null,
          mensagem.grupo?.nome ?? null,
        ),
        totalDestinatarios: mensagem.totalDestinatarios,
        autorNome: mensagem.autor.nome,
        criadoEm: mensagem.criadoEm.toISOString(),
      })),
      total,
      page,
      limit,
    );
  }

  private async resolverVendedoresAlvo(dto: EnviarMensagemDto): Promise<VendedorAlvo[]> {
    const select = { id: true, nome: true, usuarioId: true } as const;

    if (dto.destino === 'TODOS') {
      return this.prisma.vendedor.findMany({ where: { inativo: false }, select });
    }

    if (dto.destino === 'VENDEDOR') {
      const vendedor = await this.prisma.vendedor.findUnique({
        where: { id: dto.vendedorId },
        select,
      });
      if (!vendedor) {
        throw new NotFoundException(`Vendedor '${dto.vendedorId}' não encontrado`);
      }
      return [vendedor];
    }

    const grupo = await this.prisma.grupoMensagem.findUnique({
      where: { id: dto.grupoId },
      select: {
        membros: { where: { vendedor: { inativo: false } }, select: { vendedor: { select } } },
      },
    });
    if (!grupo) {
      throw new NotFoundException(`Grupo '${dto.grupoId}' não encontrado`);
    }
    return grupo.membros.map((membro) => membro.vendedor);
  }
}

function rotuloDoDestino(
  destino: 'TODOS' | 'VENDEDOR' | 'GRUPO',
  vendedorNome: string | null,
  grupoNome: string | null,
): string {
  if (destino === 'TODOS') return 'Todos';
  if (destino === 'VENDEDOR') return vendedorNome ?? 'Vendedor removido';
  return grupoNome ? `Grupo: ${grupoNome}` : 'Grupo removido';
}
