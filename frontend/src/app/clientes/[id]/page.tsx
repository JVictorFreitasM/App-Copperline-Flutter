import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ClienteDetalheDto, ClienteEstatisticasDto } from "@/lib/clientes";
import { statusVisita, type VisitaDto } from "@/lib/visitas";
import { formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { ListaGenerica } from "@/components/dado-generico";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";
import { StatCard } from "@/components/design/stat-card";
import { IconeClipboard, IconeMoeda, IconePessoas } from "@/components/design/icons";

// Tela de detalhe do cliente (OS-WEB-15) - mostra o que a listagem não
// mostrava: endereços e contatos. Retrofit visual (OS-WEB-16). Expandida
// na OS-WEB-23 com as métricas de OS-BACKEND-26 (GET /:id/estatisticas -
// totais e ticket médio já vêm calculados pelo backend, o front só
// formata, ver lib/clientes.ts) e o histórico de visitas de OS-BACKEND-28
// (GET /:id/visitas). Ainda só leitura - nenhuma ação de escrita aqui.
export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/clientes");

  const { id } = await params;

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
      apiFetch<ClienteEstatisticasDto>(`/clientes/${encodeURIComponent(id)}/estatisticas`, {
        cache: "no-store",
      }),
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
