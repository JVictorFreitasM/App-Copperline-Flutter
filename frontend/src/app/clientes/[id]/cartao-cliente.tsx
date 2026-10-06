import type { ReactNode } from "react";
import { BadgeAlteracaoErp, BadgeAtivoInativo, BadgeStatusEnvioErp } from "@/components/badge";
import { Card } from "@/components/design/card";
import type { ClienteDetalheDto, EnderecoClienteDto } from "@/lib/clientes";
import { formatarTelefone } from "@/lib/formatacao";

// Só http(s) vira link - homepage vem do cadastro do ERP (texto livre), então
// um "javascript:..." nunca pode chegar num href.
function urlSegura(homepage: string): string | null {
  const comProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(homepage) ? homepage : `https://${homepage}`;
  try {
    const url = new URL(comProtocolo);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function linhaEndereco(endereco: EnderecoClienteDto): string[] {
  const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const bairroUf = [endereco.bairro, endereco.uf].filter(Boolean).join(" - ");
  return [
    [rua, endereco.complemento].filter(Boolean).join(" - "),
    bairroUf,
    endereco.cep ? `CEP ${endereco.cep}` : "",
  ].filter(Boolean);
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted">{rotulo}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

// Card de apresentação do cliente (topo do detalhe): identificação, contato
// e endereço. Só leitura - tudo vem pronto de GET /clientes/:id.
export function CartaoCliente({ cliente }: { cliente: ClienteDetalheDto }) {
  const titulo = cliente.razaoSocial ?? cliente.nomeFantasia ?? "—";
  const [principal, ...outrosEnderecos] = cliente.enderecos;

  // Telefones/e-mail de cada endereço contam como contato do cliente (é onde
  // o ERP guarda) - dedup pra não repetir o mesmo número em dois endereços.
  const telefones = [
    ...new Set(
      cliente.enderecos.flatMap((endereco) =>
        endereco.telefones.map((telefone) => formatarTelefone(telefone.ddd, telefone.numero)),
      ),
    ),
  ];
  const emails = [
    ...new Set(
      [cliente.email, ...cliente.enderecos.map((endereco) => endereco.email)].filter(
        (email): email is string => Boolean(email),
      ),
    ),
  ];
  const homepage = cliente.homepage ? urlSegura(cliente.homepage) : null;

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-2xl font-bold text-primary">
          {titulo.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink">{titulo}</h1>
            <BadgeAtivoInativo inativo={cliente.inativo} />
            <BadgeStatusEnvioErp status={cliente.statusEnvioErp} />
            <BadgeAlteracaoErp alteracao={cliente.alteracaoErp} />
          </div>
          {cliente.statusEnvioErp === "ERRO" && cliente.erroEnvioErp && (
            <p className="text-xs text-muted">
              O ERP recusou o cadastro: {cliente.erroEnvioErp}. Corrija em &quot;Editar cliente&quot; - ao salvar, o cadastro é
              enviado de novo.
            </p>
          )}
          {cliente.alteracaoErp?.status === "ERRO" && cliente.alteracaoErp.erro && (
            <p className="text-xs text-muted">O ERP recusou a última alteração: {cliente.alteracaoErp.erro}</p>
          )}
          {cliente.nomeFantasia && cliente.nomeFantasia !== cliente.razaoSocial && (
            <p className="text-sm text-muted">{cliente.nomeFantasia}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-3">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Identificação</h2>
          <dl className="flex flex-col gap-3">
            <Campo rotulo="Código">{cliente.codigo ?? "—"}</Campo>
            <Campo rotulo="ID do cliente">{cliente.idExternoErp}</Campo>
            <Campo rotulo="CPF/CNPJ">{cliente.cpfCnpj ?? "—"}</Campo>
            <Campo rotulo="Inscrição estadual">{cliente.inscricaoEstadual ?? "—"}</Campo>
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Contato</h2>
          <dl className="flex flex-col gap-3">
            {cliente.contato && <Campo rotulo="Contato">{cliente.contato}</Campo>}
            <Campo rotulo="Telefone">
              {telefones.length === 0
                ? "—"
                : telefones.map((telefone) => (
                    <a
                      key={telefone}
                      href={`tel:${telefone.replace(/\D/g, "")}`}
                      className="block hover:text-primary hover:underline"
                    >
                      {telefone}
                    </a>
                  ))}
            </Campo>
            <Campo rotulo="E-mail">
              {emails.length === 0
                ? "—"
                : emails.map((email) => (
                    <a
                      key={email}
                      href={`mailto:${email}`}
                      className="block break-all hover:text-primary hover:underline"
                    >
                      {email}
                    </a>
                  ))}
            </Campo>
            {cliente.homepage && (
              <Campo rotulo="Site">
                {homepage ? (
                  <a
                    href={homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all hover:text-primary hover:underline"
                  >
                    {cliente.homepage}
                  </a>
                ) : (
                  cliente.homepage
                )}
              </Campo>
            )}
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Endereço</h2>
          {principal ? (
            <address className="flex flex-col gap-0.5 text-sm not-italic text-ink">
              {linhaEndereco(principal).map((linha) => (
                <span key={linha}>{linha}</span>
              ))}
            </address>
          ) : (
            <p className="text-sm text-muted">Nenhum endereço cadastrado.</p>
          )}
          {outrosEnderecos.length > 0 && (
            <details className="text-sm text-muted">
              <summary className="cursor-pointer font-medium text-primary">
                Outros endereços ({outrosEnderecos.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-3">
                {outrosEnderecos.map((endereco, indice) => (
                  <li key={indice} className="flex flex-col text-ink">
                    {endereco.tipo && (
                      <span className="text-xs font-medium text-muted">{endereco.tipo}</span>
                    )}
                    {linhaEndereco(endereco).map((linha) => (
                      <span key={linha}>{linha}</span>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </Card>
  );
}
