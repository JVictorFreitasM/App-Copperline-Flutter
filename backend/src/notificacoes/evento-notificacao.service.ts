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
//
// Epico 5 - alem do EventoNotificacao em si, tambem cria o "inbox" por
// usuario (NotificacaoUsuario), um por destinatario resolvido - dentro da
// MESMA transacao, pra aparecer na tela web mesmo se o disparo de push
// (NotificacaoDispatchService, fila separada, assincrona) atrasar ou
// falhar depois. Todo call site existente ganha isso de graca, sem
// precisar mudar nenhuma strategy.
export async function registrarEventoNotificacao(
  tx: PrismaTx,
  input: RegistrarEventoNotificacaoInput,
): Promise<void> {
  const evento = await tx.eventoNotificacao.create({
    data: {
      tipo: input.tipo,
      referenciaId: input.referenciaId,
      titulo: input.titulo,
      corpo: input.corpo,
      dados: input.dados as unknown as Prisma.InputJsonValue,
    },
  });

  const usuarioIds = await resolverUsuariosAlvo(tx, {
    tipo: evento.tipo,
    referenciaId: evento.referenciaId,
  });
  if (usuarioIds.length > 0) {
    await tx.notificacaoUsuario.createMany({
      data: usuarioIds.map((usuarioId) => ({ usuarioId, eventoId: evento.id })),
      skipDuplicates: true,
    });
  }
}

// Resolve QUEM recebe um NotificacaoUsuario (inbox web) pro evento -
// DELIBERADAMENTE duplicado de NotificacaoDispatchService.resolverTokensAlvo
// (que resolve TOKENS de push, nao usuarioIds) em vez de compartilhado: sao
// pipelines diferentes (fila assincrona best-effort vs escrita sincrona na
// mesma transacao do sync), e unificar arriscaria os testes ja existentes
// do dispatch por uma dependencia cruzada desnecessaria. Se um tipo novo de
// evento entrar, ATUALIZAR OS DOIS (aqui e resolverTokensAlvo).
async function resolverUsuariosAlvo(
  tx: PrismaTx,
  evento: { tipo: TipoEventoNotificacao; referenciaId: string },
): Promise<string[]> {
  if (evento.tipo === 'PRODUTO_REABASTECIDO') {
    const favoritos = await tx.produtoFavorito.findMany({
      where: { produtoId: evento.referenciaId },
      select: { usuarioId: true },
    });
    return favoritos.map((f) => f.usuarioId);
  }

  if (evento.tipo === 'VISITA_CANCELADA') {
    const visita = await tx.visita.findUnique({
      where: { id: evento.referenciaId },
      select: { vendedor: { select: { supervisor: { select: { usuarioId: true } } } } },
    });
    const usuarioId = visita?.vendedor.supervisor?.usuarioId ?? null;
    return usuarioId ? [usuarioId] : [];
  }

  if (evento.tipo === 'SOLICITACAO_DESCONTO_CRIADA') {
    const solicitacao = await tx.solicitacaoDesconto.findUnique({
      where: { id: evento.referenciaId },
      select: { aprovadorEsperado: { select: { usuarioId: true } } },
    });
    const usuarioId = solicitacao?.aprovadorEsperado?.usuarioId ?? null;
    return usuarioId ? [usuarioId] : [];
  }

  if (evento.tipo === 'SOLICITACAO_DESCONTO_DECIDIDA') {
    const solicitacao = await tx.solicitacaoDesconto.findUnique({
      where: { id: evento.referenciaId },
      select: { vendedorSolicitante: { select: { usuarioId: true } } },
    });
    const usuarioId = solicitacao?.vendedorSolicitante.usuarioId ?? null;
    return usuarioId ? [usuarioId] : [];
  }

  if (evento.tipo === 'RELATORIO_MANHA_PEDIDOS' || evento.tipo === 'RELATORIO_FIM_DIA_PEDIDOS') {
    // referenciaId = Vendedor.id (ver RelatorioDiarioNotificacaoService) -
    // so o proprio vendedor, nunca broadcast.
    const vendedor = await tx.vendedor.findUnique({
      where: { id: evento.referenciaId },
      select: { usuarioId: true },
    });
    const usuarioId = vendedor?.usuarioId ?? null;
    return usuarioId ? [usuarioId] : [];
  }

  // PEDIDO_SITUACAO_ALTERADA / NOTA_FISCAL_REJEITADA: broadcast pra todo
  // usuario cadastrado - diferente do broadcast de push (que so alcanca
  // quem tem AO MENOS UM dispositivo registrado), aqui e' toda linha de
  // Usuario mesmo, ja que o inbox web nao depende de token de push nenhum.
  const usuarios = await tx.usuario.findMany({ select: { id: true } });
  return usuarios.map((u) => u.id);
}
