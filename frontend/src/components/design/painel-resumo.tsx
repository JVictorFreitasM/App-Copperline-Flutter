import { Card } from "./card";

const CORES_BARRA: Record<string, string> = {
  primary: "bg-primary",
  laranja: "bg-accent-orange",
  verde: "bg-accent-green",
};

interface ItemResumo {
  rotulo: string;
  valor: number;
  cor: keyof typeof CORES_BARRA;
}

// Painel "Resumo" (ver skill design-system, referência "Constructive",
// painel "Statistics") - barra proporcional AO MAIOR valor da lista
// (comparação visual entre os três, não "progresso" de uma meta - as
// métricas aqui são contagens simples, sem meta definida).
export function PainelResumo({ itens }: { itens: ItemResumo[] }) {
  const maior = Math.max(...itens.map((item) => item.valor), 1);

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Resumo</h3>
      <div className="flex flex-col gap-4">
        {itens.map((item) => (
          <div key={item.rotulo} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{item.rotulo}</span>
              <span className="font-semibold text-ink">{item.valor}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full ${CORES_BARRA[item.cor]}`}
                style={{ width: `${(item.valor / maior) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
