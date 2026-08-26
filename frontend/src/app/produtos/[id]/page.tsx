import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { rotuloTipoProduto, rotuloTipoVenda, type ProdutoDetalheDto } from "@/lib/produtos";
import { formatarMoeda } from "@/lib/formatacao";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { ListaGenerica } from "@/components/dado-generico";
import { Card } from "@/components/design/card";
import { SecondaryButton } from "@/components/design/button";
import { SimularCalculo } from "./simular-calculo";

// Tela de detalhe do produto (OS-WEB-15) - mostra o que a listagem não
// mostrava: grade (idGrade1/2/3 + referenciasGrade). Sem "blocos fiscais"
// (não existem no modelo sincronizado, ver lib/produtos.ts). Só leitura.
// Retrofit visual (OS-WEB-16): preço de venda vira o número em destaque da
// tela (ver skill design-system, "Números grandes carregam a hierarquia").
export default async function ProdutoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/produtos");

  const { id } = await params;

  let produto: ProdutoDetalheDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    produto = await apiFetch<ProdutoDetalheDto>(`/produtos/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/produtos" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para produtos
      </Link>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Produto '${id}' não encontrado.`} />
      ) : (
        produto && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-ink">{produto.nome ?? "—"}</h1>
                <BadgeAtivoInativo inativo={produto.inativo} />
              </div>
              {produto.codigo && (
                <SecondaryButton href={`/estoque?identificador=${encodeURIComponent(produto.codigo)}`}>
                  Ver estoque
                </SecondaryButton>
              )}
            </div>

            <Card>
              <p className="text-xs text-muted">Preço de venda</p>
              <p className="text-4xl font-bold text-ink">{formatarMoeda(produto.precoVenda)}</p>
            </Card>

            <Card className="grid grid-cols-1 gap-4 text-sm text-ink sm:grid-cols-2">
              <p>
                <span className="font-medium">Código:</span> {produto.codigo ?? "—"}
              </p>
              <p>
                <span className="font-medium">Tipo:</span> {rotuloTipoProduto(produto.tipo)}
              </p>
              <p>
                <span className="font-medium">GTIN:</span> {produto.gtin ?? "—"}
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Tipo de venda:</span>
                <Badge enfase={produto.tipoVenda !== null}>
                  {rotuloTipoVenda(produto.tipoVenda)}
                </Badge>
              </p>
              {produto.comprimentoMetros && (
                <p>
                  <span className="font-medium">Comprimento por peça:</span>{" "}
                  {produto.comprimentoMetros}m
                </p>
              )}
            </Card>

            <SimularCalculo produtoId={produto.id} />

            {(produto.idGrade1 || produto.idGrade2 || produto.idGrade3) && (
              <Card className="text-sm text-ink">
                <p className="mb-2 font-medium">Grade</p>
                <div className="flex gap-6">
                  {produto.idGrade1 && <span>Grade 1: {produto.idGrade1}</span>}
                  {produto.idGrade2 && <span>Grade 2: {produto.idGrade2}</span>}
                  {produto.idGrade3 && <span>Grade 3: {produto.idGrade3}</span>}
                </div>
              </Card>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Referências de grade</h2>
              <ListaGenerica
                valor={produto.referenciasGrade}
                mensagemVazio="Nenhuma referência de grade."
              />
            </section>
          </>
        )
      )}
    </main>
  );
}
