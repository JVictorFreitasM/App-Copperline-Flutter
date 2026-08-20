import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildLoginUrl, resolverApiPublicUrl, resolverApiUrl } from "./login-url";

// Claims do usuario autenticado, ja validadas pelo backend (idp-client) -
// mesmo shape devolvido por GET /auth/me (ver skill idp-client).
export interface CurrentUser {
  sub: string;
  email: string;
  name: string;
  role: string | null;
  system: string;
}

// Chama GET /auth/me no backend, repassando o cookie de sessao recebido do
// navegador (a chamada em si e servidor-a-servidor - Next.js nunca fala com
// o IdP, so encaminha o cookie httpOnly que o proprio navegador ja tinha
// pro backend, exatamente como a skill idp-client documenta). Retorna null
// se nao houver sessao valida (backend responde com redirect 302 pro login
// nesse caso, nunca 401 - por isso `redirect: "manual"" pra nao seguir o
// redirect e tratar como "nao autenticado").
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (!cookieHeader) {
    return null;
  }

  const response = await fetch(`${resolverApiUrl()}/auth/me`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
    redirect: "manual",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<CurrentUser>;
}

// Usado no topo de qualquer pagina protegida (ver proxy.ts - o matcher so
// cobre o caso "sem cookie nenhum"; cookie presente porem invalido/expirado
// so e' detectado aqui, via /auth/me). Centraliza o redirect-com-returnTo
// pra nao duplicar esse bloco em cada pagina de negocio (clientes,
// produtos, ...) - ver OS-WEB-12, criterio de aceite sobre reaproveitar a
// mesma logica ja validada na OS-WEB-11.
export async function exigirUsuarioAutenticado(rotaAtual: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) {
    return user;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const returnTo = host ? `${proto}://${host}${rotaAtual}` : rotaAtual;
  redirect(buildLoginUrl(resolverApiPublicUrl(), returnTo));
}
