import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { CondicaoPagamentoDto, FormaPagamentoDto } from "@/lib/pagamento";
import { CriarPedidoForm } from "./criar-pedido-form";

// Criação de pedido (layout de referência, ref.jpeg) - POST /pedidos já
// existia (CriarPedidoService), sem formulário web até agora. "Criar
// pedido"/"Criar orçamento" na listagem apontam pra esta mesma tela - o
// backend não modela orçamento como um fluxo separado hoje.
//
// Envio real ao WK Radar (POST /comercial/v1/pedido, OS-BACKEND-25) já
// está implementado - forma/condição de pagamento (catálogos sincronizados,
// ver GET /formas-pagamento e /condicoes-pagamento) são escolhidos aqui e
// enviados junto. idOperacaoComercial/idClassificacao/idNaturezaOperacao
// continuam de fora do envio (confirmado com o usuário: preenchidos pelo
// setor de faturamento depois, não na criação do pedido).
export default async function NovoPedidoPage() {
  await exigirUsuarioAutenticado("/pedidos/novo");

  // Isolado (mesmo critério de resiliência já usado em outras telas) - uma
  // falha aqui não derruba a página, só deixa os seletores vazios (o
  // formulário trata isso mostrando que não há opção disponível).
  let formasPagamento: FormaPagamentoDto[] = [];
  let condicoesPagamento: CondicaoPagamentoDto[] = [];
  try {
    [formasPagamento, condicoesPagamento] = await Promise.all([
      apiFetch<FormaPagamentoDto[]>("/formas-pagamento", { cache: "no-store" }),
      apiFetch<CondicaoPagamentoDto[]>("/condicoes-pagamento", { cache: "no-store" }),
    ]);
  } catch {
    // Silencioso - formulário mostra os seletores vazios, sem derrubar a tela.
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para pedidos
      </Link>
      <h1 className="text-2xl font-bold text-ink">Novo pedido</h1>
      <CriarPedidoForm formasPagamento={formasPagamento} condicoesPagamento={condicoesPagamento} />
    </main>
  );
}
