import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ClienteDetalheDto } from "@/lib/clientes";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { BadgeAtivoInativo } from "@/components/badge";
import { ListaGenerica } from "@/components/dado-generico";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";

// Tela de detalhe do cliente (OS-WEB-15) - mostra o que a listagem não
// mostrava: endereços e contatos. Só leitura, sem nenhuma ação de escrita
// (fora de escopo desta OS). Retrofit visual (OS-WEB-16).
export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/clientes");

  const { id } = await params;

  let cliente: ClienteDetalheDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    cliente = await apiFetch<ClienteDetalheDto>(`/clientes/${encodeURIComponent(id)}`, {
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
