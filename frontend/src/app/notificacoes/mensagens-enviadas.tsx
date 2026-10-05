import { Badge } from "@/components/badge";
import { Card } from "@/components/design/card";
import { formatarDataHora } from "@/lib/formatacao";
import type { MensagemEnviadaDto } from "@/lib/mensagens";
import { ReenviarButton } from "./reenviar-button";

// Histórico das últimas mensagens manuais enviadas (só admin vê, ver
// page.tsx) - inclui as disparadas por uma mensagem periódica (badge
// "Periódica"). Server Component; só o botão de reenvio é client.
export function MensagensEnviadas({ mensagens }: { mensagens: MensagemEnviadaDto[] }) {
  if (mensagens.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Mensagens enviadas</h2>
      {mensagens.map((mensagem) => (
        <Card key={mensagem.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{mensagem.assunto}</p>
                {mensagem.periodica && <Badge>Periódica</Badge>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{mensagem.corpo}</p>
              <p className="mt-2 text-xs text-muted">
                Para {mensagem.destinoRotulo} ({mensagem.totalDestinatarios}{" "}
                {mensagem.totalDestinatarios === 1 ? "pessoa" : "pessoas"}) · por {mensagem.autorNome} ·{" "}
                {formatarDataHora(mensagem.criadoEm)}
              </p>
            </div>
            <ReenviarButton
              mensagemId={mensagem.id}
              assunto={mensagem.assunto}
              destinoRotulo={mensagem.destinoRotulo}
            />
          </div>
        </Card>
      ))}
    </section>
  );
}
