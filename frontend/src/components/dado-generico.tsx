import { EstadoVazio } from "./listagem-feedback";
import { Card } from "./design/card";

// Alguns campos vem do WK Radar como JSONB sem schema estavel do nosso
// lado (enderecos do cliente, referencias de grade do produto - ver
// comentario em schema.prisma sobre esses campos nao terem id/identidade
// propria). Em vez de inventar um formato especifico que pode nao bater
// com o dado real, renderiza cada entrada genericamente como pares
// chave/valor - honesto sobre o que realmente sabemos do formato.
export function ListaGenerica({
  valor,
  mensagemVazio,
}: {
  valor: unknown;
  mensagemVazio: string;
}) {
  if (!Array.isArray(valor) || valor.length === 0) {
    return <EstadoVazio mensagem={mensagemVazio} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {valor.map((item, indice) => (
        <Card key={indice} className="p-4 text-sm">
          {item !== null && typeof item === "object" ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(item as Record<string, unknown>).map(([chave, valorCampo]) => (
                <div key={chave} className="contents">
                  <dt className="text-muted">{chave}</dt>
                  <dd className="text-ink">{formatarValorGenerico(valorCampo)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <span className="text-ink">{formatarValorGenerico(item)}</span>
          )}
        </Card>
      ))}
    </div>
  );
}

function formatarValorGenerico(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  if (typeof valor === "object") {
    return JSON.stringify(valor);
  }
  return String(valor);
}
