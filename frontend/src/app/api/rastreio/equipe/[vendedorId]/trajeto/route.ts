import { NextResponse, type NextRequest } from "next/server";
import { apiFetch, ApiError } from "@/lib/api";
import type { TrajetoVendedorDto } from "@/lib/rastreio";

// BFF (ver skill nextjs-best-practices - Route Handler só pra necessidade
// de infraestrutura, não CRUD paralelo): o painel de rastreio (OS-WEB-24)
// busca o trajeto do dia via fetch no CLIENTE (não dá pra fazer isso num
// Server Component sem recarregar a página inteira a cada troca de
// vendedor/data selecionado no mapa) - mas o browser não pode chamar o
// backend NestJS diretamente (origem/porta diferentes, sem CORS
// configurado). Esta rota só repassa a chamada server-a-servidor
// (apiFetch já encaminha o cookie de sessão do próprio navegador), sem
// nenhuma lógica própria - a autorização real (escopo por equipe) é toda
// feita pelo backend em GET /rastreio/equipe/:vendedorId/trajeto.
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
    const trajeto = await apiFetch<TrajetoVendedorDto>(
      `/rastreio/equipe/${encodeURIComponent(vendedorId)}/trajeto?data=${encodeURIComponent(data)}`,
      { cache: "no-store" },
    );
    return NextResponse.json(trajeto);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status || 502 });
    }
    return NextResponse.json({ message: "Erro desconhecido." }, { status: 500 });
  }
}
