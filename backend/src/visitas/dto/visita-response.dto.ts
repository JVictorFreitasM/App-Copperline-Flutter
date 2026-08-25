import type { Visita } from '../../../generated/prisma/client';

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
  // Nunca o caminho de disco em si (detalhe interno de infraestrutura) -
  // so se ha foto, pra o app decidir se mostra o link de
  // GET /admin/visitas/:id/foto.
  temFoto: boolean;
  distanciaCheckinMetros: number | null;
  distanciaCheckoutMetros: number | null;
}

export function paraVisitaDto(visita: Visita): VisitaDto {
  return {
    id: visita.id,
    clienteId: visita.clienteId,
    vendedorId: visita.vendedorId,
    checkinEm: visita.checkinEm.toISOString(),
    checkinLat: visita.checkinLat.toNumber(),
    checkinLng: visita.checkinLng.toNumber(),
    checkoutEm: visita.checkoutEm ? visita.checkoutEm.toISOString() : null,
    checkoutLat: visita.checkoutLat ? visita.checkoutLat.toNumber() : null,
    checkoutLng: visita.checkoutLng ? visita.checkoutLng.toNumber() : null,
    nota: visita.nota,
    canceladaEm: visita.canceladaEm ? visita.canceladaEm.toISOString() : null,
    motivoCancelamento: visita.motivoCancelamento,
    temFoto: visita.fotoCheckinCaminho !== null,
    distanciaCheckinMetros: visita.distanciaCheckinMetros
      ? visita.distanciaCheckinMetros.toNumber()
      : null,
    distanciaCheckoutMetros: visita.distanciaCheckoutMetros
      ? visita.distanciaCheckoutMetros.toNumber()
      : null,
  };
}
