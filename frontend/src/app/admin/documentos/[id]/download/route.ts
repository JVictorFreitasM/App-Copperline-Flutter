import { cookies } from "next/headers";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { resolverApiUrl } from "@/lib/login-url";

// Proxy server-side pro download (OS-WEB-38) - o navegador não tem como
// mandar o cookie de sessão direto pro backend (resolverApiUrl() é o
// hostname INTERNO do Docker, ex: http://backend:3000, inalcançável fora
// do compose - e mesmo em dev sem Docker, origem diferente da do frontend
// não compartilha cookie automaticamente). Repassa o mesmo cookie que
// apiFetch usa em Server Components/Actions (ver src/lib/api.ts).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirUsuarioAutenticado("/admin/documentos");
  const { id } = await params;

  const cookieStore = await cookies();
  const url = `${resolverApiUrl()}/documentos/${encodeURIComponent(id)}/download`;

  const resposta = await fetch(url, {
    headers: { Cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (!resposta.ok || !resposta.body) {
    return new Response("Erro ao baixar documento", { status: resposta.status || 502 });
  }

  return new Response(resposta.body, {
    headers: {
      "Content-Type": resposta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": resposta.headers.get("Content-Disposition") ?? "attachment",
    },
  });
}
