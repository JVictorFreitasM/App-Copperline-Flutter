import { Card } from "@/components/design/card";
import { formatarDataHora } from "@/lib/formatacao";
import type { MensagemEnviadaDto } from "@/lib/mensagens";

// Histórico das últimas mensagens manuais enviadas (só admin vê, ver
// page.tsx) - Server Component, só leitura.
export function MensagensEnviadas({ mensagens }: { mensagens: MensagemEnviadaDto[] }) {
  if (mensagens.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Mensagens enviadas</h2>
      {mensagens.map((mensagem) => (
        <Card key={mensagem.id}>
          <p className="text-sm font-medium text-ink">{mensagem.assunto}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-muted">{mensagem.corpo}</p>
          <p className="mt-2 text-xs text-muted">
            Para {mensagem.destinoRotulo} ({mensagem.totalDestinatarios}{" "}
            {mensagem.totalDestinatarios === 1 ? "pessoa" : "pessoas"}) · por {mensagem.autorNome} ·{" "}
            {formatarDataHora(mensagem.criadoEm)}
          </p>
        </Card>
      ))}
    </section>
  );
}
