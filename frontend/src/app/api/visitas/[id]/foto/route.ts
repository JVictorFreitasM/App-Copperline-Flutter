import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolverApiUrl } from "@/lib/login-url";

// BFF (ver skill nextjs-best-practices - Route Handler só pra necessidade
// de infraestrutura): GET /visitas/:id/foto no backend devolve bytes de
// imagem, não JSON - apiFetch (lib/api.ts) sempre chama response.json(),
// então não serve aqui. Esta rota faz seu próprio fetch server-a-servidor
// (repassando o cookie de sessão do navegador, mesma lógica de apiFetch),
// só pra poder repassar o Content-Type e o corpo binário como vieram, sem
// nenhuma lógica própria - a autorização real (escopo por equipe) é toda
// feita pelo backend em GET /visitas/:id/foto.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let resposta: Response;
  try {
    resposta = await fetch(`${resolverApiUrl()}/visitas/${encodeURIComponent(id)}/foto`, {
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
