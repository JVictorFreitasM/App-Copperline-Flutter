import { exigirUsuarioAutenticado } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type { PosicaoAtualVendedorDto } from "@/lib/rastreio";
import { Card } from "@/components/design/card";
import { ErroConexao } from "@/components/listagem-feedback";
import { PainelRastreioEquipe } from "./painel-rastreio-equipe";

// Painel de rastreio de equipe (OS-WEB-24) - consome GET /rastreio/equipe
// (últimas posições) e, sob demanda, GET /rastreio/equipe/:id/trajeto (via
// Route Handler local, ver painel-rastreio-equipe.tsx). Mesmo critério de
// acesso de /aprovacoes (OS-WEB-21): sessão SSO normal, sem gate por
// role:'admin' aqui (papel de vendas é resolvido pelo PRÓPRIO backend via
// VendedorEscopoService) - um 403 vira "sem permissão", não notFound(),
// porque qualquer supervisor/gerente legítimo deve chegar até aqui,
// independente do role do IdP. "Vendedor comum não acessa a tela"
// (critério de aceite) é garantido pelo backend: escopo PROPRIO/NENHUM
// sempre lança ForbiddenException em GET /rastreio/equipe.
export default async function RastreioEquipePage() {
  await exigirUsuarioAutenticado("/rastreio-equipe");

  let posicoes: PosicaoAtualVendedorDto[] | null = null;
  let semPermissao = false;
  let erro: string | null = null;

  try {
    posicoes = await apiFetch<PosicaoAtualVendedorDto[]>("/rastreio/equipe", {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      semPermissao = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Rastreio de equipe</h1>

      {semPermissao ? (
        <Card>
          <p className="text-sm text-muted">
            Você não tem papel de supervisão (supervisor ou gerente) - nenhuma equipe para
            acompanhar aqui.
          </p>
        </Card>
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        posicoes && <PainelRastreioEquipe posicoes={posicoes} />
      )}
    </main>
  );
}
