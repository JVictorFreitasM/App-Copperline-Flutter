// Mesmo shape de backend/src/visitas/dto/visita-response.dto.ts
// (VisitaDto, GET /clientes/:id/visitas) - duplicado aqui por não haver
// pacote compartilhado entre front e back. Sem nome do vendedor (só
// vendedorId) - o backend não resolve isso nesse endpoint, e "vendedor
// responsável" do cliente já aparece no card de estatísticas
// (ClienteEstatisticasDto.vendedorResponsavel).
export interface VisitaDto {
  id: string;
  clienteId: string;
  vendedorId: string;
  checkinEm: string;
  checkinLat: number;
  checkinLng: number;
  checkoutEm: string | null;
  checkoutLat: number | null;
  checkoutLng: number | null;
  nota: string | null;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  temFoto: boolean;
  distanciaCheckinMetros: number | null;
  distanciaCheckoutMetros: number | null;
}

// Usado em GET /visitas (OS-WEB-26) - inclui vendedor/cliente resolvidos
// (join) pra tela de revisão do supervisor não precisar de mais chamadas
// só pra mostrar quem fez a visita e em qual cliente.
export interface VisitaEquipeDto extends VisitaDto {
  vendedor: { id: string; nome: string | null };
  cliente: { id: string; razaoSocial: string | null };
}

// Só dois tons (ver skill design-system) - "Concluída" (checkout feito) é
// o único estado que ganha destaque, mesmo padrão de configSituacaoPedido.
export function statusVisita(visita: VisitaDto): { rotulo: string; enfase: boolean } {
  if (visita.canceladaEm) {
    return { rotulo: "Cancelada", enfase: false };
  }
  if (visita.checkoutEm) {
    return { rotulo: "Concluída", enfase: true };
  }
  return { rotulo: "Em andamento", enfase: false };
}
