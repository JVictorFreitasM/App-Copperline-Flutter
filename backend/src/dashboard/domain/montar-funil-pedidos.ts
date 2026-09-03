// OS-WEB-41 - funil de pedidos usando SOMENTE Pedido.situacao (ja
// sincronizado do ERP, sempre presente) - as etapas "aguardando aprovacao"/
// "aprovado" do texto original da OS vem de Pedido.statusLocal, campo que
// so existe pra pedido criado localmente pelo app (ainda bloqueado,
// OS-BACKEND-25) - hoje 100% dos pedidos vem de sync do ERP e teriam
// statusLocal nulo, o que faria essas duas etapas aparecerem sempre
// vazias (numero falso, nao "sem dado"). Em vez disso, o funil usa a
// progressao real que TipoSituacaoPedido ja expressa. CANCELADO/BLOQUEADO
// sao estados de excecao (fim de linha negativo), reportados a parte -
// nao fazem parte da progressao "o pedido esta avancando".
import type { TipoSituacaoPedido } from '../../../generated/prisma/client';

export interface EtapaFunil {
  etapa: string;
  quantidade: number;
}

const SITUACOES_EM_PROCESSAMENTO: TipoSituacaoPedido[] = ['EM_ANALISE', 'PENDENTE'];
const SITUACOES_ATENDIMENTO_PARCIAL: TipoSituacaoPedido[] = [
  'PARCIALMENTE_ATENDIDO',
  'PARCIALMENTE_FATURADO',
];
const SITUACOES_CONCLUIDO: TipoSituacaoPedido[] = ['ATENDIDO', 'FATURADO'];

export interface ContagemPorSituacao {
  situacao: TipoSituacaoPedido | null;
  quantidade: number;
}

export function montarFunilPedidos(contagens: ContagemPorSituacao[]): {
  etapas: EtapaFunil[];
  cancelados: number;
  bloqueados: number;
} {
  const total = contagens.reduce((soma, c) => soma + c.quantidade, 0);
  const somar = (situacoes: TipoSituacaoPedido[]) =>
    contagens
      .filter((c) => c.situacao !== null && situacoes.includes(c.situacao))
      .reduce((soma, c) => soma + c.quantidade, 0);

  return {
    etapas: [
      { etapa: 'Criado', quantidade: total },
      { etapa: 'Em processamento', quantidade: somar(SITUACOES_EM_PROCESSAMENTO) },
      { etapa: 'Atendimento parcial', quantidade: somar(SITUACOES_ATENDIMENTO_PARCIAL) },
      { etapa: 'Concluído', quantidade: somar(SITUACOES_CONCLUIDO) },
    ],
    cancelados: somar(['CANCELADO']),
    bloqueados: somar(['BLOQUEADO']),
  };
}
