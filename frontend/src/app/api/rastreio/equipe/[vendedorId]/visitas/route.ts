import { NextResponse, type NextRequest } from "next/server";
import { apiFetch, ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import type { VisitaEquipeDto } from "@/lib/visitas";

// BFF irmão de .../trajeto/route.ts (mesmo motivo: o navegador não pode
// chamar o backend NestJS direto, sem CORS configurado) - alimenta os pins
// de visita no mesmo mapa de rastreio (OS-WEB-24 estendida a pedido do
// usuário: "pin de onde foi feita a visita" + rota, na mesma tela).
// dataInicial=dataFinal=data porque o seletor do painel é por DIA, não
// período - reaproveita GET /visitas (OS-WEB-26) já escopado por
// hierarquia, sem endpoint novo no backend.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendedorId: string }> },
): Promise<NextResponse> {
  const { vendedorId } = await params;
  const data = request.nextUrl.searchParams.get("data");

  if (!data) {
    return NextResponse.json({ message: "Parâmetro 'data' obrigatório." }, { status: 400 });
  }

  try {
    const query = new URLSearchParams({
      vendedorId,
      dataInicial: data,
      dataFinal: data,
      limit: "100",
    });
    const resultado = await apiFetch<PaginatedResult<VisitaEquipeDto>>(`/visitas?${query}`, {
      cache: "no-store",
    });
    return NextResponse.json(resultado.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status || 502 });
    }
    return NextResponse.json({ message: "Erro desconhecido." }, { status: 500 });
  }
}
