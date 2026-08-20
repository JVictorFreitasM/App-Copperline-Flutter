import type { ReactNode } from "react";
import { Card } from "./card";

// Ícone em círculo colorido + label pequeno + valor (bold) - métrica
// secundária de apoio, não o número principal da tela (ver skill
// design-system, "Card de estatística"). Nenhuma das cinco telas
// retrofitadas na OS-WEB-16 tem uma métrica agregada de verdade pra
// mostrar aqui sem inventar dado que não existia antes (fora de escopo
// desta OS) - componente pronto para quando uma tela com métrica real
// existir (ex: resumo do dia, painel inicial).
export function StatCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
        {icon}
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-base font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}
