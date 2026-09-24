import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { CondicaoPagamentoDto, FormaPagamentoDto } from "@/lib/pagamento";
import type { MeuVendedorDto, VendedorEquipeDto } from "@/lib/vendedores";
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
export default async function NovoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ orcamento?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/pedidos/novo");
  // Épico 4 (config-aba-orcamento.jpg) - "Criar orçamento" na listagem
  // (page.tsx) aponta pra esta mesma tela com ?orcamento=1, único jeito
  // de diferenciar os dois botões sem duplicar o formulário inteiro.
  const { orcamento } = await searchParams;
  const modoOrcamento = orcamento === "1";

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

  // Campo "Vendedor" (web only, ver criar-pedido-form.tsx) - GET
  // /vendedores/equipe 403 pra quem nao tem papel de supervisao (vendedor
  // comum) - tratado como "sem equipe" (dropdown nao aparece), nao como
  // falha da pagina. GET /vendedores/me sempre resolve (mesmo endpoint ja'
  // usado em app-shell.tsx pra decidir o link "Aprovações").
  let meuVendedor: MeuVendedorDto = { vendedorId: null, papel: null, podeAprovar: false };
  let vendedoresEquipe: VendedorEquipeDto[] = [];
  try {
    meuVendedor = await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" });
  } catch {
    // Silencioso - campo Vendedor fica fixo/sem dropdown.
  }
  try {
    vendedoresEquipe = await apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", {
      cache: "no-store",
    });
  } catch {
    // 403 (sem papel de supervisao, caso normal pra vendedor comum) ou
    // qualquer outro erro - so' fica sem a lista, campo Vendedor cai pro
    // fallback fixo (sem dropdown), nunca derruba a pagina.
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para pedidos
      </Link>
      <h1 className="text-2xl font-bold text-ink">{modoOrcamento ? "Novo orçamento" : "Novo pedido"}</h1>
      <CriarPedidoForm
        formasPagamento={formasPagamento}
        condicoesPagamento={condicoesPagamento}
        meuVendedor={meuVendedor}
        vendedoresEquipe={vendedoresEquipe}
        nomeUsuarioLogado={usuario.name}
        modoOrcamento={modoOrcamento}
      />
    </main>
  );
}
