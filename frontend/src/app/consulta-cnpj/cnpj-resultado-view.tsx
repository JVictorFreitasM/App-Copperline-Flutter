import type { ReactNode } from "react";
import { Card } from "@/components/design/card";
import { formatarMoeda } from "@/lib/formatacao";
import type { ConsultaCnpjDto } from "@/lib/consulta-cnpj";

function Campo({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="text-sm text-ink">{valor ?? "—"}</dd>
    </div>
  );
}

function simOuNao(valor: boolean | null): string {
  return valor === null ? "—" : valor ? "Sim" : "Não";
}

function montarEndereco({ logradouro, numero, complemento, bairro, municipio, uf, cep }: ConsultaCnpjDto["endereco"]) {
  const rua = [logradouro, numero].filter(Boolean).join(", ");
  const linhas = [rua, complemento, bairro, [municipio, uf].filter(Boolean).join(" - "), cep].filter(Boolean);
  return linhas.length > 0 ? linhas.join(" · ") : null;
}

// Somente leitura - dado cadastral da Receita Federal (via ReceitaWS),
// nada daqui é gravado na nossa base.
export function CnpjResultadoView({ resultado }: { resultado: ConsultaCnpjDto }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-xs text-muted">{resultado.cnpj}</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">{resultado.razaoSocial}</h2>
        {resultado.nomeFantasia && <p className="text-sm text-muted">{resultado.nomeFantasia}</p>}
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Situação cadastral" valor={resultado.situacao} />
          <Campo rotulo="Data da situação" valor={resultado.dataSituacao} />
          <Campo rotulo="Motivo da situação" valor={resultado.motivoSituacao} />
          <Campo rotulo="Abertura" valor={resultado.abertura} />
          <Campo rotulo="Tipo" valor={resultado.tipo} />
          <Campo rotulo="Porte" valor={resultado.porte} />
          <Campo rotulo="Natureza jurídica" valor={resultado.naturezaJuridica} />
          <Campo rotulo="Capital social" valor={formatarMoeda(resultado.capitalSocial)} />
          <Campo rotulo="Optante pelo Simples" valor={simOuNao(resultado.optanteSimples)} />
          <Campo rotulo="Optante pelo MEI" valor={simOuNao(resultado.optanteMei)} />
        </dl>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-ink">Contato e endereço</h3>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="Endereço" valor={montarEndereco(resultado.endereco)} />
          <Campo rotulo="Telefone" valor={resultado.telefone} />
          <Campo rotulo="E-mail" valor={resultado.email} />
        </dl>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-ink">Atividades</h3>
        <dl className="mt-4 flex flex-col gap-4">
          <Campo
            rotulo="Principal"
            valor={
              resultado.atividadePrincipal
                ? `${resultado.atividadePrincipal.codigo} - ${resultado.atividadePrincipal.descricao}`
                : null
            }
          />
          {resultado.atividadesSecundarias.length > 0 && (
            <Campo
              rotulo="Secundárias"
              valor={
                <ul className="flex flex-col gap-1">
                  {resultado.atividadesSecundarias.map((atividade) => (
                    <li key={atividade.codigo}>
                      {atividade.codigo} - {atividade.descricao}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </dl>
      </Card>

      {resultado.socios.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-ink">Quadro societário</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {resultado.socios.map((socio) => (
              <li key={`${socio.nome}-${socio.qualificacao}`} className="flex flex-col">
                <span className="text-sm text-ink">{socio.nome}</span>
                {socio.qualificacao && <span className="text-xs text-muted">{socio.qualificacao}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {resultado.ultimaAtualizacao && (
        <p className="text-xs text-muted">
          Fonte: Receita Federal via ReceitaWS · atualizado em{" "}
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
            new Date(resultado.ultimaAtualizacao),
          )}
        </p>
      )}
    </div>
  );
}
