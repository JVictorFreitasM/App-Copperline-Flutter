import Form from "next/form";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type {
  ClienteDetalheDto,
  ClienteEstatisticasDto,
  ClienteFinanceiroDto,
} from "@/lib/clientes";
import { statusVisita, type VisitaDto } from "@/lib/visitas";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { ListaGenerica } from "@/components/dado-generico";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { ListItem } from "@/components/design/list-item";
import { StatCard } from "@/components/design/stat-card";
import { IconeClipboard, IconeMoeda, IconePessoas } from "@/components/design/icons";

// Opções fixas de período (OS-WEB-31, critério de aceite explícito: "1 e 6
// meses") - 12 meses mantido como terceira opção (era o único valor antes
// desta OS, default do backend em ClienteEstatisticasQueryDto).
const OPCOES_MESES = [1, 6, 12] as const;

// Tela de detalhe do cliente (OS-WEB-15) - mostra o que a listagem não
// mostrava: endereços e contatos. Retrofit visual (OS-WEB-16). Expandida
// na OS-WEB-23 com as métricas de OS-BACKEND-26 (GET /:id/estatisticas -
// totais e ticket médio já vêm calculados pelo backend, o front só
// formata, ver lib/clientes.ts) e o histórico de visitas de OS-BACKEND-28
// (GET /:id/visitas). Ainda só leitura - nenhuma ação de escrita aqui.
export default async function ClienteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meses?: string }>;
}) {
  await exigirUsuarioAutenticado("/clientes");

  const { id } = await params;
  const mesesParam = Number((await searchParams).meses);
  const meses = OPCOES_MESES.includes(mesesParam as (typeof OPCOES_MESES)[number])
    ? mesesParam
    : 12;

  let cliente: ClienteDetalheDto | null = null;
  let estatisticas: ClienteEstatisticasDto | null = null;
  let visitas: VisitaDto[] = [];
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    cliente = await apiFetch<ClienteDetalheDto>(`/clientes/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    [estatisticas, visitas] = await Promise.all([
      apiFetch<ClienteEstatisticasDto>(
        `/clientes/${encodeURIComponent(id)}/estatisticas?meses=${meses}`,
        { cache: "no-store" },
      ),
      apiFetch<VisitaDto[]>(`/clientes/${encodeURIComponent(id)}/visitas`, {
        cache: "no-store",
      }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  // Informações financeiras (OS-BACKEND-36/OS-WEB-31) buscadas à parte,
  // com sua própria falha isolada (mesmo critério de resiliência da
  // OS-WEB-29) - uma consulta ao vivo no ERP mais lenta/instável não deve
  // derrubar o resto da tela de cliente, que já teve sucesso acima.
  let financeiro: ClienteFinanceiroDto | null = null;
  let erroFinanceiro: string | null = null;
  if (cliente) {
    try {
      financeiro = await apiFetch<ClienteFinanceiroDto>(
        `/clientes/${encodeURIComponent(id)}/financeiro`,
        { cache: "no-store" },
      );
    } catch (error) {
      erroFinanceiro =
        error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/clientes" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para clientes
      </Link>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Cliente '${id}' não encontrado.`} />
      ) : (
        cliente && (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-ink">
                {cliente.razaoSocial ?? cliente.nomeFantasia ?? "—"}
              </h1>
              <BadgeAtivoInativo inativo={cliente.inativo} />
            </div>
            {cliente.nomeFantasia && cliente.nomeFantasia !== cliente.razaoSocial && (
              <p className="-mt-4 text-sm text-muted">{cliente.nomeFantasia}</p>
            )}

            <Card className="text-sm text-ink">
              <p>
                <span className="font-medium">CPF/CNPJ:</span> {cliente.cpfCnpj ?? "—"}
              </p>
            </Card>

            <Form
              action={`/clientes/${encodeURIComponent(id)}`}
              scroll={false}
              className="flex items-end gap-3"
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Período das estatísticas
                <select
                  name="meses"
                  defaultValue={meses}
                  className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                >
                  {OPCOES_MESES.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao === 1 ? "Último mês" : `Últimos ${opcao} meses`}
                    </option>
                  ))}
                </select>
              </label>
              <PrimaryButton type="submit">Aplicar</PrimaryButton>
            </Form>

            {estatisticas && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  icon={<IconeMoeda />}
                  label={`Total (últimos ${estatisticas.meses} meses)`}
                  value={formatarMoeda(String(estatisticas.totalUltimosMeses))}
                />
                <StatCard
                  icon={<IconeMoeda />}
                  label={`Total geral (${estatisticas.quantidadePedidos} pedido(s))`}
                  value={formatarMoeda(String(estatisticas.totalGeral))}
                />
                <StatCard
                  icon={<IconeClipboard />}
                  label="Ticket médio"
                  value={formatarMoeda(String(estatisticas.ticketMedio))}
                />
                <StatCard
                  icon={<IconePessoas />}
                  label="Vendedor responsável"
                  value={estatisticas.vendedorResponsavel ?? "—"}
                />
              </div>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Informações financeiras</h2>
              {!financeiro ? (
                <ErroConexao mensagem={erroFinanceiro ?? "Dados financeiros indisponíveis."} />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard
                    icon={<IconeMoeda />}
                    label="Limite de crédito"
                    value={
                      financeiro.limiteCredito !== null
                        ? formatarMoeda(String(financeiro.limiteCredito))
                        : "—"
                    }
                  />
                  <StatCard
                    icon={<IconeClipboard />}
                    label={`Em aberto (${financeiro.notasEmAberto.quantidade})`}
                    value={formatarMoeda(String(financeiro.notasEmAberto.valorTotal))}
                  />
                  <StatCard
                    icon={<IconeClipboard />}
                    label={`Vencidas (${financeiro.notasVencidas.quantidade})`}
                    value={formatarMoeda(String(financeiro.notasVencidas.valorTotal))}
                  />
                  <div className="flex flex-col justify-center gap-1 rounded-card bg-surface p-4 shadow-sm">
                    <span className="text-xs font-medium text-muted">Situação</span>
                    <Badge enfase={financeiro.inadimplente}>
                      {financeiro.inadimplente ? "Inadimplente" : "Em dia"}
                    </Badge>
                  </div>
                </div>
              )}
              {financeiro?.dataLimiteCredito && (
                <p className="text-xs text-muted">
                  Limite de crédito válido até {formatarData(financeiro.dataLimiteCredito)}.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Visitas recentes</h2>
              {visitas.length === 0 ? (
                <EstadoVazio mensagem="Nenhuma visita registrada." />
              ) : (
                <div className="flex flex-col gap-3">
                  {visitas.map((visita) => {
                    const status = statusVisita(visita);
                    return (
                      <ListItem
                        key={visita.id}
                        titulo={formatarDataHora(visita.checkinEm)}
                        subtitulo={
                          visita.canceladaEm
                            ? (visita.motivoCancelamento ?? "Cancelada sem motivo registrado")
                            : (visita.nota ?? "Sem observações")
                        }
                        valor={
                          visita.checkoutEm ? `Checkout ${formatarDataHora(visita.checkoutEm)}` : undefined
                        }
                        tag={<Badge enfase={status.enfase}>{status.rotulo}</Badge>}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Contatos</h2>
              {cliente.contatos.length === 0 ? (
                <EstadoVazio mensagem="Nenhum contato cadastrado." />
              ) : (
                <div className="flex flex-col gap-3">
                  {cliente.contatos.map((contato) => (
                    <ListItem
                      key={contato.id}
                      avatar={(contato.nome ?? "?").charAt(0).toUpperCase()}
                      titulo={contato.nome ?? "—"}
                      subtitulo={contato.funcao ?? "Sem função registrada"}
                      valor={contato.email ?? "—"}
                      tag={
                        contato.telefoneDdd && contato.telefoneNumero
                          ? `(${contato.telefoneDdd}) ${contato.telefoneNumero}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Endereços</h2>
              <ListaGenerica
                valor={cliente.enderecos}
                mensagemVazio="Nenhum endereço cadastrado."
              />
            </section>
          </>
        )
      )}
    </main>
  );
}
