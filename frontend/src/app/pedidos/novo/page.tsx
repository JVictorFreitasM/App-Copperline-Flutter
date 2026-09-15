import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { CriarPedidoForm } from "./criar-pedido-form";

// Criação de pedido (layout de referência, ref.jpeg) - POST /pedidos já
// existia (CriarPedidoService), sem formulário web até agora. "Criar
// pedido"/"Criar orçamento" na listagem apontam pra esta mesma tela - o
// backend não modela orçamento como um fluxo separado hoje.
//
// AVISO: o envio real ao WK Radar (POST /comercial/v1/pedido) está
// fail-closed - faltam os IDs fixos de referência da empresa (filial,
// operação comercial, natureza de operação, tabela de preço, unidade de
// venda, condição de pagamento). Um pedido cujo desconto NÃO precise de
// aprovação vai falhar nesse envio (erro claro, nada fica "pendurado"
// sem registro). Um desconto que precise de aprovação segue local
// (AGUARDANDO_APROVACAO) sem tentar falar com o Radar.
export default async function NovoPedidoPage() {
  await exigirUsuarioAutenticado("/pedidos/novo");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para pedidos
      </Link>
      <h1 className="text-2xl font-bold text-ink">Novo pedido</h1>
      <CriarPedidoForm />
    </main>
  );
}
