import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolverApiUrl } from "@/lib/login-url";

// BFF (mesmo criterio de app/api/visitas/[id]/foto/route.ts) - GET
// /produtos/:id/imagem no backend devolve bytes de imagem, nao JSON.
// Autorizacao real (sessao valida) e' toda feita pelo backend.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let resposta: Response;
  try {
    resposta = await fetch(`${resolverApiUrl()}/produtos/${encodeURIComponent(id)}/imagem`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { message: `Falha ao conectar com a API: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    return NextResponse.json(
      { message: corpo || `API respondeu ${resposta.status}` },
      { status: resposta.status },
    );
  }

  const bytes = await resposta.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: { "Content-Type": resposta.headers.get("content-type") ?? "image/jpeg" },
  });
}
