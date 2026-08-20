import { Card } from "./design/card";

// Estados de feedback compartilhados por qualquer tela de listagem (erro de
// conexão com a API, lista vazia) - mesmo tratamento visual em todas as
// telas de negócio, pra não reimplementar o mesmo bloco em cada página
// (ver critério de aceite da OS-WEB-12: reaproveitar o padrão da OS-WEB-11).
// Card branco + tokens ink/muted (OS-WEB-16) - sem vermelho pra erro, o
// design system não usa cor de alerta, só hierarquia de texto (ink pro
// título, muted pro detalhe).
export function ErroConexao({ mensagem }: { mensagem: string }) {
  return (
    <Card>
      <p className="font-medium text-ink">Falha ao conectar com a API</p>
      <p className="mt-1 text-sm text-muted">{mensagem}</p>
    </Card>
  );
}

export function EstadoVazio({ mensagem }: { mensagem: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{mensagem}</p>
    </Card>
  );
}
