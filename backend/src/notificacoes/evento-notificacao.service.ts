import type { Prisma, TipoEventoNotificacao } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistrarEventoNotificacaoInput {
  tipo: TipoEventoNotificacao;
  referenciaId: string;
  titulo: string;
  corpo: string;
  dados?: Record<string, unknown>;
}

// Tipo do client de transacao do Prisma - mesmo padrao ja usado em
// pedido.sync.ts/nota-fiscal.sync.ts (cada arquivo que precisa define a
// sua, derivada de PrismaService, nao ha um tipo interno exportado pelo
// client gerado pra isso).
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// Centraliza o `create` de EventoNotificacao (OS-BACKEND-19) - chamado
// pelas strategies de sync (pedido/nota-fiscal/saldo-estoque) DENTRO da
// mesma transacao do upsert (`tx`, nunca uma conexao propria), pra o
// evento so existir se a sincronizacao em si tiver sucesso. Cada strategy
// decide o QUANDO (comparacao com o valor anterior) - esta funcao so
// grava, sem logica de decisao. Funcao pura (sem estado/dependencia
// propria), nao um service injetavel - mesmo espirito de paginar()/
// filtroPeriodo().
export async function registrarEventoNotificacao(
  tx: PrismaTx,
  input: RegistrarEventoNotificacaoInput,
): Promise<void> {
  await tx.eventoNotificacao.create({
    data: {
      tipo: input.tipo,
      referenciaId: input.referenciaId,
      titulo: input.titulo,
      corpo: input.corpo,
      dados: input.dados as unknown as Prisma.InputJsonValue,
    },
  });
}
