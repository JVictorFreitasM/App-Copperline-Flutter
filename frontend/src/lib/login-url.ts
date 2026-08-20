// Helper puro (sem "next/headers"/"next/server") - usado tanto pelo proxy
// (Node runtime, le a URL via NextRequest) quanto por Server Components (le
// a URL via next/headers) pra montar o redirect pro login do backend sem
// duplicar a logica de construção da URL nos dois lugares.
export function buildLoginUrl(apiPublicUrl: string, returnToAbsoluteUrl: string): string {
  const loginUrl = new URL("/auth/login", apiPublicUrl);
  loginUrl.searchParams.set("returnTo", returnToAbsoluteUrl);
  return loginUrl.toString();
}

function lerEnvObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`${nome} não configurada - defina a variável de ambiente no .env local do frontend.`);
  }
  return valor.replace(/\/+$/, "");
}

// Base usada em chamadas SERVIDOR-A-SERVIDOR (apiFetch, getCurrentUser) -
// dentro de Docker, aponta pro hostname interno do container do backend
// (ex: http://backend:3000), nao pro host mapeado.
export function resolverApiUrl(): string {
  return lerEnvObrigatoria("API_URL");
}

// Base usada em qualquer URL que o NAVEGADOR vai efetivamente acessar
// (login, logout, redirect do proxy) - precisa ser o endereço que o
// navegador enxerga (ex: http://localhost:3010), que dentro de Docker é
// diferente do hostname interno usado por resolverApiUrl(). Em dev sem
// Docker os dois valores costumam ser iguais.
export function resolverApiPublicUrl(): string {
  return lerEnvObrigatoria("API_PUBLIC_URL");
}
