import { Card } from "@/components/design/card";
import type { ConsultaCepDto } from "@/lib/consulta-cep";

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="text-sm text-ink">{valor ?? "—"}</dd>
    </div>
  );
}

// Somente leitura - nada daqui é gravado na nossa base.
export function CepResultadoView({ resultado }: { resultado: ConsultaCepDto }) {
  return (
    <Card>
      <p className="text-xs text-muted">CEP</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">{resultado.cepFormatado}</h2>
      {resultado.unidade && <p className="text-sm text-muted">{resultado.unidade}</p>}
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo="Logradouro" valor={resultado.logradouro} />
        <Campo rotulo="Complemento" valor={resultado.complemento} />
        <Campo rotulo="Bairro" valor={resultado.bairro} />
        <Campo rotulo="Cidade" valor={resultado.localidade} />
        <Campo rotulo="UF" valor={resultado.uf} />
        <Campo rotulo="Código IBGE" valor={resultado.codigoIbge} />
      </dl>
    </Card>
  );
}
