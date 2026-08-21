import { NextRequest, NextResponse } from "next/server";
import { buildLoginUrl, resolverApiPublicUrl } from "./lib/login-url";

// Nome padrao do cookie de sessao do express-session (backend nao
// configurou um nome customizado - ver src/main.ts do backend).
const SESSION_COOKIE_NAME = "connect.sid";

// So verifica a PRESENCA do cookie de sessao - gate barato, sem round-trip
// ao backend a cada navegacao. Um cookie presente mas invalido/expirado
// ainda passa por aqui; a validacao de verdade acontece no backend via
// requireAuth, disparada por getCurrentUser() (src/lib/auth.ts) em cada
// pagina protegida - proxy + pagina juntos cobrem o caso "sem cookie
// nenhum" (redirect imediato, sem nem renderizar) e o caso "cookie invalido"
// (pagina detecta via /auth/me e redireciona).
export function proxy(request: NextRequest) {
  const temSessao = request.cookies.has(SESSION_COOKIE_NAME);
  if (temSessao) {
    return NextResponse.next();
  }

  // returnTo aponta pro proprio front (nunca pro backend) - o backend so
  // redireciona o navegador de volta pra essa URL apos o login completar
  // (ver idp-client callback.ts: res.redirect(returnTo || postLoginRedirect)).
  //
  // NAO usar request.nextUrl.origin aqui: em modo standalone (Docker), ele
  // reflete o hostname/porta INTERNO do container (ex: <container-id>:3000),
  // nao o que o navegador de fato usou pra chegar ate aqui - confirmado na
  // pratica. O header Host e a fonte confiavel do que o navegador enviou.
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  const returnTo = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);

  // API_PUBLIC_URL (nao API_URL) - o redirect e seguido pelo NAVEGADOR, que
  // precisa do endereco que ele mesmo enxerga (ver login-url.ts).
  return NextResponse.redirect(buildLoginUrl(resolverApiPublicUrl(), returnTo.toString()));
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/clientes/:path*",
    "/produtos/:path*",
    "/pedidos/:path*",
    "/estoque/:path*",
    "/notas-fiscais/:path*",
  ],
};
